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
  paymentId: { type: String }, // Maya payment ID
  amount: { type: Number }, // Payment amount in PHP
  errorMessage: { type: String }, // Error message if payment failed
  startDate: { type: Date, default: Date.now },
  nextBillingDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
subscriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Subscription', subscriptionSchema); 