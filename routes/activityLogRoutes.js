const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/activityLogModel');

// GET /api/activity-logs?user=...&action=...&limit=...
router.get('/', async (req, res) => {
  const { user, action, limit = 100 } = req.query;
  const filter = {};
  if (user) filter.user = user;
  if (action) filter.action = action;
  const logs = await ActivityLog.find(filter)
    .sort({ timestamp: -1 })
    .limit(Number(limit))
    .populate('user', 'username email');
  res.json({ success: true, logs });
});

module.exports = router; 