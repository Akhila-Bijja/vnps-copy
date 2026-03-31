// server/routes/content.js
// Content Creator — TinyFish browser automation on chat.qwen.ai
// Video Gen + Image Gen via TinyFish→Qwen | TTS via Web Speech | Chat via OpenRouter

const router = require('express').Router();
const axios = require('axios');

const TINYFISH_KEY = process.env.TINYFISH_API_KEY;
const TINYFISH_URL = 'https://agent.tinyfish.ai/v1/automation/run';
const QWEN_EMAIL = process.env.QWEN_EMAIL || 'denebod604@cosdas.com';
const QWEN_PASSWORD = process.env.QWEN_PASSWORD || '313@Rohit';

const tfHeaders = () => ({
  'X-API-Key': TINYFISH_KEY,
  'Content-Type': 'application/json',
});

// ── Fix Qwen CDN domain ───────────────────────────────────────
const fixCdn = (url) => (url || '').replace('cdn.qwen.ai', 'cdn.qwenlm.ai');

// ── Extract any media URL from TinyFish response ──────────────
const extractMediaUrl = (data) => {
  const obj = data?.result || data;
  const str = JSON.stringify(obj);

  // Try known keys first
  const direct = obj?.download_url || obj?.video_url || obj?.image_url ||
    obj?.url || obj?.file_url || obj?.mp4_url || obj?.link ||
    obj?.output || obj?.media_url || obj?.source || obj?.src;
  if (direct) return fixCdn(direct);

  // CDN regex
  const cdn = str.match(/https:\/\/cdn\.qwenl?m?\.ai\/[^"\\]+/);
  if (cdn) return fixCdn(cdn[0]);

  // Any media file URL
  const media = str.match(/https:\/\/[^"\\]+\.(?:mp4|mp3|jpg|jpeg|png|webp|gif)[^"\\]*/i);
  if (media) return fixCdn(media[0]);

  return null;
};

// ── Extract page_url from TinyFish step 1 ────────────────────
const extractPageUrl = (data) => {
  const str = JSON.stringify(data);
  const match = str.match(/"page_url"\s*:\s*"([^"]+)"/);
  if (match) return match[1];
  return data?.result?.page_url || data?.page_url || 'https://chat.qwen.ai/';
};

// ─────────────────────────────────────────────────────────────
// POST /api/content/video
// Body: { prompt, aspectRatio }
// Step 1 of 2 — submits to Qwen, returns pageUrl for polling
// ─────────────────────────────────────────────────────────────
router.post('/video', async (req, res) => {
  try {
    const { prompt, aspectRatio = '16:9' } = req.body;
    if (!prompt) return res.status(400).json({ message: 'prompt is required' });

    const goal = `
1. Navigate to https://chat.qwen.ai/ and wait for full page load.
2. If not logged in, login with email: ${QWEN_EMAIL} and password: ${QWEN_PASSWORD}.
3. Wait for the main chat interface to fully load.
4. Find the + icon next to the chat input box at the bottom and click it.
5. In the dropdown that appears, click "Create Video".
6. On the right side of the Create Video area, find aspect ratio buttons: 1:1, 3:4, 4:3, 16:9, 9:16. Click "${aspectRatio}".
7. Click the text input box and type this exact prompt: ${prompt}
8. Click the send/submit button to start generation.
9. Do NOT wait for video to finish.
10. Return ONLY this JSON: {"page_url": "CURRENT_FULL_URL_OF_PAGE"}
`.trim();

    const { data } = await axios.post(TINYFISH_URL, {
      url: 'https://chat.qwen.ai/',
      goal,
      return_type: 'text',
      timeout: 300,
    }, { headers: tfHeaders() });

    const pageUrl = extractPageUrl(data);

    res.json({
      status: 'pending',
      pageUrl,
      message: '🎬 Video submitted! Ready in ~4 minutes.',
      waitMs: 240000,
    });
  } catch (err) {
    console.error('Video step1 error:', err.response?.data || err.message);
    res.status(500).json({ message: err.response?.data?.message || err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/content/video/result
// Body: { pageUrl }
// Step 2 — retrieves download URL from Qwen page
// ─────────────────────────────────────────────────────────────
router.post('/video/result', async (req, res) => {
  try {
    const { pageUrl } = req.body;
    if (!pageUrl) return res.status(400).json({ message: 'pageUrl is required' });

    const goal = `
1. If not logged in, login with email: ${QWEN_EMAIL} and password: ${QWEN_PASSWORD}.
2. This page shows a recently generated video.
3. Wait for the video generation to complete if still processing.
4. Once complete, locate the <video> element for the generated video.
5. Extract the 'src' attribute url from the <video> element.
6. Return ONLY this exact JSON: {"video_url": "THE_URL"}
`.trim();

    const { data } = await axios.post(TINYFISH_URL, {
      url: pageUrl,
      goal,
      return_type: 'text',
      timeout: 300,
    }, { headers: tfHeaders() });

    const videoUrl = extractMediaUrl(data);

    if (!videoUrl) {
      return res.json({ status: 'pending', message: 'Still generating, try again in 1 minute.' });
    }

    res.json({ status: 'completed', videoUrl });
  } catch (err) {
    console.error('Video result error:', err.response?.data || err.message);
    res.status(500).json({ message: err.response?.data?.message || err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/content/image
// Body: { prompt, aspectRatio }
// Step 1 — submits to Qwen, returns pageUrl for polling
// ─────────────────────────────────────────────────────────────
router.post('/image', async (req, res) => {
  try {
    const { prompt, aspectRatio = '1:1' } = req.body;
    if (!prompt) return res.status(400).json({ message: 'prompt is required' });

    const goal = `
1. Navigate to https://chat.qwen.ai/ and wait for full page load.
2. If not logged in, login with email: ${QWEN_EMAIL} and password: ${QWEN_PASSWORD}.
3. Wait for the main chat interface to fully load.
4. Find the + icon next to the chat input box at the bottom and click it.
5. In the dropdown that appears, click "Create Image".
6. On the right side of the Create Image area, find aspect ratio buttons: 1:1, 3:4, 4:3, 16:9, 9:16. Click "${aspectRatio}".
7. Click the text input box and type this exact prompt: ${prompt}
8. Click the send/submit button to generate the image.
9. Do NOT wait for image to finish generating.
10. Return ONLY this JSON: {"page_url": "CURRENT_FULL_URL_OF_PAGE"}
`.trim();

    const { data } = await axios.post(TINYFISH_URL, {
      url: 'https://chat.qwen.ai/',
      goal,
      return_type: 'text',
      timeout: 300,
    }, { headers: tfHeaders() });

    const pageUrl = extractPageUrl(data);

    res.json({
      status: 'pending',
      pageUrl,
      message: 'Image submitted! Ready in ~30 seconds.',
      waitMs: 35000,
    });
  } catch (err) {
    console.error('Image step1 error:', err.response?.data || err.message);
    res.status(500).json({ message: err.response?.data?.message || err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/content/image/result
// Body: { pageUrl }
// Step 2 — retrieves image URL from Qwen page
// ─────────────────────────────────────────────────────────────
router.post('/image/result', async (req, res) => {
  try {
    const { pageUrl } = req.body;
    if (!pageUrl) return res.status(400).json({ message: 'pageUrl is required' });

    const goal = `
1. If not logged in, login with email: ${QWEN_EMAIL} and password: ${QWEN_PASSWORD}.
2. This page shows a recently generated image.
3. Wait for the image generation to complete if still processing (up to 30 seconds).
4. Once the image is visible on screen, locate the <img> element for the generated image.
5. Extract the 'src' attribute URL from the <img> element. It should be a cdn.qwenlm.ai URL.
6. Return ONLY this exact JSON: {"image_url": "THE_EXACT_IMAGE_URL"}
`.trim();

    const { data } = await axios.post(TINYFISH_URL, {
      url: pageUrl,
      goal,
      return_type: 'text',
      timeout: 300,
    }, { headers: tfHeaders() });

    const imageUrl = extractMediaUrl(data);

    if (!imageUrl) {
      return res.json({ status: 'pending', message: 'Still generating, try again in 15 seconds.' });
    }

    res.json({ status: 'completed', imageUrl });
  } catch (err) {
    console.error('Image result error:', err.response?.data || err.message);
    res.status(500).json({ message: err.response?.data?.message || err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/content/tts
// Body: { text, voice }
// Formats text for Web Speech API (browser-native, free)
// ─────────────────────────────────────────────────────────────
router.post('/tts', async (req, res) => {
  try {
    const { text, voice = 'female' } = req.body;
    if (!text) return res.status(400).json({ message: 'text is required' });

    // Enhance text for natural speech via OpenRouter
    const { data } = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-2.5-flash-lite-preview-09-2025',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `Format this for clear ${voice} voice narration. Add natural "..." pauses. Return ONLY the formatted text:\n\n${text}`,
        }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    const formattedText = data?.choices?.[0]?.message?.content?.trim() || text;
    res.json({ formattedText, originalText: text });
  } catch {
    res.json({ formattedText: req.body.text, originalText: req.body.text });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/content/chat
// Body: { message, contentType, conversationHistory }
// AI content writing via OpenRouter
// ─────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const { message, contentType = 'caption', conversationHistory = [] } = req.body;
    if (!message) return res.status(400).json({ message: 'message is required' });

    const systemPrompts = {
      caption: 'You are an expert social media copywriter. Write engaging, viral captions with perfect hooks, emojis, and hashtags.',
      script: 'You are a professional video scriptwriter. Write compelling scripts with strong hooks, clear structure, and a powerful CTA.',
      blog: 'You are a professional blog writer. Write well-structured, SEO-friendly blog content with clear paragraphs.',
      linkedin: 'You are a LinkedIn content expert. Write professional yet personal posts that drive engagement.',
      tweet: 'You are a Twitter/X expert. Write punchy, viral tweets under 280 characters.',
      youtube: 'You are a YouTube SEO expert. Write optimized video descriptions with keywords and CTAs.',
    };

    const { data } = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-2.5-flash-lite-preview-09-2025',
        max_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompts[contentType] || systemPrompts.caption },
          ...conversationHistory.slice(-6),
          { role: 'user', content: message },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://synapsocial.vercel.app',
          'X-Title': 'SynapSocial',
        },
        timeout: 20000,
      }
    );

    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error('Empty AI response');
    res.json({ reply });
  } catch (err) {
    console.error('Content chat error:', err.response?.data || err.message);
    res.status(500).json({ message: err.response?.data?.message || err.message });
  }
});

module.exports = router;