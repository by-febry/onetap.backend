const asyncHandler = require('express-async-handler');
const Subscription = require('../models/subscriptionModel');

// @desc    Receive contact request and store record
// @route   POST /api/contact/request
// @access  Public
const createContactRequest = asyncHandler(async (req, res) => {
	const { email, phone, plan } = req.body;
	const requestReferenceNumber = `CONTACT-${Date.now()}`;

	await Subscription.create({
		email,
		phone,
		plan,
		status: 'contact_request',
		requestReferenceNumber
	});

	res.json({
		success: true,
		message: 'Contact request received. We will get back to you soon.',
		requestReferenceNumber
	});
});

module.exports = {
	createContactRequest
}; 