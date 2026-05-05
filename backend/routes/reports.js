const express = require('express');
const router = express.Router();
const {
  createReport,
  fetchMyReports,
} = require('../controllers/reportController');

router.get('/mine', fetchMyReports);
router.post('/', createReport);

module.exports = router;
