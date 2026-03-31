const router = require('express').Router();
const axios = require('axios');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/resumes';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${req.query.userId}-resume${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

// Connect LinkedIn
router.get('/linkedin', (req, res) => {
  const { userId } = req.query;
  req.session.userId = userId;
  req.session.save();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: `${SERVER_URL}/api/platforms/linkedin/callback`,
    scope: 'profile email openid w_member_social',
    state: userId
  });
  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

// LinkedIn callback
router.get('/linkedin/callback', async (req, res) => {
  const { code, state: userId } = req.query;
  try {
    const tokenRes = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${SERVER_URL}/api/platforms/linkedin/callback`,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const accessToken = tokenRes.data.access_token;
    const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const profile = profileRes.data;
    const sessionUserId = userId || req.session.userId;
    await User.findByIdAndUpdate(sessionUserId, {
      $set: {
        'connectedPlatforms.linkedin': true,
        'linkedinToken': accessToken,
        'linkedinProfile.id': profile.sub,
        'linkedinProfile.name': profile.name
      }
    });
    res.redirect(`${CLIENT_URL}/dashboard?connected=linkedin`);
  } catch (err) {
    console.error('LinkedIn callback error:', err.response?.data || err.message);
    res.redirect(`${CLIENT_URL}/dashboard?error=linkedin_failed`);
  }
});

// Platform status
router.get('/status/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      platforms: {
        linkedin: user.connectedPlatforms?.linkedin || false,
        instagram: user.connectedPlatforms?.instagram || false,
        youtube: user.connectedPlatforms?.youtube || false,
        gmail: user.connectedPlatforms?.gmail || false,
        igBotUsername: user.igBotUsername || null,
      },
      permissions: {
        linkedinAutoPost: user.permissions?.linkedinAutoPost || false,
        linkedinReplyComments: user.permissions?.linkedinReplyComments || false,
        linkedinSendDMs: user.permissions?.linkedinSendDMs || false,
        autoApplyJobs: user.permissions?.autoApplyJobs || false,
        instagramAutoPost: user.permissions?.instagramAutoPost || false,
        instagramReplyComments: user.permissions?.instagramReplyComments || false,
        youtubeAutoPost: user.permissions?.youtubeAutoPost || false,
        youtubeReplyComments: user.permissions?.youtubeReplyComments || false,
        gmailAutoReply: user.permissions?.gmailAutoReply || false,
      },
      resumeName: user.resumeName || ''
    });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

// Save permissions
router.post('/permissions', async (req, res) => {
  try {
    const { userId, permissions } = req.body;
    await User.findByIdAndUpdate(userId, {
      $set: {
        'permissions.linkedinAutoPost': permissions.linkedinAutoPost || false,
        'permissions.linkedinReplyComments': permissions.linkedinReplyComments || false,
        'permissions.linkedinSendDMs': permissions.linkedinSendDMs || false,
        'permissions.autoApplyJobs': permissions.autoApplyJobs || false,
        'permissions.instagramAutoPost': permissions.instagramAutoPost || false,
        'permissions.instagramReplyComments': permissions.instagramReplyComments || false,
        'permissions.youtubeAutoPost': permissions.youtubeAutoPost || false,
        'permissions.youtubeReplyComments': permissions.youtubeReplyComments || false,
        'permissions.gmailAutoReply': permissions.gmailAutoReply || false,
      }
    });
    res.json({ message: 'Permissions updated' });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

// Upload resume
router.post('/resume', upload.single('resume'), async (req, res) => {
  try {
    const { userId } = req.query;
    await User.findByIdAndUpdate(userId, {
      $set: { 'resumePath': req.file.path, 'resumeName': req.file.originalname }
    });
    res.json({ message: 'Resume uploaded', filename: req.file.originalname });
  } catch (err) {
    res.status(500).json({ message: 'Upload error', error: err.message });
  }
});

// Disconnect platform
router.post('/disconnect', async (req, res) => {
  try {
    const { userId, platform } = req.body;
    await User.findByIdAndUpdate(userId, {
      $set: {
        [`connectedPlatforms.${platform}`]: false,
        [`${platform}Token`]: null
      }
    });
    res.json({ message: `${platform} disconnected` });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

module.exports = router;