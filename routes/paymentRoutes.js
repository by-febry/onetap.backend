const express = require('express');
const {
	mayaCheckout,
	webhookSuccess,
	webhookFailure,
	webhookCancel,
	getSubscriptionStatus
} = require('../controllers/paymentController');

const router = express.Router();

// Maya checkout
router.post('/maya/checkout', mayaCheckout);

// Webhooks
router.post('/webhook/success', webhookSuccess);
router.post('/webhook/failure', webhookFailure);
router.post('/webhook/cancel', webhookCancel);

// Manual subscription status
router.get('/subscription/status/:referenceNumber', getSubscriptionStatus);

module.exports = router; 