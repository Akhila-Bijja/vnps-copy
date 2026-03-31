// server/routes/linkedin-bot.js
// LinkedIn automation via TinyFish API
// Stealth mode + rotating proxies built-in — LinkedIn won't detect it

const router = require('express').Router();
const axios = require('axios');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
const User = require('../models/User');

const TINYFISH_URL = 'https://agent.tinyfish.ai/v1/automation/run-sse';

// ── Encryption ────────────────────────────────────────────────────────
const rawKey = process.env.ENCRYPT_SECRET || 'synapsocial-secret-key-for-aes256';
const ENCRYPT_KEY = rawKey.padEnd(32, '0').slice(0, 32);
const IV_LENGTH = 16;

const encrypt = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPT_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

const decrypt = (text) => {
  try {
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPT_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch {
    throw new Error('Failed to decrypt credentials. Please re-save them.');
  }
};

// ── TinyFish Runner ───────────────────────────────────────────────────
// Sends a goal to TinyFish, reads SSE stream, returns final JSON result
const runTinyFish = async (url, goal, timeoutMs = 120000) => {
  const key = process.env.TINYFISH_API_KEY;
  if (!key) throw new Error('TINYFISH_API_KEY not set in Render environment variables. Get it free at tinyfish.ai');

  const response = await axios.post(
    TINYFISH_URL,
    {
      url,
      goal,
      browser_profile: 'stealth',   // ✅ Built-in stealth — LinkedIn won't detect
      proxy_config: { enabled: true }, // ✅ Rotating proxies included free
    },
    {
      headers: {
        'X-API-Key': key,
        'Content-Type': 'application/json',
      },
      responseType: 'stream',
      timeout: timeoutMs,
    }
  );

  return new Promise((resolve, reject) => {
    let buffer = '';
    let result = null;

    const timer = setTimeout(() => {
      reject(new Error('TinyFish timeout — LinkedIn task took too long'));
    }, timeoutMs);

    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        try {
          const data = JSON.parse(line.slice(5).trim());
          console.log(`[TinyFish] Event: ${data.type} ${data.status || ''}`);

          if (data.type === 'COMPLETE' && data.status === 'COMPLETED') {
            result = data.resultJson || data.result || data;
            clearTimeout(timer);
            resolve(result);
          } else if (data.type === 'COMPLETE' && data.status === 'FAILED') {
            clearTimeout(timer);
            reject(new Error(data.error || 'TinyFish task failed'));
          } else if (data.type === 'ERROR') {
            clearTimeout(timer);
            reject(new Error(data.message || 'TinyFish error'));
          }
        } catch { /* skip non-JSON lines */ }
      }
    });

    response.data.on('end', () => {
      clearTimeout(timer);
      if (!result) reject(new Error('TinyFish stream ended without result'));
    });

    response.data.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
};

// ── AI Reply Generator ────────────────────────────────────────────────
const generateAIReply = async (comment) => {
  try {
    const res = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-2.5-flash-lite-preview-09-2025',
        max_tokens: 80,
        messages: [{
          role: 'user',
          content: `Write a short professional LinkedIn comment reply (1-2 sentences, no hashtags, 1 emoji max) to: "${comment}". Reply text only.`
        }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://synapsocial.vercel.app',
        },
        timeout: 15000,
      }
    );
    return res.data.choices[0].message.content.trim();
  } catch {
    return 'Thank you for your comment! Really appreciate the engagement. 🙏';
  }
};

