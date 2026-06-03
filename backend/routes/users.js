const express = require('express');
const router = express.Router();
const {
  deleteUser,
  fetchAdminUsers,
  fetchUserByRnokpp,
  fetchUsers,
} = require('../controllers/userController');

router.get('/admin', fetchAdminUsers);
router.get('/', fetchUsers);
router.get('/:rnokpp', fetchUserByRnokpp);
router.delete('/:userRnokpp', deleteUser);

module.exports = router;
