const asyncHandler = require('express-async-handler');
const Subscription = require('../models/subscriptionModel');

// @desc    Get all subscriptions
// @route   GET /api/subscriptions
// @access  Private/Admin
const getSubscriptions = asyncHandler(async (req, res) => {
    const subscriptions = await Subscription.find({}).populate('user', 'email'); // Assuming a user is linked
    res.status(200).json({ subscriptions });
});

// @desc    Create a new subscription
// @route   POST /api/subscriptions
// @access  Private/Admin
const createSubscription = asyncHandler(async (req, res) => {
    const { email, phone, plan, billingPeriod, status } = req.body;

    // Basic validation
    if (!email || !plan || !billingPeriod) {
        res.status(400);
        throw new Error('Please provide email, plan, and billing period.');
    }

    const startDate = new Date();
    let nextBillingDate = new Date(startDate);

    if (billingPeriod === 'monthly') {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    } else if (billingPeriod === 'yearly') {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else {
        // Handle other billing periods or set a default if necessary
        nextBillingDate = null; // Or some other logic
    }

    const subscription = new Subscription({
        email,
        phone,
        plan,
        billingPeriod,
        status,
        startDate,
        nextBillingDate,
        requestReferenceNumber: `SUB-${Date.now()}` // Placeholder for request reference
    });

    const createdSubscription = await subscription.save();
    res.status(201).json(createdSubscription);
});

module.exports = {
    getSubscriptions,
    createSubscription,
}; 