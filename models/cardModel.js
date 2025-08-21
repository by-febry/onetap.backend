const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cardUid: {
    type: String,
    unique: true,
    required: false // optional, as per your spec
  },
  label: {
    type: String,
    required: true
  },
  assignedUrl: {
    type: String,
    required: true
  },
  defaultProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profile',
    required: false // optional
  },
  status: {
    type: String,
    enum: ['active', 'disabled', 'lost'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Card', cardSchema); 