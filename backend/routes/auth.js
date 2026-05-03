const express = require('express');
const router = express.Router();
const {
  getSessionUser,
  getUserProfile,
  loginUser,
  logoutUser,
  registerUser,
} = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.get('/session', getSessionUser);
router.get('/profile', getUserProfile);

module.exports = router;
