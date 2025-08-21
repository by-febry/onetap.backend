const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const Card = require('../models/cardModel');
const Profile = require('../models/profileModel');
const bcrypt = require('bcryptjs');
const logActivity = require('../services/logActivity');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
    const users = await User.find({});
    res.status(200).json({ success: true, count: users.length, users });
});

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (user) {
        res.status(200).json({ success: true, user });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Get current user profile
// @route   GET /api/users/profile/me
// @access  Private
const getCurrentUserProfile = asyncHandler(async (req, res) => {
    const profile = await Profile.findOne({ userId: req.user.id });
    res.status(200).json({ success: true, profile });
});

// @desc    Get user with their cards
// @route   GET /api/users/:id/cards
// @access  Private/Admin
const getUserWithCards = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    const cards = await Card.find({ userId: req.params.id });
    // Add stats for each card
    const cardsWithStats = await Promise.all(
      cards.map(async (card) => {
        const tapCount = await require('../models/tapLogModel').countDocuments({ cardId: card._id });
        const lastTap = await require('../models/tapLogModel').findOne({ cardId: card._id }).sort({ timestamp: -1 }).select('timestamp');
        // Conversion: save_contact_click or book_now_click
        const conversions = await require('../models/tapLogModel').countDocuments({
          cardId: card._id,
          actions: { $elemMatch: { type: { $in: ['save_contact_click', 'book_now_click'] } } }
        });
        // Engagement: any action except just card_view
        const engagements = await require('../models/tapLogModel').countDocuments({
          cardId: card._id,
          actions: { $elemMatch: { type: { $ne: 'card_view' } } }
        });
        return {
          _id: card._id,
          label: card.label,
          status: card.status,
          totalTaps: tapCount,
          lastTap: lastTap?.timestamp,
          conversions,
          conversionRate: tapCount > 0 ? ((conversions / tapCount) * 100).toFixed(1) : 0,
          engagements,
          engagementRate: tapCount > 0 ? ((engagements / tapCount) * 100).toFixed(1) : 0,
        };
      })
    );
    res.status(200).json({ 
        success: true, 
        user,
        cards: cardsWithStats,
        cardCount: cardsWithStats.length
    });
});

// @desc    Get current user's cards
// @route   GET /api/users/profile/cards
// @access  Private
const getCurrentUserCards = asyncHandler(async (req, res) => {
    const cards = await Card.find({ userId: req.user.id });
    res.status(200).json({ 
        success: true, 
        count: cards.length,
        cards 
    });
});

// @desc    Update current user profile
// @route   PUT /api/users/profile/me
// @access  Private
const updateCurrentUserProfile = asyncHandler(async (req, res) => {
    const profile = await Profile.findOne({ userId: req.user.id });
    
    if (!profile) {
        res.status(404);
        throw new Error('Profile not found');
    }

    // Capture 'before' state for logging
    const before = { ...profile.toObject() };

    const fieldsToUpdate = {
        fullName: req.body.fullName,
        jobTitle: req.body.jobTitle,
        company: req.body.company,
        bio: req.body.bio,
        contact: req.body.contact,
        socialLinks: req.body.socialLinks,
        website: req.body.website,
        profileImageId: req.body.profileImageId,
        qrUrl: req.body.qrUrl,
        lastUpdated: Date.now()
    };
    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(key => 
        fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );
    
    const updatedProfile = await Profile.findOneAndUpdate(
        { userId: req.user.id },
        fieldsToUpdate,
        { new: true, runValidators: true }
    );

    // Log the profile update activity
    await logActivity({
        user: req.user._id,
        action: 'Profile Update',
        targetType: 'Profile',
        targetId: updatedProfile._id,
        details: {
            before,
            after: updatedProfile.toObject(),
            updatedBy: req.user.username || req.user.email
        },
        ip: req.ip,
    });

    res.status(200).json({ success: true, profile: updatedProfile });
});

// @desc    Update user (Admin only)
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (user) {
        const before = { 
            username: user.username, 
            email: user.email, 
            role: user.role, 
            status: user.status,
            subscriptionTier: user.subscriptionTier,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionExpiryDate: user.subscriptionExpiryDate
        };
        
        user.username = req.body.username || user.username;
        user.email = req.body.email || user.email;
        user.role = req.body.role || user.role;
        user.status = req.body.status || user.status;
        
        const updatedUser = await user.save();
        
        await logActivity({
            user: req.user._id,
            action: 'User Edit',
            targetType: 'User',
            targetId: updatedUser._id,
            details: { 
                before, 
                after: { 
                    username: updatedUser.username, 
                    email: updatedUser.email, 
                    role: updatedUser.role, 
                    status: updatedUser.status,
                    subscriptionTier: updatedUser.subscriptionTier,
                    subscriptionStatus: updatedUser.subscriptionStatus,
                    subscriptionExpiryDate: updatedUser.subscriptionExpiryDate
                },
                updatedBy: req.user.username || req.user.email
            },
            ip: req.ip,
        });
        
        res.status(200).json({
            success: true,
            user: {
                _id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role,
                status: updatedUser.status
            }
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (user) {
        // Also delete all cards and profile associated with this user
        await Card.deleteMany({ userId: req.params.id });
        await Profile.deleteMany({ userId: req.params.id });
        await user.deleteOne();
        await logActivity({
            user: req.user._id,
            action: 'User Delete',
            targetType: 'User',
            targetId: req.params.id,
            details: { deletedUserId: req.params.id },
            ip: req.ip,
        });
        res.status(200).json({ success: true, message: 'User, profile, and associated cards removed' });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Create a new user (Admin only)
// @route   POST /api/users
// @access  Private/Admin
const createUser = asyncHandler(async (req, res) => {
    const { username, email, password, role, status } = req.body;
    if (!username || !email || !password || !role || !status) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    // Check for duplicate email
    const existing = await User.findOne({ email });
    if (existing) {
        return res.status(400).json({ message: 'User with this email already exists.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashedPassword, role, status });

    // Create a blank profile for the new user
    await Profile.create({
        userId: user._id,
        fullName: username || 'Unnamed User'
    });
    await logActivity({
        user: req.user._id,
        action: 'User Create',
        targetType: 'User',
        targetId: user._id,
        details: { username, email, role, status },
        ip: req.ip,
    });

    res.status(201).json({
        success: true,
        user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            status: user.status
        }
    });
});

module.exports = {
    getUsers,
    getUserById,
    getCurrentUserProfile,
    getUserWithCards,
    getCurrentUserCards,
    updateCurrentUserProfile,
    updateUser,
    deleteUser,
    createUser
}; 