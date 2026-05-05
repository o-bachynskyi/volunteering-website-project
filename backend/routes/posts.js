const express = require('express');
const router = express.Router();
const {
  createPost,
  deletePost,
  fetchPosts,
  updatePost,
} = require('../controllers/postController');

router.get('/', fetchPosts);
router.post('/', createPost);
router.patch('/:postId', updatePost);
router.delete('/:postId', deletePost);

module.exports = router;
