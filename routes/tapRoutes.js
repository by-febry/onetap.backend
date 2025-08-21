const express = require('express');
const router = express.Router();
const tapController = require('../controllers/tapController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Log a tap
router.post('/', tapController.logTap);

// Optionally: Log a user action (uncomment if you implement this)
router.post('/action', tapController.logUserAction);

// Admin: Get map points for admin map
router.get('/map-points', protect, authorize('admin'), tapController.getMapPoints);

module.exports = router; 