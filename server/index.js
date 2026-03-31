require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('./config/passport');

const app = express();

app.use(helmet());
app.use(morgan('dev'));
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://synapsocial.vercel.app',
    /\.vercel\.app$/
  ],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
  secret: process.env.JWT_SECRET || 'synapsocial_secret_fallback',
  resave: true,
  saveUninitialized: true,
  cookie: {
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/instagram', require('./routes/instagram'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/trends', require('./routes/trends'));
app.use('/api/platforms', require('./routes/platforms'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/chats', require('./routes/chats'));
app.use('/api/platforms/youtube', require('./routes/youtube'));
app.use('/api/gmail', require('./routes/gmail'));
app.use('/api/linkedin-bot', require('./routes/linkedin-bot'));
app.use('/api/content', require('./routes/content'));
app.use('/api/instagram-bot', require('./routes/instagram-bot').router);
// Health check + keep-alive
app.get('/health', (req, res) => res.json({ status: 'alive', time: new Date().toISOString(), uptime: `${Math.floor(process.uptime() / 60)} mins` }));
app.get('/', (req, res) => res.json({ app: '🧠 SynapSocial API', status: '✅ Running', time: new Date().toISOString() }));


// ✅ ALL jobs start INSIDE .then() so DB is 100% connected first
mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log('✅ MongoDB connected');

  // Single unified cron job - runs every 5 mins
  const { startAutoReplyJobs } = require('./jobs/autoReplyJob');
  startAutoReplyJobs();

}).catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));