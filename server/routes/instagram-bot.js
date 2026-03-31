// server/routes/instagram-bot.js
// Instagram automation via instagram-private-api
// Same private API the official Instagram app uses

const router = require('express').Router();
const { IgApiClient } = require('instagram-private-api');
const { StickerBuilder } = require('instagram-private-api/dist/sticker-builder');
const axios = require('axios');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');

// ── Encryption ────────────────────────────────────────────────────────
const rawKey = process.env.ENCRYPT_SECRET || 'synapsocial-secret-key-for-aes256';
const ENCRYPT_KEY = rawKey.padEnd(32, '0').slice(0, 32);
const IV = 16;

const encrypt = (text) => {
  const iv = crypto.randomBytes(IV);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPT_KEY), iv);
  let enc = cipher.update(text);
  enc = Buffer.concat([enc, cipher.final()]);
  return iv.toString('hex') + ':' + enc.toString('hex');
};

const decrypt = (text) => {
  const [ivHex, encHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPT_KEY), iv);
  let dec = decipher.update(enc);
  dec = Buffer.concat([dec, decipher.final()]);
  return dec.toString();
};

// ── Create & Login IG Client ──────────────────────────────────────────
const getIgClient = async (user) => {
  if (!user.igBotUsername || !user.igBotPassword)
    throw new Error('No Instagram credentials saved.');

  const ig = new IgApiClient();
  ig.state.generateDevice(user.igBotUsername);

  // Restore saved session if exists (avoids re-login every time)
  if (user.igBotSession) {
    try {
      await ig.state.deserialize(JSON.parse(decrypt(user.igBotSession)));
      console.log(`[IG] Restored session for ${user.igBotUsername}`);
      return ig;
    } catch (e) {
      console.log('[IG] Session expired, re-logging in...');
    }
  }

  // Fresh login
  await ig.simulate.preLoginFlow();
  await ig.account.login(user.igBotUsername, decrypt(user.igBotPassword));
  await ig.simulate.postLoginFlow();

  // Save session for next time
  const session = await ig.state.serialize();
  await User.findByIdAndUpdate(user._id, {
    $set: { igBotSession: encrypt(JSON.stringify(session)) }
  });

  console.log(`[IG] Logged in: ${user.igBotUsername}`);
  return ig;
};

// ── AI Reply ─────────────────────────────────────────────────────────
const generateAIReply = async (comment, context = '') => {
  try {
    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'google/gemini-2.5-flash-lite-preview-09-2025',
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: `Write a short friendly Instagram comment reply (1-2 sentences, 1-2 emojis, casual tone).
${context ? 'Context: ' + context : ''}
Comment: "${comment}"
Reply text only. No hashtags.`
      }],
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://synapsocial.vercel.app',
      },
      timeout: 15000,
    });
    return res.data.choices[0].message.content.trim();
  } catch { return 'Thank you so much! ❤️'; }
};

// ─────────────────────────────────────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────────────────────────────────────

