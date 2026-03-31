const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'ai'] },
  text: String,
  showActions: Boolean,
  fileType: String,
  fileName: String,
  timestamp: { type: Date, default: Date.now }
});

const ChatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'New Chat' },
  messages: [MessageSchema]
}, { timestamps: true });

const ChatModel = mongoose.model('Chat', ChatSchema);
module.exports = ChatModel;