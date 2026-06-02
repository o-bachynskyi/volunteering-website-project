const express = require('express');
const router = express.Router();
const { fetchUserByRnokpp, fetchUsers } = require('../controllers/userController');

router.get('/', fetchUsers);
router.get('/:rnokpp', fetchUserByRnokpp);

module.exports = router;
