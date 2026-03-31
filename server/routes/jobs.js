const router = require('express').Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const User = require('../models/User');

router.get('/scan/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // DEBUG — remove after fix
    console.log('=== JOB SCAN DEBUG ===');
    console.log('userId:', req.params.userId);
    console.log('permissions object:', JSON.stringify(user.permissions));
    console.log('autoApplyJobs value:', user.permissions?.autoApplyJobs);
    console.log('=====================');

    // Check toggle is ON
    if (!user.permissions?.autoApplyJobs) {
      return res.status(403).json({
        message: 'AUTO_APPLY_OFF',
        hint: 'Please enable the Auto-Apply Jobs toggle in Platforms → Permissions first!'
      });
    }

    // Check resume is uploaded
    if (!user.resumePath || !fs.existsSync(user.resumePath)) {
      return res.status(403).json({
        message: 'NO_RESUME',
        hint: 'Please upload your resume in Platforms → Permissions first!'
      });
    }

    let resumeText = '';
    const ext = path.extname(user.resumePath).toLowerCase();
    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(user.resumePath);
      const pdfData = await pdfParse(dataBuffer);
      resumeText = pdfData.text.slice(0, 1000);
    } else {
      resumeText = fs.readFileSync(user.resumePath, 'utf8').slice(0, 1000);
    }

    const aiRes = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-2.5-flash-lite-preview-09-2025',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `Based on this resume:\n${resumeText}\n\nExtract top 5 skills and suggest 5 relevant job titles to search for. Return ONLY JSON, no extra text: {"skills": [...], "jobTitles": [...], "keywords": "search keywords string"}`
        }]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'SynapSocial'
        }
      }
    );

    let aiData = { skills: [], jobTitles: [], keywords: 'software engineer' };
    try {
      const raw = aiRes.data.choices[0].message.content;
      const cleaned = raw.replace(/```json|```/g, '').trim();
      aiData = JSON.parse(cleaned);
    } catch (e) {
      console.log('AI parse error, using defaults');
    }

    // Use simple job title for better results
const searchQuery = aiData.jobTitles?.[0] || 'software engineer';
console.log('Searching jobs for:', searchQuery);

const serpRes = await axios.get('https://serpapi.com/search', {
  params: {
    engine: 'google_jobs',
    q: searchQuery,
    location: 'India',
    hl: 'en',
    api_key: process.env.SERP_API_KEY
  }
});

console.log('Jobs found:', serpRes.data.jobs_results?.length || 0);

    const jobs = (serpRes.data.jobs_results || []).slice(0, 8).map(job => ({
      title: job.title,
      company: job.company_name,
      location: job.location,
      via: job.via,
      description: job.description?.slice(0, 150) + '...',
      applyLink: job.related_links?.[0]?.link ||
        `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(job.title)}&location=India`,
      posted: job.detected_extensions?.posted_at || 'Recently'
    }));

    res.json({ skills: aiData.skills, jobTitles: aiData.jobTitles, jobs, resumeFound: true });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ message: 'Job scan error', error: err.message });
  }
});

module.exports = router;