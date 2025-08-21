const express = require('express');
const {
  getAllUsersWithSubscriptions,
  updateUserSubscriptionTier,
  getUserSubscriptionInfo,
  bulkUpdateUserSubscriptions,
  autoSyncUserSubscription
} = require('../controllers/userSubscriptionController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Protect all routes
router.use(protect);
router.use(authorize('admin'));

// @desc    Get all users with subscription info
// @route   GET /api/users/subscriptions
router.get('/', getAllUsersWithSubscriptions);

// @desc    Get user subscription info
// @route   GET /api/users/subscriptions/:id
router.get('/:id', getUserSubscriptionInfo);

// @desc    Update user subscription tier
// @route   PUT /api/users/subscriptions/:id
router.put('/:id', updateUserSubscriptionTier);

// @desc    Bulk update user subscription tiers
// @route   PUT /api/users/subscriptions/bulk-update
router.put('/bulk-update', bulkUpdateUserSubscriptions);

// @desc    Auto-sync user subscription data from subscription records
// @route   POST /api/users/subscriptions/auto-sync/:id
router.post('/auto-sync/:id', autoSyncUserSubscription);

module.exports = router;
