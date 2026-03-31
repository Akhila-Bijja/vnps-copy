const router = require('express').Router();
const passport = require('passport');
const { signup, login } = require('../controllers/authController');
const User = require('../models/User');

// Email auth
router.post('/signup', signup);
router.post('/login', login);

// Google OAuth
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Store user info in query params so frontend can save to localStorage
    const user = req.user;
    const userData = encodeURIComponent(JSON.stringify({
      id: user._id,
      name: user.name,
      email: user.email
    }));
    res.redirect(`${process.env.CLIENT_URL}/dashboard?googleUser=${userData}`);
  }
);

// Get current user
router.get('/me', (req, res) => {
  if (req.user) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ message: 'Not logged in' });
  }
});
router.get('/me', (req, res) => {
  if (req.user) {
    res.json({
      user: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
        connectedPlatforms: req.user.connectedPlatforms
      }
    });
  } else {
    res.status(401).json({ message: 'Not logged in' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.logout(() => res.redirect(process.env.CLIENT_URL));
});

// ─── ADD THESE 3 ROUTES TO server/routes/auth.js ─────────────────────────────
// Paste them BEFORE module.exports = router;

const bcrypt = require('bcryptjs');

// Update profile name
router.post('/update-profile', async (req, res) => {
  try {
    const { userId, name } = req.body;
    if (!userId || !name) return res.status(400).json({ message: 'Missing fields' });
    await User.findByIdAndUpdate(userId, { $set: { name: name.trim() } });
    res.json({ message: 'Profile updated', name: name.trim() });
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// Change password
router.post('/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !newPassword) return res.status(400).json({ message: 'Missing fields' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // If user has a password (not google-only), verify current password
    if (user.password && currentPassword) {
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(userId, { $set: { password: hashed } });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ message: 'Error changing password' });
  }
});

// Delete account
router.delete('/delete-account', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'Missing userId' });
    await User.findByIdAndDelete(userId);
    // Also delete chats if you have a Chat model
    try {
      const Chat = require('../models/Chat');
      await Chat.deleteMany({ userId });
    } catch (e) { /* Chat model may not exist */ }
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Delete account error:', err.message);
    res.status(500).json({ message: 'Error deleting account' });
  }
});

module.exports = router;