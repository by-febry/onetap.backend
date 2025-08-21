const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Dashboard statistics and analytics routes
router.get('/stats', protect, dashboardController.getDashboardStats);
router.get('/analytics', protect, dashboardController.getAnalytics);
router.get('/client-analytics', protect, dashboardController.getClientAnalytics);
router.get('/admin-analytics', protect, dashboardController.getAdminAnalytics);
router.get('/activity', protect, dashboardController.getRecentActivity);
router.get('/cards-summary', protect, dashboardController.getCardsSummary);
router.get('/profiles-summary', protect, dashboardController.getProfilesSummary);

// Leaderboard endpoints
router.get('/analytics/top-cards', protect, authorize('admin'), dashboardController.getTopCards);
router.get('/analytics/top-cities', protect, authorize('admin'), dashboardController.getTopCities);

module.exports = router; 