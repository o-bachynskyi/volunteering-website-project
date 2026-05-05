const express = require('express');
const router = express.Router();
const {
  createPost,
  deletePost,
  fetchPosts,
} = require('../controllers/postController');

router.get('/', fetchPosts);
router.post('/', createPost);
router.delete('/:postId', deletePost);

module.exports = router;
