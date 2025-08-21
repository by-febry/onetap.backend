const express = require('express');
const router = express.Router();
const { upload, uploadFile, uploadMultipleFiles, deleteFile } = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware');

// Upload single file
router.post('/single', protect, upload.single('file'), uploadFile);

// Upload multiple files
router.post('/multiple', protect, upload.array('files', 10), uploadMultipleFiles);

// Delete file from Cloudinary
router.delete('/delete', protect, deleteFile);

module.exports = router; 