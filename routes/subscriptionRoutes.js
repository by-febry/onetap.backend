const express = require('express');
const router = express.Router();
const { getSubscriptions, createSubscription } = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middleware/authMiddleware');

// @desc    Get all subscriptions & Create a new subscription
// @route   GET /api/subscriptions
// @route   POST /api/subscriptions
// @access  Private/Admin
router.route('/')
    .get(protect, authorize('admin'), getSubscriptions)
    .post(protect, authorize('admin'), createSubscription);

module.exports = router; 