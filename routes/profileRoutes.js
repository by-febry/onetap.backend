const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Test server endpoint (no auth required) - MUST BE FIRST
router.get('/test-server', (req, res) => {
  console.log('=== TEST SERVER ENDPOINT CALLED ===');
  console.log('Request headers:', req.headers);
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);
  
  res.json({ 
    message: 'Server is running', 
    timestamp: new Date().toISOString(),
    env: {
      JWT_SECRET_SET: !!process.env.JWT_SECRET,
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT
    }
  });
});

// Test authentication endpoint
router.get('/test-auth', protect, (req, res) => {
  res.json({ 
    message: 'Authentication successful', 
    user: req.user._id,
    timestamp: new Date().toISOString()
  });
});

// Protected routes
router.get('/', protect, profileController.getProfiles);
router.get('/admin/all', protect, profileController.getAllProfiles); // Admin endpoint for all profiles
router.get('/:id', protect, profileController.getProfileById);
router.post('/', protect, upload.single('profileImage'), profileController.createProfile);
router.put('/:id', protect, upload.single('profileImage'), profileController.updateProfile);
router.delete('/:id', protect, profileController.deleteProfile);

// Test route for debugging
router.put('/:id/test', protect, upload.single('profileImage'), profileController.testUpdate);

// Gallery image upload endpoint
router.post('/gallery/upload-image', protect, upload.single('image'), profileController.uploadGalleryImage);

module.exports = router; 