// ── Save Credentials ──────────────────────────────────────────────────
router.post('/save-credentials', async (req, res) => {
  try {
    const { userId, username, password } = req.body;
    if (!userId || !username || !password)
      return res.status(400).json({ message: 'userId, username and password required' });

    await User.findByIdAndUpdate(userId, {
      $set: {
        igBotUsername: username.trim().replace('@', ''),
        igBotPassword: encrypt(password),
        igBotSession: null, // clear old session
      }
    });
    res.json({ message: '✅ Credentials saved securely' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Test Login ────────────────────────────────────────────────────────
router.post('/test-login', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user?.igBotUsername) return res.status(400).json({ message: 'No credentials saved.' });

    const ig = await getIgClient(user);
    const currentUser = await ig.account.currentUser();

    res.json({
      message: `✅ Connected! @${currentUser.username} (${currentUser.full_name})`,
      username: currentUser.username,
      fullName: currentUser.full_name,
      followers: currentUser.follower_count,
    });
  } catch (err) {
    // Clear bad session
    if (err.message?.includes('login') || err.message?.includes('session')) {
      await User.findOneAndUpdate({ _id: req.body.userId }, { $set: { igBotSession: null } });
    }
    res.status(500).json({ message: err.message });
  }
});

// ── Post Video ────────────────────────────────────────────────────────
const uploadVideo = multer({
  dest: 'uploads/instagram/',
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

router.post('/post-video', uploadVideo.single('video'), async (req, res) => {
  try {
    const { userId, caption = '' } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No video file uploaded' });

    const user = await User.findById(userId);
    if (!user?.igBotUsername) return res.status(400).json({ message: 'No credentials saved.' });

    const ig = await getIgClient(user);
    const videoBuffer = fs.readFileSync(req.file.path);

    // Post as reel (short video)
    await ig.publish.video({
      video: videoBuffer,
      caption,
      coverImage: videoBuffer.slice(0, 1000), // use first frame as cover
    });

    try { fs.unlinkSync(req.file.path); } catch { }
    res.json({ message: '✅ Video posted to Instagram!' });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch { }
    res.status(500).json({ message: err.message });
  }
});

// ── Post Story (image) ────────────────────────────────────────────────
const uploadStory = multer({
  dest: 'uploads/instagram/',
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post('/post-story', uploadStory.single('image'), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No image file uploaded' });

    const user = await User.findById(userId);
    if (!user?.igBotUsername) return res.status(400).json({ message: 'No credentials saved.' });

    const ig = await getIgClient(user);
    const imageBuffer = fs.readFileSync(req.file.path);

    await ig.publish.story({ file: imageBuffer });

    try { fs.unlinkSync(req.file.path); } catch { }
    res.json({ message: '✅ Story posted to Instagram!' });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch { }
    res.status(500).json({ message: err.message });
  }
});

// ── Post Image ────────────────────────────────────────────────────────
const uploadImage = multer({
  dest: 'uploads/instagram/',
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post('/post-image', uploadImage.single('image'), async (req, res) => {
  try {
    const { userId, caption = '' } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No image file uploaded' });

    const user = await User.findById(userId);
    if (!user?.igBotUsername) return res.status(400).json({ message: 'No credentials saved.' });

    const ig = await getIgClient(user);
    const imageBuffer = fs.readFileSync(req.file.path);

    await ig.publish.photo({ file: imageBuffer, caption });

    try { fs.unlinkSync(req.file.path); } catch { }
    res.json({ message: '✅ Image posted to Instagram!' });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch { }
    res.status(500).json({ message: err.message });
  }
});

// ── Get My Recent Media + Comments ────────────────────────────────────
router.get('/my-media/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user?.igBotUsername) return res.status(400).json({ message: 'No credentials saved.' });

    const ig = await getIgClient(user);
    const currentUser = await ig.account.currentUser();

    // Get recent posts
    const feed = ig.feed.user(currentUser.pk);
    const posts = await feed.items();

    const mediaWithComments = await Promise.all(
      posts.slice(0, 8).map(async (post) => {
        let comments = [];
        try {
          const commentFeed = ig.feed.mediaComments(post.id);
          const rawComments = await commentFeed.items();
          comments = rawComments.slice(0, 10).map(c => ({
            id: c.pk,
            author: c.user.username,
            text: c.text,
            time: new Date(c.created_at * 1000).toISOString(),
            replied: false,
          }));
        } catch { }

        return {
          id: post.id,
          mediaType: post.media_type, // 1=photo, 2=video, 8=carousel
          caption: post.caption?.text?.slice(0, 150) || '',
          likeCount: post.like_count || 0,
          commentCount: post.comment_count || 0,
          thumbnail: post.image_versions2?.candidates?.[0]?.url || null,
          takenAt: new Date(post.taken_at * 1000).toISOString(),
          comments,
        };
      })
    );

    res.json({ media: mediaWithComments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Reply to Comment ──────────────────────────────────────────────────
router.post('/reply-comment', async (req, res) => {
  try {
    const { userId, mediaId, commentId, reply } = req.body;
    const user = await User.findById(userId);
    if (!user?.igBotUsername) return res.status(400).json({ message: 'No credentials saved.' });

    const ig = await getIgClient(user);
    await ig.media.comment({
      mediaId,
      text: reply,
      replyToCommentId: commentId,
    });

    res.json({ message: '✅ Reply posted!' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── AI Reply Suggestion ───────────────────────────────────────────────
router.post('/ai-reply', async (req, res) => {
  try {
    const { comment, caption } = req.body;
    const reply = await generateAIReply(comment, caption);
    res.json({ reply });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Save automation context (which posts to auto-reply) ───────────────
router.post('/automate-post', async (req, res) => {
  try {
    const { userId, mediaId, context } = req.body;
    const update = { $addToSet: { igAutomatedPosts: mediaId } };
    if (context) update.$set = { [`igPostContexts.${mediaId}`]: context };
    await User.findByIdAndUpdate(userId, update);
    res.json({ message: `✅ Auto-reply enabled for post ${mediaId}` });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/automate-post/remove', async (req, res) => {
  try {
    const { userId, mediaId } = req.body;
    await User.findByIdAndUpdate(userId, { $pull: { igAutomatedPosts: mediaId } });
    res.json({ message: 'Removed' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/automated-posts/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    res.json({
      automatedPosts: user?.igAutomatedPosts || [],
      postContexts: user?.igPostContexts || {},
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Credentials Status ────────────────────────────────────────────────
router.get('/credentials-status/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    res.json({
      hasCredentials: !!(user?.igBotUsername && user?.igBotPassword),
      username: user?.igBotUsername || null,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = { router, getIgClient, generateAIReply };