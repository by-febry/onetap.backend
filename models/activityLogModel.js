const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // who did it
  action: { type: String, required: true }, // e.g. 'User Update', 'Card Delete'
  targetType: { type: String }, // e.g. 'User', 'Card', 'Profile'
  targetId: { type: mongoose.Schema.Types.ObjectId }, // id of the affected doc
  details: { type: String }, // summary or JSON string of what changed
  ip: { type: String },
});

module.exports = mongoose.model('ActivityLog', activityLogSchema); 