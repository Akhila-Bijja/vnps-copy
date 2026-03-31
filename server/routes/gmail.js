const router = require('express').Router();
const { google } = require('googleapis');
const User = require('../models/User');
const axios = require('axios');

const getOAuthClient = () => new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GMAIL_CALLBACK_URL || 'http://localhost:5000/api/gmail/callback'
);

// Connect Gmail
router.get('/connect', (req, res) => {
  const { userId } = req.query;
  req.session.userId = userId;
  req.session.save();
  const url = getOAuthClient().generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify'
    ],
    state: userId,
    prompt: 'consent'
  });
  res.redirect(url);
});

// Callback
router.get('/callback', async (req, res) => {
  const { code, state: userId } = req.query;
  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    const uid = userId || req.session.userId;
    await User.findByIdAndUpdate(uid, {
      $set: {
        'connectedPlatforms.gmail': true,
        'gmailToken': tokens.access_token,
        'gmailRefreshToken': tokens.refresh_token,
      }
    });
    res.redirect(`${process.env.CLIENT_URL}/dashboard?connected=gmail`);
  } catch (err) {
    console.error('Gmail callback error:', err.message);
    res.redirect(`${process.env.CLIENT_URL}/dashboard?error=gmail_failed`);
  }
});

// Disconnect
router.post('/disconnect', async (req, res) => {
  try {
    const { userId } = req.body;
    await User.findByIdAndUpdate(userId, {
      $set: { 'connectedPlatforms.gmail': false, 'gmailToken': null, 'gmailRefreshToken': null }
    });
    res.json({ message: 'Disconnected' });
  } catch (err) { res.status(500).json({ message: 'Error' }); }
});

// Get gmail client helper
const getGmailClient = async (userId) => {
  const user = await User.findById(userId);
  if (!user?.gmailToken) throw new Error('Gmail not connected');
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ access_token: user.gmailToken, refresh_token: user.gmailRefreshToken });
  // Auto-refresh token if needed
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await User.findByIdAndUpdate(userId, { $set: { 'gmailToken': tokens.access_token } });
    }
  });
  return { gmail: google.gmail({ version: 'v1', auth: oauth2Client }), user };
};

// Get inbox
router.get('/inbox/:userId', async (req, res) => {
  try {
    const { gmail } = await getGmailClient(req.params.userId);
    const listRes = await gmail.users.messages.list({
      userId: 'me', maxResults: 20,
      q: 'in:inbox -category:promotions -category:social'
    });
    const messages = listRes.data.messages || [];
    const emails = [];
    for (const msg of messages.slice(0, 15)) {
      const detail = await gmail.users.messages.get({
        userId: 'me', id: msg.id, format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date']
      });
      const headers = detail.data.payload.headers;
      emails.push({
        id: msg.id,
        threadId: detail.data.threadId,
        from: headers.find(h => h.name === 'From')?.value || '',
        subject: headers.find(h => h.name === 'Subject')?.value || '(no subject)',
        date: headers.find(h => h.name === 'Date')?.value || '',
        snippet: detail.data.snippet || '',
        isUnread: detail.data.labelIds?.includes('UNREAD')
      });
    }
    res.json({ emails });
  } catch (err) {
    console.error('Inbox error:', err.message);
    res.status(400).json({ message: err.message });
  }
});

