const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional: Not all subscriptions might have a registered user initially
  },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  plan: { type: String, required: true },
  billingPeriod: { type: String, required: true },
  status: { type: String, default: 'pending' }, // pending, success, failed, cancelled
  requestReferenceNumber: { type: String, required: true },
  startDate: { type: Date, default: Date.now },
  nextBillingDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Subscription', subscriptionSchema); 