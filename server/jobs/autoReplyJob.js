// server/jobs/autoReplyJob.js
const cron = require('node-cron');
const { google } = require('googleapis');
const axios = require('axios');
const User = require('../models/User');

const getYTOAuth = (user) => {
  const client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_CALLBACK_URL
  );
  client.setCredentials({
    access_token: user.youtubeToken,
    refresh_token: user.youtubeRefreshToken,
  });
  client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await User.findByIdAndUpdate(user._id, { $set: { youtubeToken: tokens.access_token } });
    }
  });
  return client;
};

const getGmailOAuth = (user) => {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GMAIL_CALLBACK_URL
  );
  client.setCredentials({
    access_token: user.gmailToken,
    refresh_token: user.gmailRefreshToken,
  });
  client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await User.findByIdAndUpdate(user._id, { $set: { gmailToken: tokens.access_token } });
    }
  });
  return client;
};

const generateAIReply = async (prompt) => {
  const res = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: 'google/gemini-2.5-flash-lite-preview-09-2025',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://synapsocial.vercel.app',
        'X-Title': 'SynapSocial',
      },
      timeout: 15000,
    }
  );
  return res.data.choices[0].message.content.trim();
};

// ── YouTube Auto-Reply ────────────────────────────────────────────────
const runYouTubeAutoReply = async () => {
  // ✅ FIX: Load ALL connected youtube users then filter in JS
  // (dot-notation query on nested schema can be unreliable)
  const users = await User.find({
    'connectedPlatforms.youtube': true,
    youtubeToken: { $exists: true, $ne: null },
    youtubeRefreshToken: { $exists: true, $ne: null },
  });

  const eligible = users.filter(u =>
    u.permissions?.youtubeReplyComments === true &&
    Array.isArray(u.youtubeAutomatedVideos) &&
    u.youtubeAutomatedVideos.length > 0
  );

  console.log(`[YT Auto-Reply] ${users.length} YT users total, ${eligible.length} with automation ON`);
  if (eligible.length === 0) {
    console.log('[YT] No users — either permission is OFF or no automated videos saved');
    return;
  }

  for (const user of eligible) {
    try {
      const oauthClient = getYTOAuth(user);
      const youtube = google.youtube({ version: 'v3', auth: oauthClient });

      for (const videoId of user.youtubeAutomatedVideos) {
        try {
          console.log(`[YT] Checking video ${videoId} for ${user.email}`);

          const commentsRes = await youtube.commentThreads.list({
            part: 'snippet',
            videoId,
            maxResults: 20,
            order: 'time',
          });

          const items = commentsRes.data.items || [];
          const tenMinsAgo = Date.now() - 10 * 60 * 1000;

          for (const item of items) {
            const comment = item.snippet.topLevelComment.snippet;
            const commentTime = new Date(comment.publishedAt).getTime();

            if (commentTime < tenMinsAgo) continue;
            if (item.snippet.totalReplyCount > 0) continue;
            if ((user.repliedYtCommentIds || []).includes(item.id)) continue;

            console.log(`[YT] Replying to: "${comment.textDisplay.slice(0, 60)}"`);

            const reply = await generateAIReply(
              `Write a short friendly YouTube comment reply (1-2 sentences, 1 emoji, no hashtags) to: "${comment.textDisplay}". Reply text only.`
            );

            await youtube.comments.insert({
              part: 'snippet',
              requestBody: { snippet: { parentId: item.id, textOriginal: reply } },
            });

            await User.findByIdAndUpdate(user._id, {
              $addToSet: { repliedYtCommentIds: item.id },
            });

            console.log(`✅ [YT] Replied: "${reply}"`);
            await new Promise((r) => setTimeout(r, 2000));
          }
        } catch (err) {
          console.error(`❌ [YT] Video ${videoId}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`❌ [YT] User ${user.email}: ${err.message}`);
    }
  }
};

// ── Gmail Auto-Reply ──────────────────────────────────────────────────
const runGmailAutoReply = async () => {
  const users = await User.find({
    'connectedPlatforms.gmail': true,
    gmailToken: { $exists: true, $ne: null },
    gmailRefreshToken: { $exists: true, $ne: null },
  });

  const eligible = users.filter(u =>
    u.permissions?.gmailAutoReply === true &&
    Array.isArray(u.gmailAutoReplyContacts) &&
    u.gmailAutoReplyContacts.length > 0
  );

  console.log(`[Gmail Auto-Reply] ${users.length} Gmail users total, ${eligible.length} with automation ON`);

  for (const user of eligible) {
    try {
      const oauthClient = getGmailOAuth(user);
      const gmail = google.gmail({ version: 'v1', auth: oauthClient });

      const listRes = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 10,
        q: 'in:inbox is:unread',
      });

      const messages = listRes.data.messages || [];
      console.log(`[Gmail] ${user.email}: ${messages.length} unread, contacts: ${user.gmailAutoReplyContacts}`);

      for (const msg of messages) {
        try {
          // ✅ FIX: Get metadata first (no 404)
          const meta = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject'],
          });

          const fromHeader = meta.data.payload.headers.find((h) => h.name === 'From')?.value || '';
          const fromEmail = fromHeader.match(/<(.+)>/)?.[1] || fromHeader.trim();
          const subject = meta.data.payload.headers.find((h) => h.name === 'Subject')?.value || '';

          const isAutoContact = user.gmailAutoReplyContacts.some(
            (c) =>
              fromEmail.toLowerCase().includes(c.toLowerCase()) ||
              c.toLowerCase().includes(fromEmail.toLowerCase())
          );

          if (!isAutoContact) {
            console.log(`[Gmail] Skip ${fromEmail}`);
            continue;
          }

          console.log(`[Gmail] Auto-replying to ${fromEmail} — ${subject}`);

          // ✅ FIX: Get full email separately with error handling
          let body = '';
          let threadId = meta.data.threadId;
          try {
            const full = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id,
              format: 'full',
            });
            threadId = full.data.threadId;
            const extractBody = (part) => {
              if (!part) return;
              if (part.mimeType === 'text/plain' && part.body?.data) {
                body = Buffer.from(part.body.data, 'base64').toString('utf8');
              } else if (part.parts) {
                part.parts.forEach(extractBody);
              }
            };
            extractBody(full.data.payload);
          } catch (bodyErr) {
            console.log(`[Gmail] Couldn't get body (${bodyErr.message}), using snippet`);
            body = meta.data.snippet || '';
          }

          const reply = await generateAIReply(
            `Write a short natural email reply.
From: ${fromHeader}
Subject: ${subject}
Email: ${body?.slice(0, 500)}

Write ONLY the reply body. No greeting, no sign-off. Keep it brief.`
          );

          // Send
          const emailLines = [
            `To: ${fromEmail}`,
            `Subject: Re: ${subject}`,
            'Content-Type: text/plain; charset=utf-8',
            '',
            reply,
          ];
          const raw = Buffer.from(emailLines.join('\r\n'))
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

          await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw, threadId },
          });

          // Mark as read
          await gmail.users.messages.modify({
            userId: 'me',
            id: msg.id,
            requestBody: { removeLabelIds: ['UNREAD'] },
          });

          console.log(`✅ [Gmail] Replied to ${fromEmail}: "${reply.slice(0, 60)}"`);
          await new Promise((r) => setTimeout(r, 2000));

        } catch (err) {
          console.error(`❌ [Gmail] Msg ${msg.id}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`❌ [Gmail] User ${user.email}: ${err.message}`);
    }
  }
};

// ── Start cron ────────────────────────────────────────────────────────
const startAutoReplyJobs = () => {
  console.log('🤖 Running auto-reply on startup...');
  runYouTubeAutoReply().catch(console.error);
  runGmailAutoReply().catch(console.error);

  // ✅ Every 1 minute for testing (change to */5 for production)
  cron.schedule('* * * * *', async () => {
    console.log(`🤖 [${new Date().toISOString()}] Cron tick...`);
    await runYouTubeAutoReply().catch(console.error);
    await runGmailAutoReply().catch(console.error);
    await runInstagramAutoReply().catch(console.error);
    console.log('✅ Cron done');
  });

  console.log('✅ Auto-reply cron started — every 1 min (testing mode)');
};

module.exports = { startAutoReplyJobs };

// ── Instagram Auto-Reply (added to cron) ─────────────────────────────
const runInstagramAutoReply = async () => {
  let IgApiClient, getIgClient, generateAIReply;
  try {
    const igBot = require('./routes/instagram-bot');
    getIgClient = igBot.getIgClient;
    generateAIReply = igBot.generateAIReply;
    ({ IgApiClient } = require('instagram-private-api'));
  } catch (e) {
    console.log('[IG Auto-Reply] instagram-private-api not installed, skipping');
    return;
  }

  const users = await User.find({
    igBotUsername: { $exists: true, $ne: null },
    igBotPassword: { $exists: true, $ne: null },
    igAutomatedPosts: { $exists: true, $not: { $size: 0 } },
  });

  const eligible = users.filter(u =>
    u.permissions?.instagramReplyComments === true &&
    Array.isArray(u.igAutomatedPosts) &&
    u.igAutomatedPosts.length > 0
  );

  console.log(`[IG Auto-Reply] ${users.length} IG users total, ${eligible.length} with automation ON`);

  for (const user of eligible) {
    try {
      const ig = await getIgClient(user);
      const fiveMinsAgo = Date.now() - 5 * 60 * 1000;

      for (const mediaId of user.igAutomatedPosts) {
        try {
          const commentFeed = ig.feed.mediaComments(mediaId);
          const comments = await commentFeed.items();
          const context = (user.igPostContexts || {})[mediaId] || '';

          for (const comment of comments) {
            const commentTime = comment.created_at * 1000;
            if (commentTime < fiveMinsAgo) continue;

            const alreadyReplied = (user.repliedIgCommentIds || []).includes(comment.pk);
            if (alreadyReplied) continue;

            // Skip own comments
            if (comment.user.username === user.igBotUsername) continue;

            console.log(`[IG] Replying to @${comment.user.username}: "${comment.text.slice(0, 50)}"`);

            const reply = await generateAIReply(comment.text, context);
            await ig.media.comment({
              mediaId,
              text: reply,
              replyToCommentId: comment.pk,
            });

            await User.findByIdAndUpdate(user._id, {
              $addToSet: { repliedIgCommentIds: comment.pk }
            });

            console.log(`✅ [IG Auto-Reply] Replied: "${reply}"`);
            await new Promise(r => setTimeout(r, 3000)); // rate limit
          }
        } catch (err) {
          console.error(`❌ [IG] Post ${mediaId}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`❌ [IG Auto-Reply] User ${user.igBotUsername}: ${err.message}`);
    }
  }
};