// Get full email
router.get('/email/:userId/:emailId', async (req, res) => {
  try {
    const { gmail } = await getGmailClient(req.params.userId);
    const detail = await gmail.users.messages.get({ userId: 'me', id: req.params.emailId, format: 'full' });
    const headers = detail.data.payload.headers;
    let body = '';
    const extractBody = (part) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf8');
      } else if (part.parts) { part.parts.forEach(extractBody); }
    };
    extractBody(detail.data.payload);
    // Mark as read
    await gmail.users.messages.modify({ userId: 'me', id: req.params.emailId, requestBody: { removeLabelIds: ['UNREAD'] } });
    res.json({
      from: headers.find(h => h.name === 'From')?.value || '',
      subject: headers.find(h => h.name === 'Subject')?.value || '',
      date: headers.find(h => h.name === 'Date')?.value || '',
      body: body.slice(0, 3000),
      threadId: detail.data.threadId
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// AI reply suggestion
router.post('/ai-reply', async (req, res) => {
  try {
    const { subject, body, from } = req.body;
    const aiRes = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-2.5-flash-lite-preview-09-2025',
        max_tokens: 250,
        messages: [{
          role: 'user',
          content: `Write a short, natural email reply.
From: ${from}
Subject: ${subject}
Email: ${body?.slice(0, 600)}

Rules: Write ONLY the reply body. No "Subject:", no "Dear...", no sign-off. Just the reply text. Keep it concise and human.`
        }]
      },
      { headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://synapsocial.vercel.app' } }
    );
    res.json({ reply: aiRes.data.choices[0].message.content.trim() });
  } catch (err) { res.status(500).json({ message: 'AI error', error: err.message }); }
});

// Send email
router.post('/send', async (req, res) => {
  try {
    const { userId, to, subject, body, threadId } = req.body;
    const { gmail } = await getGmailClient(userId);
    const emailLines = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset=utf-8', '', body];
    const raw = Buffer.from(emailLines.join('\r\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const sendBody = { raw };
    if (threadId) sendBody.threadId = threadId;
    await gmail.users.messages.send({ userId: 'me', requestBody: sendBody });
    res.json({ message: 'Email sent! ✅' });
  } catch (err) {
    console.error('Send error:', err.message);
    res.status(500).json({ message: 'Send failed', error: err.message });
  }
});

// Save auto-reply contact (from AI reply popup checkbox)
router.post('/auto-reply/add', async (req, res) => {
  try {
    const { userId, fromEmail } = req.body;
    await User.findByIdAndUpdate(userId, {
      $addToSet: { gmailAutoReplyContacts: fromEmail }
    });
    res.json({ message: 'Auto-reply enabled for ' + fromEmail });
  } catch (err) { res.status(500).json({ message: 'Error' }); }
});

// Remove auto-reply contact
router.post('/auto-reply/remove', async (req, res) => {
  try {
    const { userId, fromEmail } = req.body;
    await User.findByIdAndUpdate(userId, {
      $pull: { gmailAutoReplyContacts: fromEmail }
    });
    res.json({ message: 'Removed' });
  } catch (err) { res.status(500).json({ message: 'Error' }); }
});

// Get auto-reply contacts
router.get('/auto-reply-contacts/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    res.json({ contacts: user?.gmailAutoReplyContacts || [] });
  } catch (err) { res.status(500).json({ message: 'Error' }); }
});

// Cron-style: check inbox and auto-reply to contacts
router.post('/auto-reply/run', async (req, res) => {
  try {
    const { userId } = req.body;
    const { gmail, user } = await getGmailClient(userId);
    if (!user.gmailAutoReplyContacts?.length) return res.json({ message: 'No auto-reply contacts' });

    const listRes = await gmail.users.messages.list({ userId: 'me', maxResults: 10, q: 'in:inbox is:unread' });
    const messages = listRes.data.messages || [];
    let replied = 0;

    for (const msg of messages) {
      const detail = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'metadata', metadataHeaders: ['From', 'Subject'] });
      const fromHeader = detail.data.payload.headers.find(h => h.name === 'From')?.value || '';
      const fromEmail = fromHeader.match(/<(.+)>/)?.[1] || fromHeader;
      const subject = detail.data.payload.headers.find(h => h.name === 'Subject')?.value || '';

      const isAutoContact = user.gmailAutoReplyContacts.some(c => fromEmail.includes(c) || c.includes(fromEmail));
      if (!isAutoContact) continue;

      // Get full email for AI
      const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
      let body = '';
      const extractBody = (part) => {
        if (part.mimeType === 'text/plain' && part.body?.data) body = Buffer.from(part.body.data, 'base64').toString('utf8');
        else if (part.parts) part.parts.forEach(extractBody);
      };
      extractBody(full.data.payload);

      // Generate AI reply
      const aiRes = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'google/gemini-2.5-flash-lite-preview-09-2025',
        max_tokens: 150,
        messages: [{ role: 'user', content: `Write a short natural email reply to: From: ${fromHeader}, Subject: ${subject}, Email: ${body?.slice(0, 400)}. Write ONLY the reply body, keep it brief.` }]
      }, { headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' } });

      const reply = aiRes.data.choices[0].message.content.trim();

      // Send reply
      const emailLines = [`To: ${fromEmail}`, `Subject: Re: ${subject}`, 'Content-Type: text/plain; charset=utf-8', '', reply];
      const raw = Buffer.from(emailLines.join('\r\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      await gmail.users.messages.send({ userId: 'me', requestBody: { raw, threadId: full.data.threadId } });

      // Mark as read
      await gmail.users.messages.modify({ userId: 'me', id: msg.id, requestBody: { removeLabelIds: ['UNREAD'] } });
      replied++;
    }

    res.json({ message: `Auto-replied to ${replied} emails` });
  } catch (err) {
    console.error('Auto-reply error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;