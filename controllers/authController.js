const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
    const { email, password, role } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Please fill in all fields' });
    }
    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }
        user = await User.create({ email, password, role });
        const token = user.getSignedJwtToken();
        res.status(201).json({
            _id: user._id,
            email: user.email,
            role: user.role,
            token
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide email and password' });
    }
    try {
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        user.lastLogin = Date.now();
        await user.save();
        const token = user.getSignedJwtToken();
        res.json({
            _id: user._id,
            email: user.email,
            role: user.role,
            token
        });
    } catch (err) {
        res.status(500).json({ message: err.message, stack: err.stack });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({
            _id: user._id,
            email: user.email,
            role: user.role
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
}; 