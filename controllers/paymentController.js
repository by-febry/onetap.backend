const asyncHandler = require('express-async-handler');
const Subscription = require('../models/subscriptionModel');
const { createMayaCheckout } = require('../services/paymentService');

// @desc    Initiate Maya checkout and create pending subscription
// @route   POST /api/payments/maya/checkout
// @access  Public
const mayaCheckout = asyncHandler(async (req, res) => {
	const { email, phone, plan, billingPeriod } = req.body;

	if (!email || !phone || !plan || !billingPeriod) {
		res.status(400);
		throw new Error('email, phone, plan, and billingPeriod are required');
	}

	const result = await createMayaCheckout({ email, phone, plan, billingPeriod });
	res.json(result);
});

// @desc    Payment success webhook
// @route   POST /api/payments/webhook/success
// @access  Public
const webhookSuccess = asyncHandler(async (req, res) => {
	const { requestReferenceNumber, paymentId, amount } = req.body;

	const subscription = await Subscription.findOneAndUpdate(
		{ requestReferenceNumber },
		{
			status: 'success',
			paymentId,
			amount,
			nextBillingDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000))
		},
		{ new: true }
	);

	if (!subscription) {
		return res.status(404).json({ error: 'Subscription not found' });
	}
	res.json({ success: true, subscription });
});

// @desc    Payment failure webhook
// @route   POST /api/payments/webhook/failure
// @access  Public
const webhookFailure = asyncHandler(async (req, res) => {
	const { requestReferenceNumber, errorMessage } = req.body;

	const subscription = await Subscription.findOneAndUpdate(
		{ requestReferenceNumber },
		{ status: 'failed', errorMessage: errorMessage || 'Payment failed' },
		{ new: true }
	);

	if (!subscription) {
		return res.status(404).json({ error: 'Subscription not found' });
	}
	res.json({ success: true, subscription });
});

// @desc    Payment cancel webhook
// @route   POST /api/payments/webhook/cancel
// @access  Public
const webhookCancel = asyncHandler(async (req, res) => {
	const { requestReferenceNumber } = req.body;

	const subscription = await Subscription.findOneAndUpdate(
		{ requestReferenceNumber },
		{ status: 'cancelled' },
		{ new: true }
	);

	if (!subscription) {
		return res.status(404).json({ error: 'Subscription not found' });
	}
	res.json({ success: true, subscription });
});

// @desc    Manual status check (moved from server.js)
// @route   GET /api/payments/subscription/status/:referenceNumber
// @access  Public
const getSubscriptionStatus = asyncHandler(async (req, res) => {
	const { referenceNumber } = req.params;

	const subscription = await Subscription.findOne({ requestReferenceNumber: referenceNumber });
	if (!subscription) {
		return res.status(404).json({ error: 'Subscription not found' });
	}

	res.json({
		success: true,
		subscription: {
			status: subscription.status,
			plan: subscription.plan,
			email: subscription.email,
			requestReferenceNumber: subscription.requestReferenceNumber,
			createdAt: subscription.createdAt
		}
	});
});

module.exports = {
	mayaCheckout,
	webhookSuccess,
	webhookFailure,
	webhookCancel,
	getSubscriptionStatus
}; 