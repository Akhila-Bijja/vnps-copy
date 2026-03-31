const router = require('express').Router();
const axios = require('axios');
let googleTrends;
try { googleTrends = require('google-trends-api'); } catch (e) { googleTrends = null; }

router.get('/', async (req, res) => {
  try {
    const { niche = 'social media' } = req.query;

    let topics = [];
    const fetchedAt = new Date().toISOString();

    // ── PRIMARY ENGINE: Google News RSS (Fast, Niche-specific, Live) ──
    try {
      const gnewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(niche + ' news OR trends')}&hl=en-IN&gl=IN&ceid=IN:en`;
      const rssRes = await axios.get(gnewsUrl, { timeout: 8000 });

      const items = rssRes.data.match(/<title>(.+?)<\/title>/g) || [];
      // Skip item[0] because it's the feed title
      topics = items.slice(1).map(item => {
        let title = item.replace(/<title>/, '').replace(/<\/title>/, '').trim();
        // Remove CDATA wrapper if it exists (very common in RSS)
        title = title.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');

        // Clean up Google News source suffix (e.g. "Some news headline - The Hindu")
        const cleanTitle = title.split(' - ').slice(0, -1).join(' - ') || title;

        return {
          title: cleanTitle.length > 5 ? cleanTitle : title,
          traffic: '🔥 Live News Trend',
          relatedQueries: []
        };
      }).filter(t => t.title && t.title.length > 5 && !t.title.includes('Google News'));

      // Randomize slightly so rapid clicks feel dynamic & fresh!
      topics = topics.sort(() => 0.5 - Math.random());

      console.log(`✅ RSS News: got ${topics.length} topics for ${niche}`);
    } catch (err) {
      console.log('RSS failed:', err.message);
    }

    // ── FALLBACK ENGINE: Google Trends API (if RSS fails) ──
    if (topics.length < 3 && googleTrends) {
      try {
        const relatedRaw = await googleTrends.relatedQueries({
          keyword: niche,
          geo: 'IN',
          startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // last 7 days
        });
        const relatedData = JSON.parse(relatedRaw);
        const rising = relatedData?.default?.rankedList?.[0]?.rankedKeyword || [];
        const top = relatedData?.default?.rankedList?.[1]?.rankedKeyword || [];

        const combined = [...rising.slice(0, 6), ...top.slice(0, 4)];
        topics = combined.map(k => ({
          title: k.query,
          traffic: k.value === 'Breakout' ? '🚀 Breakout' : `${k.value}% interest`,
          relatedQueries: []
        }));
        console.log(`✅ Related queries: got ${topics.length} topics`);
      } catch (err) {
        console.log('Related queries failed:', err.message);
      }
    }

    // ── LAST RESORT FALLBACK ──────────────────────────────────────────
    if (topics.length < 3) {
      const now = new Date();
      topics = [
        { title: `${niche} taking over in ${now.getFullYear()}`, traffic: '100K+ views', relatedQueries: [] },
        { title: `Top 5 hidden ${niche} secrets`, traffic: '80K+ views', relatedQueries: [] },
        { title: `Why everyone is switching to ${niche}`, traffic: '60K+ views', relatedQueries: [] },
        { title: `${niche} tips the experts won't tell you`, traffic: '50K+ views', relatedQueries: [] },
        { title: `Mastering ${niche} step-by-step`, traffic: '40K+ views', relatedQueries: [] },
      ];
    }

    // Slice to exactly 10 topics to show
    topics = topics.slice(0, 10);

    // ── AI Content Ideas (Generated dynamically from real news!) ──
    let ideas = [];
    try {
      // Pick top 4 topics to base the AI hooks on
      const topicNames = topics.slice(0, 4).map(t => t.title).join(' | ');
      const aiResponse = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'google/gemini-2.5-flash-lite-preview-09-2025',
          max_tokens: 600,
          messages: [{
            role: 'user',
            content: `Give exactly 6 viral content ideas for a ${niche} creator.
Focus heavily on these specific breaking news topics: ${topicNames}

Reply ONLY with valid JSON array, no markdown:
[{"topic":"...","hook":"...","platform":"LinkedIn","angle":"..."},{"topic":"...","hook":"...","platform":"Instagram","angle":"..."},{"topic":"...","hook":"...","platform":"YouTube","angle":"..."},{"topic":"...","hook":"...","platform":"LinkedIn","angle":"..."},{"topic":"...","hook":"...","platform":"Instagram","angle":"..."},{"topic":"...","hook":"...","platform":"YouTube","angle":"..."}]`
          }]
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const raw = aiResponse.data.choices[0].message.content;
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) ideas = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.log('AI ideas error:', err.message);
    }

    // Fallback ideas if AI times out
    if (ideas.length === 0) {
      ideas = [
        { topic: topics[0]?.title || `${niche} news`, hook: `Look what just happened in ${niche}...`, platform: 'LinkedIn', angle: 'Industry news break' },
        { topic: topics[1]?.title || `${niche} reaction`, hook: `My honest reaction to ${niche} today`, platform: 'Instagram', angle: 'Hot take' },
        { topic: topics[2]?.title || `${niche} analysis`, hook: `Why everyone is talking about this ${niche} trend`, platform: 'YouTube', angle: 'Deep dive breakdown' },
        { topic: topics[3]?.title || `${niche} strategy`, hook: `How to capitalize on today's ${niche} news`, platform: 'LinkedIn', angle: 'Strategy guide' },
        { topic: topics[4]?.title || `${niche} drama`, hook: `The crazy truth about ${niche} right now`, platform: 'Instagram', angle: 'Controversial take' },
        { topic: topics[5]?.title || `${niche} future`, hook: `Where ${niche} is heading after today's news`, platform: 'YouTube', angle: 'Future prediction' },
      ];
    }

    // Notice we removed CACHING entirely! Every click generates a fresh request!
    res.json({ trending: topics, ideas, fetchedAt, source: 'live' });

  } catch (err) {
    console.error('Trends error:', err.message);
    res.status(500).json({ message: 'Trends error', error: err.message });
  }
});

module.exports = router;