const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const logActivity = require('../services/logActivity');

// @desc    Get all users with subscription info
// @route   GET /api/users/subscriptions
// @access  Private/Admin
const getAllUsersWithSubscriptions = asyncHandler(async (req, res) => {
    const users = await User.find({}).select('-password');
    
    res.status(200).json({
        success: true,
        count: users.length,
        users: users
    });
});

// @desc    Update user subscription tier
// @route   PUT /api/users/subscriptions/:id
// @access  Private/Admin
const updateUserSubscriptionTier = asyncHandler(async (req, res) => {
    const { subscriptionTier, subscriptionStatus, subscriptionExpiryDate } = req.body;

    if (!subscriptionTier) {
        res.status(400);
        throw new Error('Subscription tier is required');
    }

    const user = await User.findById(req.params.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Capture 'before' state for logging
    const before = {
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiryDate: user.subscriptionExpiryDate
    };

    // Update subscription fields
    user.subscriptionTier = subscriptionTier;
    user.subscriptionStatus = subscriptionStatus || 'active';
    
    // Set expiry date based on tier and billing period
    if (subscriptionExpiryDate) {
        user.subscriptionExpiryDate = new Date(subscriptionExpiryDate);
    } else {
        // Auto-calculate expiry date (30 days from now for monthly, 365 days for yearly)
        const now = new Date();
        const isYearly = req.body.billingPeriod === 'yearly';
        const daysToAdd = isYearly ? 365 : 30;
        user.subscriptionExpiryDate = new Date(now.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
    }

    await user.save();

    // Log the subscription update activity
    await logActivity({
        user: req.user._id,
        action: 'Subscription Update',
        targetType: 'User',
        targetId: user._id,
        details: {
            before,
            after: {
                subscriptionTier: user.subscriptionTier,
                subscriptionStatus: user.subscriptionStatus,
                subscriptionExpiryDate: user.subscriptionExpiryDate
            },
            updatedBy: req.user.username || req.user.email
        },
        ip: req.ip,
    });

    res.status(200).json({
        success: true,
        user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            subscriptionTier: user.subscriptionTier,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionExpiryDate: user.subscriptionExpiryDate,
            role: user.role,
            status: user.status
        }
    });
});

// @desc    Get user subscription info
// @route   GET /api/users/subscriptions/:id
// @access  Private/Admin
const getUserSubscriptionInfo = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    res.status(200).json({
        success: true,
        user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            subscriptionTier: user.subscriptionTier,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionExpiryDate: user.subscriptionExpiryDate,
            role: user.role,
            status: user.status
        }
    });
});

// @desc    Bulk update user subscription tiers
// @route   PUT /api/users/subscriptions/bulk-update
// @access  Private/Admin
const bulkUpdateUserSubscriptions = asyncHandler(async (req, res) => {
    const { updates } = req.body; // Array of { userId, subscriptionTier, subscriptionStatus, subscriptionExpiryDate }

    if (!updates || !Array.isArray(updates)) {
        res.status(400);
        throw new Error('Updates array is required');
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
        try {
            const user = await User.findById(update.userId);
            
            if (!user) {
                errors.push({ userId: update.userId, error: 'User not found' });
                continue;
            }

            // Capture 'before' state for logging
            const before = {
                subscriptionTier: user.subscriptionTier,
                subscriptionStatus: user.subscriptionStatus,
                subscriptionExpiryDate: user.subscriptionExpiryDate
            };

            user.subscriptionTier = update.subscriptionTier;
            user.subscriptionStatus = update.subscriptionStatus || 'active';
            
            if (update.subscriptionExpiryDate) {
                user.subscriptionExpiryDate = new Date(update.subscriptionExpiryDate);
            }

            await user.save();
            
            // Log the bulk subscription update activity
            await logActivity({
                user: req.user._id,
                action: 'Bulk Subscription Update',
                targetType: 'User',
                targetId: user._id,
                details: {
                    before,
                    after: {
                        subscriptionTier: user.subscriptionTier,
                        subscriptionStatus: user.subscriptionStatus,
                        subscriptionExpiryDate: user.subscriptionExpiryDate
                    },
                    updatedBy: req.user.username || req.user.email,
                    bulkOperation: true
                },
                ip: req.ip,
            });
            
            results.push({
                userId: user._id,
                username: user.username,
                email: user.email,
                subscriptionTier: user.subscriptionTier,
                subscriptionStatus: user.subscriptionStatus
            });
        } catch (error) {
            errors.push({ userId: update.userId, error: error.message });
        }
    }

    res.status(200).json({
        success: true,
        updated: results,
        errors: errors,
        message: `Successfully updated ${results.length} users${errors.length > 0 ? `, ${errors.length} errors` : ''}`
    });
});

