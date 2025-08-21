const express = require('express');
const { getSubscriptions, createSubscription, checkPaymentStatus, getSubscriptionByReference, updateSubscriptionStatus } = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// @desc    Get all subscriptions & Create a new subscription
// @route   GET /api/subscriptions
// @route   POST /api/subscriptions
// @access  Private/Admin
router.route('/')
    .get(protect, authorize('admin'), getSubscriptions)
    .post(protect, authorize('admin'), createSubscription);

// @desc    Check payment status from Maya
// @route   POST /api/subscriptions/check-payment-status
// @access  Public
router.post('/check-payment-status', checkPaymentStatus);

// @desc    Get subscription by reference number
// @route   GET /api/subscriptions/reference/:referenceNumber
// @access  Public
router.get('/reference/:referenceNumber', getSubscriptionByReference);

// @desc    Manually update subscription status
// @route   PUT /api/subscriptions/update-status
// @access  Public
router.put('/update-status', updateSubscriptionStatus);

module.exports = router; 