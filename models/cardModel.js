const mongoose = require('mongoose');

const cardSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    nfcId: {
      type: String,
      required: true,
      unique: true,
    },
    template: {
      type: String,
      required: true,
      default: 'default',
    },
    socialLinks: {
      linkedin: String,
      twitter: String,
      facebook: String,
      instagram: String,
    },
    website: String,
    bio: String,
    customFields: {
      type: Map,
      of: String,
    },
    analytics: {
      views: {
        type: Number,
        default: 0,
      },
      shares: {
        type: Number,
        default: 0,
      },
      lastViewed: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Card', cardSchema); 