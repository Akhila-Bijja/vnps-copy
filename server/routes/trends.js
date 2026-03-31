const router = require('express').Router();
const axios = require('axios');
let googleTrends;
try { googleTrends = require('google-trends-api'); } catch(e) { googleTrends = null; }

// Simple in-memory cache — refresh every 30 mins
const cache = {};
const CACHE_TTL = 30 * 60 * 1000;

const getCached = (key) => {
  const c = cache[key];
  if (c && Date.now() - c.time < CACHE_TTL) return c.data;
  return null;
};
const setCache = (key, data) => { cache[key] = { data, time: Date.now() }; };

router.get('/', async (req, res) => {
  try {
    const { niche = 'social media' } = req.query;
    const cacheKey = `trends_${niche}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    let topics = [];
    let fetchedAt = new Date().toISOString();

    // ── Method 1: google-trends-api (FREE, no key needed) ──────────────
    if (googleTrends) {
      try {
        // Real-time trending searches in India
        const trendingRaw = await googleTrends.dailyTrends({ geo: 'IN' });
        const trendingData = JSON.parse(trendingRaw);
        const trendingDays = trendingData?.default?.trendingSearchesDays || [];
        const allTrends = trendingDays[0]?.trendingSearches || [];

        topics = allTrends.slice(0, 10).map(t => ({
          title: t.title?.query || t.title || 'Trending',
          traffic: t.formattedTraffic || t.articles?.[0]?.source || 'Trending Now',
          relatedQueries: (t.relatedQueries || []).slice(0, 2).map(q => q.query)
        })).filter(t => t.title !== 'Trending');

        console.log(`✅ Google Trends: got ${topics.length} trending topics`);
      } catch (err) {
        console.log('Daily trends failed:', err.message);
      }

      // Method 1b: Interest over time for the niche if daily failed
      if (topics.length < 3) {
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
    }

    // ── Method 2: SerpAPI fallback (if key exists & method 1 failed) ──
    if (topics.length < 3 && process.env.SERP_API_KEY) {
      try {
        const response = await axios.get('https://serpapi.com/search', {
          params: {
            engine: 'google_trends_trending_now',
            frequency: 'realtime',
            geo: 'IN',
            api_key: process.env.SERP_API_KEY
          },
          timeout: 8000
        });
        const searches = response.data.realtime_searches || [];
        topics = searches.slice(0, 10).map(t => ({
          title: t.title || t.query || t.entity_names?.[0] || 'Trending',
          traffic: t.traffic || t.search_volume || 'Trending Now',
          relatedQueries: []
        })).filter(t => t.title !== 'Trending');
        console.log(`✅ SerpAPI: got ${topics.length} topics`);
      } catch (err) {
        console.log('SerpAPI failed:', err.message);
      }
    }

    // ── Method 3: RSS-based trending news (always works, no key) ──────
    if (topics.length < 3) {
      try {
        const rssFeeds = [
          `https://news.google.com/rss/search?q=${encodeURIComponent(niche)}&hl=en-IN&gl=IN&ceid=IN:en`,
          `https://feeds.feedburner.com/ndtvnews-tech-gadgets`,
        ];
        const rssRes = await axios.get(rssFeeds[0], { timeout: 6000 });
        const items = rssRes.data.match(/<title><!\[CDATA\[(.+?)\]\]><\/title>/g) ||
                      rssRes.data.match(/<title>(.+?)<\/title>/g) || [];
        topics = items.slice(1, 11).map((item, i) => {
          const title = item.replace(/<title><!\[CDATA\[/, '').replace(/\]\]><\/title>/, '')
                           .replace(/<title>/, '').replace(/<\/title>/, '').trim();
          return { title, traffic: 'Trending News', relatedQueries: [] };
        }).filter(t => t.title && t.title.length > 5);
        console.log(`✅ RSS News: got ${topics.length} topics`);
      } catch (err) {
        console.log('RSS failed:', err.message);
      }
    }

    // ── Final fallback ─────────────────────────────────────────────────
    if (topics.length < 3) {
      const now = new Date();
      topics = [
        { title: `${niche} trends ${now.getFullYear()}`, traffic: '100K+ searches', relatedQueries: [] },
        { title: `best ${niche} tools`, traffic: '80K+ searches', relatedQueries: [] },
        { title: `${niche} for beginners India`, traffic: '60K+ searches', relatedQueries: [] },
        { title: `${niche} tips & tricks`, traffic: '50K+ searches', relatedQueries: [] },
        { title: `how to master ${niche}`, traffic: '40K+ searches', relatedQueries: [] },
        { title: `${niche} vs traditional marketing`, traffic: '30K+ searches', relatedQueries: [] },
        { title: `${niche} salary India`, traffic: '25K+ searches', relatedQueries: [] },
        { title: `${niche} certification courses`, traffic: '20K+ searches', relatedQueries: [] },
        { title: `${niche} case studies 2025`, traffic: '15K+ searches', relatedQueries: [] },
        { title: `future of ${niche}`, traffic: '10K+ searches', relatedQueries: [] },
      ];
      fetchedAt = null; // Mark as fallback
    }

    // ── AI Content Ideas ───────────────────────────────────────────────
    let ideas = [];
    try {
      const topicNames = topics.slice(0, 5).map(t => t.title).join(', ');
      const aiResponse = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'meta-llama/llama-3.1-8b-instruct:free',
          max_tokens: 600,
          messages: [{
            role: 'user',
            content: `Give exactly 6 viral content ideas for a ${niche} creator in India.
Trending topics right now: ${topicNames}

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

    if (ideas.length === 0) {
      ideas = [
        { topic: topics[0]?.title || `${niche} trends`, hook: `Everyone is missing this about ${niche}...`, platform: 'LinkedIn', angle: 'Thought leadership' },
        { topic: topics[1]?.title || `${niche} tips`, hook: `I wish someone told me this about ${niche}`, platform: 'Instagram', angle: 'Educational carousel' },
        { topic: topics[2]?.title || `${niche} tools`, hook: `Top 5 ${niche} tools saving me 10hrs/week`, platform: 'YouTube', angle: 'Tool review' },
        { topic: topics[3]?.title || `${niche} mistakes`, hook: `Stop making these ${niche} mistakes in 2025`, platform: 'LinkedIn', angle: 'Cautionary tale' },
        { topic: topics[4]?.title || `${niche} income`, hook: `How I built income with ${niche} — full story`, platform: 'Instagram', angle: 'Income reveal' },
        { topic: topics[5]?.title || `${niche} roadmap`, hook: `Complete ${niche} roadmap for beginners`, platform: 'YouTube', angle: 'Step by step guide' },
      ];
    }

    const result = { trending: topics, ideas, fetchedAt, source: fetchedAt ? 'live' : 'fallback' };
    setCache(cacheKey, result);
    res.json(result);

  } catch (err) {
    console.error('Trends error:', err.message);
    res.status(500).json({ message: 'Trends error', error: err.message });
  }
});

module.exports = router;