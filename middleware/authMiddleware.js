const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

// Protect routes
exports.protect = async (req, res, next) => {
    console.log('=== AUTH MIDDLEWARE START ===');
    console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.log('Authorization header:', req.headers.authorization);
    
    let token;
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
        console.log('Token extracted:', token ? 'present' : 'missing');
    }
    if (!token) {
        console.log('No token provided');
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
    
    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not set in environment variables');
        console.error('Please create a .env file with JWT_SECRET=your-secret-key');
        return res.status(500).json({ 
            message: 'Server configuration error: JWT_SECRET not set',
            details: 'Please check your .env file and ensure JWT_SECRET is configured'
        });
    }
    
    try {
        console.log('Attempting to verify token...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token decoded successfully:', decoded);
        
        req.user = await User.findById(decoded.id).select('-password');
        console.log('User found:', req.user ? 'yes' : 'no');
        
        if (!req.user) {
            return res.status(401).json({ message: 'User not found' });
        }
        
        console.log('=== AUTH MIDDLEWARE SUCCESS ===');
        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

// Role-based access control middleware
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'User role not authorized' });
        }
        next();
    };
}; 