// ── Save Credentials ──────────────────────────────────────────────────
router.post('/save-credentials', async (req, res) => {
  try {
    const { userId, email, password } = req.body;
    if (!userId || !email || !password)
      return res.status(400).json({ message: 'All fields required' });
    await User.findByIdAndUpdate(userId, {
      $set: { linkedinBotEmail: email, linkedinBotPassword: encrypt(password) }
    });
    res.json({ message: '✅ Credentials saved securely' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Test Login ────────────────────────────────────────────────────────
router.post('/test-login', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user?.linkedinBotEmail || !user?.linkedinBotPassword)
      return res.status(400).json({ message: 'No credentials saved.' });

    const email = user.linkedinBotEmail;
    const password = decrypt(user.linkedinBotPassword);

    const result = await runTinyFish(
      'https://www.linkedin.com/login',
      `Login to LinkedIn with email "${email}" and password "${password}".
       After logging in, return JSON: { "success": true, "name": "profile name visible" }.
       If login fails or security check appears, return: { "success": false, "reason": "why" }`
    );

    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    if (parsed?.success === false) {
      return res.status(400).json({ message: `Login failed: ${parsed.reason}` });
    }

    res.json({ message: `✅ Login successful! ${parsed?.name ? 'Welcome, ' + parsed.name : 'LinkedIn connected.'}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Auto-Apply Jobs ───────────────────────────────────────────────────
router.post('/auto-apply-jobs', async (req, res) => {
  try {
    const { userId, keywords, location = 'India', maxJobs = 5 } = req.body;
    const user = await User.findById(userId);

    if (!user?.linkedinBotEmail || !user?.linkedinBotPassword)
      return res.status(400).json({ message: 'No LinkedIn credentials. Save in Bot Settings → Setup.' });
    if (!user.resumePath)
      return res.status(400).json({ message: 'No resume uploaded. Upload in Bot Settings → Auto-Apply first.' });

    const email = user.linkedinBotEmail;
    const password = decrypt(user.linkedinBotPassword);

    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&f_AL=true`;

    const result = await runTinyFish(
      'https://www.linkedin.com/login',
      `Step 1: Login to LinkedIn with email "${email}" and password "${password}".
       Step 2: Go to this URL: ${searchUrl}
       Step 3: For each job card visible (up to ${maxJobs}):
         - Click on the job to open it
         - If there is an "Easy Apply" button, click it
         - In the application modal, click through all steps (Next, Review, Submit)
         - If asked for phone number, enter "9999999999"
         - After submitting, note the job title and company name
         - Close the modal and move to next job
       Step 4: Return JSON: {
         "applied": [{"title": "Job Title", "company": "Company Name"}],
         "count": number
       }`,
      180000 // 3 min timeout for job applications
    );

    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    const appliedJobs = parsed?.applied || [];

    // Save to DB
    for (const job of appliedJobs) {
      await User.findByIdAndUpdate(userId, {
        $push: { appliedJobs: { title: job.title, company: job.company, appliedAt: new Date() } }
      });
    }

    res.json({
      message: `✅ Applied to ${appliedJobs.length} job${appliedJobs.length !== 1 ? 's' : ''}!`,
      applied: appliedJobs,
    });
  } catch (err) {
    console.error('Auto-apply error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── Get My LinkedIn Posts ─────────────────────────────────────────────
router.get('/my-posts/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user?.linkedinBotEmail || !user?.linkedinBotPassword)
      return res.status(400).json({ message: 'No credentials saved.' });

    const email = user.linkedinBotEmail;
    const password = decrypt(user.linkedinBotPassword);

    const result = await runTinyFish(
      'https://www.linkedin.com/login',
      `Step 1: Login to LinkedIn with email "${email}" and password "${password}".
       Step 2: Go to: https://www.linkedin.com/in/me/recent-activity/shares/
       Step 3: Scroll down to load posts.
       Step 4: Find up to 10 recent posts. For each post collect:
         - Post text (first 200 characters)
         - Number of comments shown
         - Post URL (the permalink link)
         - Time posted
       Step 5: Return JSON: {
         "posts": [
           {"id": "1", "text": "post text...", "commentsCount": "5", "postUrl": "https://linkedin.com/...", "time": "2h ago"}
         ]
       }`
    );

    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    res.json({ posts: parsed?.posts || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Get Comments on a Post ────────────────────────────────────────────
router.post('/post-comments', async (req, res) => {
  try {
    const { userId, postUrl } = req.body;
    const user = await User.findById(userId);
    if (!user?.linkedinBotEmail || !user?.linkedinBotPassword)
      return res.status(400).json({ message: 'No credentials saved.' });

    const email = user.linkedinBotEmail;
    const password = decrypt(user.linkedinBotPassword);

    const result = await runTinyFish(
      'https://www.linkedin.com/login',
      `Step 1: Login to LinkedIn with email "${email}" and password "${password}".
       Step 2: Go to this post URL: ${postUrl}
       Step 3: Find all comments on the post. For each comment collect:
         - Author name
         - Comment text
         - Time posted
         - Index number (0, 1, 2...)
       Step 4: Return JSON: {
         "comments": [
           {"id": "comment_0", "index": 0, "author": "Name", "text": "comment text", "time": "1h ago"}
         ]
       }`
    );

    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    res.json({ comments: parsed?.comments || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Reply to a Comment ────────────────────────────────────────────────
router.post('/reply-comment', async (req, res) => {
  try {
    const { userId, postUrl, commentIndex, reply } = req.body;
    const user = await User.findById(userId);
    if (!user?.linkedinBotEmail || !user?.linkedinBotPassword)
      return res.status(400).json({ message: 'No credentials saved.' });

    const email = user.linkedinBotEmail;
    const password = decrypt(user.linkedinBotPassword);

    const result = await runTinyFish(
      'https://www.linkedin.com/login',
      `Step 1: Login to LinkedIn with email "${email}" and password "${password}".
       Step 2: Go to this post: ${postUrl}
       Step 3: Find comment number ${commentIndex} (0-indexed from the top).
       Step 4: Click the Reply button on that comment.
       Step 5: Type this reply in the reply box: "${reply}"
       Step 6: Click the Post/Submit button to send the reply.
       Step 7: Return JSON: { "success": true, "message": "Reply posted" }`
    );

    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    if (!parsed?.success) throw new Error('Reply may not have posted successfully');
    res.json({ message: '✅ Reply posted!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── AI Reply Suggestion ───────────────────────────────────────────────
router.post('/ai-reply', async (req, res) => {
  try {
    const { comment } = req.body;
    const reply = await generateAIReply(comment);
    res.json({ reply });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Upload Resume ─────────────────────────────────────────────────────
const resumeUpload = multer({ dest: 'uploads/resumes/', limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/upload-resume', resumeUpload.single('resume'), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    await User.findByIdAndUpdate(userId, {
      $set: { resumePath: req.file.path, resumeName: req.file.originalname }
    });
    res.json({ message: '✅ Resume uploaded!', filename: req.file.originalname });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch { }
    res.status(500).json({ message: err.message });
  }
});

// ── Credentials + Resume Status ───────────────────────────────────────
router.get('/credentials-status/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    res.json({
      hasCredentials: !!(user?.linkedinBotEmail && user?.linkedinBotPassword),
      resumeName: user?.resumeName || null,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Applied Jobs History ──────────────────────────────────────────────
router.get('/applied-jobs/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    res.json({ jobs: user?.appliedJobs || [] });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;