const ActivityLog = require('../models/activityLogModel');

async function logActivity({ user, action, targetType, targetId, details, ip }) {
  await ActivityLog.create({
    user,
    action,
    targetType,
    targetId,
    details: typeof details === 'object' ? JSON.stringify(details) : details,
    ip,
  });
}

module.exports = logActivity; 