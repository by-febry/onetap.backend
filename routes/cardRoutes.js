const express = require('express');
const router = express.Router();
const {
    getCardsForAdmin,
    getMyCards,
    getCardByIdPublic,
    getCardByUidPublic,
    createCard,
    getCardByIdForAdmin,
    getMyCardById,
    updateCard,
    updateMyCard,
    deleteCard,
    deleteMyCard,
    getCardUserProfileByUid,
    getCardAnalytics,
    getCardTapLogs
} = require('../controllers/cardController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes
router.route('/public/:id').get(getCardByIdPublic);
router.route('/public/uid/:cardUid').get(getCardByUidPublic);
router.route('/dynamic/:cardUid').get(getCardUserProfileByUid);

// Admin routes
router.route('/admin').get(protect, authorize('admin'), getCardsForAdmin);

// User card management routes
router.route('/my-cards')
    .get(protect, getMyCards)
    .post(protect, createCard);

router.route('/my-cards/:id')
    .get(protect, getMyCardById)
    .put(protect, updateMyCard)
    .delete(protect, deleteMyCard);

// Admin card management routes
router.route('/')
    .post(protect, authorize('admin'), createCard);

router.route('/:id')
    .get(protect, authorize('admin'), getCardByIdForAdmin)
    .put(protect, authorize('admin'), updateCard)
    .delete(protect, authorize('admin'), deleteCard);

router.route('/').get(protect, authorize('admin'), getCardsForAdmin);

// Card analytics drill-down (admin only)
router.get('/:id/analytics', protect, authorize('admin'), getCardAnalytics);

// Get all tap logs for a card (admin only)
router.get('/:id/taplogs', protect, authorize('admin'), getCardTapLogs);

module.exports = router;