const router = require('express').Router();
const Chat = require('../models/Chat');
console.log('Chat model loaded:', typeof Chat, typeof Chat.find);

// ⚠️ IMPORTANT: specific routes MUST come before /:param routes

router.post('/new', async (req, res) => {
  try {
    const { userId } = req.body;
    console.log('Creating chat for userId:', userId);
    if (!userId) return res.status(400).json({ message: 'userId required' });
    const chat = await Chat.create({ userId, messages: [] });
    res.json({ chat });
  } catch (err) {
    console.error('Chat create error:', err.message);
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

router.post('/save', async (req, res) => {
  try {
    const { chatId, userId, message, title } = req.body;
    let chat;
    if (chatId) {
      chat = await Chat.findByIdAndUpdate(
        chatId,
        { $push: { messages: message }, ...(title && { title }) },
        { new: true }
      );
    } else {
      chat = await Chat.create({
        userId,
        title: title || 'New Chat',
        messages: [message]
      });
    }
    res.json({ chat });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

router.get('/messages/:chatId', async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    res.json({ chat });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

router.delete('/delete/:chatId', async (req, res) => {
  try {
    await Chat.findByIdAndDelete(req.params.chatId);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

// ⚠️ This MUST be last
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || userId === 'undefined') return res.json({ chats: [] });
    const chats = await Chat.find({ userId })
      .sort({ updatedAt: -1 })
      .select('_id title updatedAt');
    res.json({ chats });
  } catch (err) {
    console.error('Get chats error:', err.message);
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

router.post('/new', async (req, res) => {
  try {
    const { userId } = req.body;
    console.log('Creating chat for userId:', userId);
    if (!userId) return res.status(400).json({ message: 'userId required' });
    const chat = await Chat.create({ userId, messages: [] });
    res.json({ chat });
  } catch (err) {
    console.error('Chat create error:', err.message);
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

module.exports = router;