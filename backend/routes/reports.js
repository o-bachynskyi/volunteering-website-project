const express = require('express');
const router = express.Router();
const {
  createReport,
  fetchAdminReports,
  fetchMyReports,
} = require('../controllers/reportController');

router.get('/admin', fetchAdminReports);
router.get('/mine', fetchMyReports);
router.post('/', createReport);

module.exports = router;
