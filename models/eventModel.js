const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Card',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  location: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    province: {
      type: String,
      required: true,
      trim: true
    },
    country: {
      type: String,
      required: true,
      trim: true
    },
    coordinates: {
      latitude: {
        type: Number,
        required: true
      },
      longitude: {
        type: Number,
        required: true
      }
    }
  },
  dateTime: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    },
    timezone: {
      type: String,
      default: 'Asia/Manila'
    }
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Index for efficient queries
eventSchema.index({ cardId: 1, status: 1 });
eventSchema.index({ userId: 1, status: 1 });
eventSchema.index({ 'dateTime.start': 1, 'dateTime.end': 1 });

// Virtual for checking if event is currently active
eventSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         this.dateTime.start <= now && 
         this.dateTime.end >= now;
});

// Method to get active events for a card
eventSchema.statics.getActiveEvent = function(cardId) {
  const now = new Date();
  return this.findOne({
    cardId: cardId,
    status: 'active',
    'dateTime.start': { $lte: now },
    'dateTime.end': { $gte: now }
  });
};

// Method to get upcoming events for a card
eventSchema.statics.getUpcomingEvents = function(cardId, limit = 5) {
  const now = new Date();
  return this.find({
    cardId: cardId,
    status: 'active',
    'dateTime.start': { $gt: now }
  }).sort({ 'dateTime.start': 1 }).limit(limit);
};

// Method to get past events for a card
eventSchema.statics.getPastEvents = function(cardId, limit = 10) {
  const now = new Date();
  return this.find({
    cardId: cardId,
    'dateTime.end': { $lt: now }
  }).sort({ 'dateTime.end': -1 }).limit(limit);
};

module.exports = mongoose.model('Event', eventSchema); 