const express = require('express');
const router = express.Router();
const {
  createResponse,
  deleteResponse,
  fetchAdminResponses,
  fetchAcceptedRequests,
} = require('../controllers/responseController');

router.get('/admin', fetchAdminResponses);
router.get('/mine', fetchAcceptedRequests);
router.post('/', createResponse);
router.delete('/:responseId', deleteResponse);

module.exports = router;
