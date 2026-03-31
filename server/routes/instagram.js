const router = require('express').Router();
const axios = require('axios');
const User = require('../models/User');

const FB_BASE = 'https://graph.facebook.com/v18.0';
const FB_APP_ID = process.env.FACEBOOK_APP_ID;
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const IG_CALLBACK_URL = process.env.INSTAGRAM_CALLBACK_URL || 'http://localhost:5000/api/instagram/callback';

// Helper to get user token
const getToken = async (userId) => {
  const user = await User.findById(userId);
  const token = user?.instagramToken;
  const accountId = user?.instagramAccountId;
  if (!token || !accountId) throw new Error('Instagram not connected. Please connect your account first.');
  return { token, accountId, user };
};

// ── Step 1: Redirect to Facebook OAuth ──────────────────────────────────
router.get('/connect', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ message: 'userId required' });

  // Save userId in session for callback
  req.session.igUserId = userId;
  req.session.save();

  const scopes = [
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_comments',
    'instagram_manage_insights',
    'pages_show_list',
    'pages_read_engagement',
    'public_profile'
  ].join(',');

  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
    `client_id=${FB_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(IG_CALLBACK_URL)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${userId}` +
    `&response_type=code`;

  res.redirect(authUrl);
});

// ── Step 2: Handle OAuth Callback ───────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, state: userId, error } = req.query;

  if (error) {
    console.error('Instagram OAuth denied:', error);
    return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=instagram_denied`);
  }

  if (!code) return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=instagram_no_code`);

  const uid = userId || req.session.igUserId;

  try {
    // Step A: Exchange code for short-lived token
    const tokenRes = await axios.get(`${FB_BASE}/oauth/access_token`, {
      params: {
        client_id: FB_APP_ID,
        client_secret: FB_APP_SECRET,
        redirect_uri: IG_CALLBACK_URL,
        code
      }
    });

    const shortToken = tokenRes.data.access_token;

    // Step B: Exchange for long-lived token (60 days)
    const longTokenRes = await axios.get(`${FB_BASE}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: FB_APP_ID,
        client_secret: FB_APP_SECRET,
        fb_exchange_token: shortToken
      }
    });

    const longToken = longTokenRes.data.access_token;
    const expiresIn = longTokenRes.data.expires_in; // ~60 days in seconds

    // Step C: Get Facebook Pages the user manages
    const pagesRes = await axios.get(`${FB_BASE}/me/accounts`, {
      params: { access_token: longToken, fields: 'id,name,instagram_business_account,access_token' }
    });

    const pages = pagesRes.data.data || [];
    let instagramAccountId = null;
    let pageAccessToken = longToken;

    // Find the Instagram Business Account linked to any page
    for (const page of pages) {
      if (page.instagram_business_account?.id) {
        instagramAccountId = page.instagram_business_account.id;
        pageAccessToken = page.access_token || longToken; // Use page token for IG API
        break;
      }
    }

    // Fallback: try getting IG account directly
    if (!instagramAccountId) {
      try {
        const meRes = await axios.get(`${FB_BASE}/me`, {
          params: { access_token: longToken, fields: 'id,name,instagram_business_account' }
        });
        if (meRes.data.instagram_business_account?.id) {
          instagramAccountId = meRes.data.instagram_business_account.id;
        }
      } catch (e) {}
    }

    if (!instagramAccountId) {
      console.error('No Instagram Business Account found for user');
      return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=instagram_no_business_account`);
    }

    // Step D: Get Instagram username for confirmation
    let igUsername = '';
    try {
      const igInfoRes = await axios.get(`${FB_BASE}/${instagramAccountId}`, {
        params: { fields: 'id,username,name,followers_count', access_token: pageAccessToken }
      });
      igUsername = igInfoRes.data.username || igInfoRes.data.name || '';
    } catch (e) {}

    // Step E: Save to database
    const tokenExpiry = new Date(Date.now() + (expiresIn || 5184000) * 1000);
    await User.findByIdAndUpdate(uid, {
      $set: {
        'connectedPlatforms.instagram': true,
        'instagramToken': pageAccessToken,
        'instagramAccountId': instagramAccountId,
        'instagramUsername': igUsername,
        'instagramTokenExpiry': tokenExpiry,
      }
    });

    console.log(`✅ Instagram connected: @${igUsername} (${instagramAccountId})`);
    res.redirect(`${process.env.CLIENT_URL}/dashboard?connected=instagram&ig_user=${encodeURIComponent(igUsername)}`);

  } catch (err) {
    console.error('Instagram callback error:', err.response?.data || err.message);
    res.redirect(`${process.env.CLIENT_URL}/dashboard?error=instagram_failed`);
  }
});

// ── Disconnect ───────────────────────────────────────────────────────────
router.post('/disconnect', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.body.userId, {
      $set: {
        'connectedPlatforms.instagram': false,
        'instagramToken': null,
        'instagramAccountId': null,
        'instagramUsername': null,
      }
    });
    res.json({ message: 'Instagram disconnected' });
  } catch (err) { res.status(500).json({ message: 'Error' }); }
});