// @desc    Auto-sync user subscription data from subscription records
// @route   POST /api/users/subscriptions/auto-sync/:id
// @access  Private/Admin
const autoSyncUserSubscription = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Capture 'before' state for logging
  const before = {
    subscriptionTier: user.subscriptionTier,
    subscriptionStatus: user.subscriptionStatus,
    subscriptionExpiryDate: user.subscriptionExpiryDate
  };

  try {
    // Get all subscriptions to find matching email
    const Subscription = require('../models/subscriptionModel');
    const subscriptions = await Subscription.find({ email: user.email, status: 'success' })
      .sort({ createdAt: -1 })
      .limit(1);

    if (subscriptions.length > 0) {
      const latestSubscription = subscriptions[0];
      
      // Map plan names to tier names
      const planToTierMap = {
        'Starter Tap': 'starter_tap',
        'Pro Tap': 'pro_tap',
        'Power Tap': 'power_tap'
      };
      
      const tier = planToTierMap[latestSubscription.plan] || 'unsubscribed';
      
      // Calculate expiry date based on billing period and creation date
      if (latestSubscription.createdAt) {
        const createdDate = new Date(latestSubscription.createdAt);
        const isYearly = latestSubscription.billingPeriod === 'yearly';
        const daysToAdd = isYearly ? 365 : 30;
        const calculatedExpiry = new Date(createdDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
        
        // Check if subscription is still active
        const now = new Date();
        const isActive = calculatedExpiry > now;
        
        // Update user subscription data
        user.subscriptionTier = tier;
        user.subscriptionStatus = isActive ? 'active' : 'expired';
        user.subscriptionExpiryDate = calculatedExpiry;
        
        await user.save();
        
        // Log the auto-sync activity
        await logActivity({
            user: req.user._id,
            action: 'Subscription Auto-Sync',
            targetType: 'User',
            targetId: user._id,
            details: {
                before,
                after: {
                    subscriptionTier: user.subscriptionTier,
                    subscriptionStatus: user.subscriptionStatus,
                    subscriptionExpiryDate: user.subscriptionExpiryDate
                },
                syncedFrom: {
                    subscriptionId: latestSubscription._id,
                    plan: latestSubscription.plan,
                    billingPeriod: latestSubscription.billingPeriod,
                    createdAt: latestSubscription.createdAt
                },
                updatedBy: req.user.username || req.user.email
            },
            ip: req.ip,
        });
        
        res.status(200).json({
          success: true,
          message: 'User subscription data auto-synced successfully',
          user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            subscriptionTier: user.subscriptionTier,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionExpiryDate: user.subscriptionExpiryDate,
            role: user.role,
            status: user.status
          },
          syncedFrom: {
            subscriptionId: latestSubscription._id,
            plan: latestSubscription.plan,
            billingPeriod: latestSubscription.billingPeriod,
            createdAt: latestSubscription.createdAt
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Subscription data incomplete'
        });
      }
    } else {
      // No successful subscriptions found, set to unsubscribed
      user.subscriptionTier = 'unsubscribed';
      user.subscriptionStatus = 'expired';
      user.subscriptionExpiryDate = null;
      
      await user.save();
      
      // Log the auto-sync activity (set to unsubscribed)
      await logActivity({
          user: req.user._id,
          action: 'Subscription Auto-Sync',
          targetType: 'User',
          targetId: user._id,
          details: {
              before,
              after: {
                  subscriptionTier: user.subscriptionTier,
                  subscriptionStatus: user.subscriptionStatus,
                  subscriptionExpiryDate: user.subscriptionExpiryDate
              },
              syncedFrom: 'No active subscriptions found',
              updatedBy: req.user.username || req.user.email
          },
          ip: req.ip,
      });
      
      res.status(200).json({
        success: true,
        message: 'No active subscriptions found, set to unsubscribed',
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          subscriptionTier: user.subscriptionTier,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionExpiryDate: user.subscriptionExpiryDate,
          role: user.role,
          status: user.status
        }
      });
    }
  } catch (error) {
    console.error('Auto-sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to auto-sync subscription data',
      error: error.message
    });
  }
});

module.exports = {
    getAllUsersWithSubscriptions,
    updateUserSubscriptionTier,
    getUserSubscriptionInfo,
    bulkUpdateUserSubscriptions,
    autoSyncUserSubscription
};
