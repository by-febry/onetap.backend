const asyncHandler = require('express-async-handler');
const Subscription = require('../models/subscriptionModel');
const logActivity = require('../services/logActivity');
const axios = require('axios');

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

    // Log the subscription creation activity
    await logActivity({
        user: req.user._id,
        action: 'Subscription Create',
        targetType: 'Subscription',
        targetId: createdSubscription._id,
        details: {
            email: createdSubscription.email,
            plan: createdSubscription.plan,
            billingPeriod: createdSubscription.billingPeriod,
            status: createdSubscription.status,
            requestReferenceNumber: createdSubscription.requestReferenceNumber,
            createdBy: req.user.username || req.user.email
        },
        ip: req.ip,
    });

    res.status(201).json(createdSubscription);
});

// @desc    Check payment status from Maya and update subscription
// @route   POST /api/subscriptions/check-payment-status
// @access  Public
const checkPaymentStatus = asyncHandler(async (req, res) => {
    const { requestReferenceNumber } = req.body;

    if (!requestReferenceNumber) {
        res.status(400);
        throw new Error('Request reference number is required.');
    }

    try {
        // Find the subscription
        const subscription = await Subscription.findOne({ requestReferenceNumber });
        
        if (!subscription) {
            res.status(404);
            throw new Error('Subscription not found.');
        }

        // Capture 'before' state for logging
        const before = {
            status: subscription.status,
            paymentId: subscription.paymentId,
            amount: subscription.amount,
            errorMessage: subscription.errorMessage
        };

        // Check payment status from Maya API
        const mayaResponse = await axios.get(
            `${process.env.MAYA_API_URL}/checkout/v1/checkouts/${requestReferenceNumber}`,
            {
                headers: {
                    'Authorization': `Basic ${Buffer.from(process.env.MAYA_PUBLIC_KEY + ':').toString('base64')}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const paymentStatus = mayaResponse.data.paymentStatus;
        let newStatus = 'pending';

        // Map Maya payment status to our status
        switch (paymentStatus) {
            case 'PAID':
                newStatus = 'success';
                break;
            case 'FAILED':
                newStatus = 'failed';
                break;
            case 'CANCELLED':
                newStatus = 'cancelled';
                break;
            default:
                newStatus = 'pending';
        }

        // Update subscription status if it has changed
        if (subscription.status !== newStatus) {
            subscription.status = newStatus;
            
            if (newStatus === 'success') {
                subscription.paymentId = mayaResponse.data.paymentId;
                subscription.amount = mayaResponse.data.totalAmount?.value;
                subscription.nextBillingDate = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)); // 30 days
            } else if (newStatus === 'failed') {
                subscription.errorMessage = mayaResponse.data.errorMessage || 'Payment failed';
            }
            
            await subscription.save();

            // Log the payment status change activity
            await logActivity({
                user: req.user?._id || null,
                action: 'Payment Status Update',
                targetType: 'Subscription',
                targetId: subscription._id,
                details: {
                    before,
                    after: {
                        status: subscription.status,
                        paymentId: subscription.paymentId,
                        amount: subscription.amount,
                        errorMessage: subscription.errorMessage
                    },
                    mayaPaymentStatus: paymentStatus,
                    requestReferenceNumber: subscription.requestReferenceNumber,
                    updatedBy: req.user?.username || req.user?.email || 'System'
                },
                ip: req.ip,
            });
        }

        res.status(200).json({
            success: true,
            subscription: {
                status: subscription.status,
                plan: subscription.plan,
                email: subscription.email,
                requestReferenceNumber: subscription.requestReferenceNumber,
                createdAt: subscription.createdAt,
                paymentStatus: paymentStatus
            }
        });

    } catch (error) {
        console.error('Check payment status error:', error);
        
        // If Maya API fails, return current subscription status
        const subscription = await Subscription.findOne({ requestReferenceNumber });
        if (subscription) {
            res.status(200).json({
                success: true,
                subscription: {
                    status: subscription.status,
                    plan: subscription.plan,
                    email: subscription.email,
                    requestReferenceNumber: subscription.requestReferenceNumber,
                    createdAt: subscription.createdAt,
                    paymentStatus: 'UNKNOWN'
                }
            });
        } else {
            res.status(404);
            throw new Error('Subscription not found.');
        }
    }
});

// @desc    Get subscription by reference number
// @route   GET /api/subscriptions/reference/:referenceNumber
// @access  Public
const getSubscriptionByReference = asyncHandler(async (req, res) => {
    const { referenceNumber } = req.params;

    const subscription = await Subscription.findOne({ requestReferenceNumber: referenceNumber });
    
    if (!subscription) {
        res.status(404);
        throw new Error('Subscription not found.');
    }

    res.status(200).json({
        success: true,
        subscription: {
            status: subscription.status,
            plan: subscription.plan,
            email: subscription.email,
            phone: subscription.phone,
            requestReferenceNumber: subscription.requestReferenceNumber,
            createdAt: subscription.createdAt,
            nextBillingDate: subscription.nextBillingDate,
            errorMessage: subscription.errorMessage
        }
    });
});

// @desc    Manually update subscription status (for immediate fixes)
// @route   PUT /api/subscriptions/update-status
// @access  Public
const updateSubscriptionStatus = asyncHandler(async (req, res) => {
    const { requestReferenceNumber, status, paymentId, amount } = req.body;

    if (!requestReferenceNumber || !status) {
        res.status(400);
        throw new Error('Request reference number and status are required.');
    }

    try {
        const subscription = await Subscription.findOne({ requestReferenceNumber });
        
        if (!subscription) {
            res.status(404);
            throw new Error('Subscription not found.');
        }

        // Capture 'before' state for logging
        const before = {
            status: subscription.status,
            paymentId: subscription.paymentId,
            amount: subscription.amount,
            errorMessage: subscription.errorMessage
        };

        // Update subscription status
        subscription.status = status;
        
        if (status === 'success' && paymentId) {
            subscription.paymentId = paymentId;
        }
        
        if (status === 'success' && amount) {
            subscription.amount = amount;
        }
        
        if (status === 'success') {
            subscription.nextBillingDate = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)); // 30 days
        }

        await subscription.save();

        // Log the manual subscription status update activity
        await logActivity({
            user: req.user?._id || null,
            action: 'Manual Subscription Update',
            targetType: 'Subscription',
            targetId: subscription._id,
            details: {
                before,
                after: {
                    status: subscription.status,
                    paymentId: subscription.paymentId,
                    amount: subscription.amount,
                    errorMessage: subscription.errorMessage
                },
                requestReferenceNumber: subscription.requestReferenceNumber,
                updatedBy: req.user?.username || req.user?.email || 'Admin Manual Update'
            },
            ip: req.ip,
        });

        res.status(200).json({
            success: true,
            subscription: {
                status: subscription.status,
                plan: subscription.plan,
                email: subscription.email,
                requestReferenceNumber: subscription.requestReferenceNumber,
                createdAt: subscription.createdAt,
                paymentId: subscription.paymentId,
                amount: subscription.amount
            }
        });

    } catch (error) {
        console.error('Update subscription status error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = {
    getSubscriptions,
    createSubscription,
    checkPaymentStatus,
    getSubscriptionByReference,
    updateSubscriptionStatus
}; 