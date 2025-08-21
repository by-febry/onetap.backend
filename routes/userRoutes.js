const express = require('express');
const router = express.Router();
const {
    getUsers,
    getUserById,
    getCurrentUserProfile,
    getUserWithCards,
    getCurrentUserCards,
    updateCurrentUserProfile,
    updateUser,
    deleteUser,
    createUser
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Admin routes
router.route('/')
    .get(protect, authorize('admin'), getUsers)
    .post(protect, authorize('admin'), createUser);

router.route('/:id')
    .get(protect, authorize('admin'), getUserById)
    .put(protect, authorize('admin'), updateUser)
    .delete(protect, authorize('admin'), deleteUser);

// Get user with their cards (Admin only)
router.route('/:id/cards')
    .get(protect, authorize('admin'), getUserWithCards);

// Current user routes
router.route('/profile/me')
    .get(protect, getCurrentUserProfile)
    .put(protect, updateCurrentUserProfile);

// Get current user's cards
router.route('/profile/cards')
    .get(protect, getCurrentUserCards);

module.exports = router; 