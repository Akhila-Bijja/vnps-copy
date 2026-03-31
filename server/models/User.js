const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: String,
  name: String,
  email: { type: String, unique: true },
  password: String,
  avatar: String,

  // LinkedIn
  linkedinToken: String,
  linkedinProfile: { id: String, name: String },
  linkedinBotEmail: String,
linkedinBotPassword: String,
appliedJobs: [{ title: String, company: String, appliedAt: Date }],

  // YouTube
  youtubeToken: String,
  youtubeRefreshToken: String,
  youtubeChannel: { id: String, name: String },
  youtubeAutomatedVideos: [String],
repliedYtCommentIds: [String],
youtubeVideoContexts: { type: Map, of: String }, // context per video

  // Instagram
  instagramToken: String,
  instagramAccountId: String,
  // Instagram Bot
igBotUsername: String,
igBotPassword: String,
igBotSession: String,
igAutomatedPosts: [String],
igPostContexts: { type: Map, of: String },
repliedIgCommentIds: [String],

  // Gmail
  gmailToken: String,
  gmailRefreshToken: String,
  gmailAutoReplyContacts: [String],

  // Resume
  resumePath: String,
  resumeName: String,

  connectedPlatforms: {
    linkedin: { type: Boolean, default: false },
    instagram: { type: Boolean, default: false },
    youtube: { type: Boolean, default: false },
    gmail: { type: Boolean, default: false },
  },

  permissions: {
    // LinkedIn
    linkedinAutoPost: { type: Boolean, default: false },
    linkedinReplyComments: { type: Boolean, default: false },
    linkedinSendDMs: { type: Boolean, default: false },
    autoApplyJobs: { type: Boolean, default: false },
    // Instagram
    instagramAutoPost: { type: Boolean, default: false },
    instagramReplyComments: { type: Boolean, default: false },
    // YouTube
    youtubeAutoPost: { type: Boolean, default: false },
    youtubeReplyComments: { type: Boolean, default: false },
    // Gmail
    gmailAutoReply: { type: Boolean, default: false },
    // Legacy
    autoPost: { type: Boolean, default: false },
    replyComments: { type: Boolean, default: false },
    sendDMs: { type: Boolean, default: false },
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);