// ── Post Image ───────────────────────────────────────────────────────────
router.post('/post/image', async (req, res) => {
  try {
    const { userId, caption, imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ message: 'imageUrl required (must be public https URL)' });

    const { token, accountId } = await getToken(userId);

    // Create container
    const containerRes = await axios.post(`${FB_BASE}/${accountId}/media`, null, {
      params: { image_url: imageUrl, caption: caption || '', access_token: token }
    });
    const containerId = containerRes.data.id;
    if (!containerId) throw new Error('Failed to create media container');

    // Wait for processing
    await new Promise(r => setTimeout(r, 3000));

    // Publish
    const publishRes = await axios.post(`${FB_BASE}/${accountId}/media_publish`, null, {
      params: { creation_id: containerId, access_token: token }
    });

    res.json({ message: '✅ Posted to Instagram!', mediaId: publishRes.data.id });
  } catch (err) {
    console.error('IG post error:', err.response?.data || err.message);
    res.status(500).json({ message: err.response?.data?.error?.message || 'Post failed: ' + err.message });
  }
});

// ── Post Reel/Video ──────────────────────────────────────────────────────
router.post('/post/video', async (req, res) => {
  try {
    const { userId, caption, videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ message: 'videoUrl required (must be public https URL)' });

    const { token, accountId } = await getToken(userId);

    const containerRes = await axios.post(`${FB_BASE}/${accountId}/media`, null, {
      params: { media_type: 'REELS', video_url: videoUrl, caption: caption || '', access_token: token }
    });
    const containerId = containerRes.data.id;

    // Poll for processing (videos take longer)
    let status = 'IN_PROGRESS';
    let attempts = 0;
    while (status === 'IN_PROGRESS' && attempts < 24) {
      await new Promise(r => setTimeout(r, 5000));
      const statusRes = await axios.get(`${FB_BASE}/${containerId}`, {
        params: { fields: 'status_code', access_token: token }
      });
      status = statusRes.data.status_code;
      attempts++;
    }
    if (status !== 'FINISHED') throw new Error(`Video processing ${status} after ${attempts * 5}s`);

    const publishRes = await axios.post(`${FB_BASE}/${accountId}/media_publish`, null, {
      params: { creation_id: containerId, access_token: token }
    });

    res.json({ message: '✅ Reel posted to Instagram!', mediaId: publishRes.data.id });
  } catch (err) {
    console.error('IG reel error:', err.response?.data || err.message);
    res.status(500).json({ message: err.response?.data?.error?.message || 'Reel failed: ' + err.message });
  }
});

// ── Get Recent Media ─────────────────────────────────────────────────────
router.get('/media/:userId', async (req, res) => {
  try {
    const { token, accountId } = await getToken(req.params.userId);
    const mediaRes = await axios.get(`${FB_BASE}/${accountId}/media`, {
      params: { fields: 'id,caption,media_type,media_url,thumbnail_url,timestamp,comments_count,like_count', limit: 10, access_token: token }
    });
    res.json({ media: mediaRes.data.data || [] });
  } catch (err) {
    res.status(500).json({ message: err.response?.data?.error?.message || err.message });
  }
});

// ── Get Comments ─────────────────────────────────────────────────────────
router.get('/comments/:userId', async (req, res) => {
  try {
    const { token, accountId } = await getToken(req.params.userId);

    const mediaRes = await axios.get(`${FB_BASE}/${accountId}/media`, {
      params: { fields: 'id,caption,timestamp', limit: 5, access_token: token }
    });

    const posts = mediaRes.data.data || [];
    const allComments = [];

    for (const post of posts.slice(0, 4)) {
      try {
        const commentsRes = await axios.get(`${FB_BASE}/${post.id}/comments`, {
          params: { fields: 'id,text,username,timestamp', access_token: token }
        });
        for (const c of (commentsRes.data.data || [])) {
          allComments.push({
            id: c.id, text: c.text,
            author: c.username || 'user',
            timestamp: c.timestamp,
            postId: post.id,
            mediaCaption: post.caption?.slice(0, 100) || ''
          });
        }
      } catch (e) { /* skip posts with no comment access */ }
    }

    res.json({ comments: allComments });
  } catch (err) {
    res.status(500).json({ message: err.response?.data?.error?.message || err.message });
  }
});

// ── Reply to Comment ─────────────────────────────────────────────────────
router.post('/comment/reply', async (req, res) => {
  try {
    const { userId, commentId, reply } = req.body;
    const { token } = await getToken(userId);
    await axios.post(`${FB_BASE}/${commentId}/replies`, null, {
      params: { message: reply, access_token: token }
    });
    res.json({ message: 'Reply posted!' });
  } catch (err) {
    res.status(500).json({ message: err.response?.data?.error?.message || 'Reply failed' });
  }
});

// ── AI Reply for Comment ─────────────────────────────────────────────────
router.post('/comment/ai-reply', async (req, res) => {
  try {
    const { comment, mediaCaption } = req.body;
    const aiRes = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        max_tokens: 80,
        messages: [{ role: 'user', content: `Write a short friendly Instagram reply.\nPost: "${mediaCaption || ''}"\nComment: "${comment}"\nRules: 1-2 sentences max. Friendly tone. 1 emoji. No hashtags.` }]
      },
      { headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' } }
    );
    res.json({ reply: aiRes.data.choices[0].message.content.trim() });
  } catch (err) { res.status(500).json({ message: 'AI error' }); }
});

module.exports = router;