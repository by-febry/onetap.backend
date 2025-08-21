const express = require('express');
const router = express.Router();
const {
  createEvent,
  getEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  getEventAnalytics,
  getAllEventLocations
} = require('../controllers/eventController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

// Admin: Get all event locations
router.get('/locations', protect, authorize('admin'), getAllEventLocations);

// Event management routes
router.route('/')
  .post(createEvent)    // Create event
  .get(getEvents);      // Get user's events

router.route('/:id')
  .get(getEvent)        // Get specific event
  .put(updateEvent)     // Update event
  .delete(deleteEvent); // Delete event

// Event analytics route
router.get('/:id/analytics', getEventAnalytics);

module.exports = router; 