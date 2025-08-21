const { uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinaryService');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  }
});

/**
 * Upload single file to Cloudinary
 */
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const file = req.file;
    
    // Upload to Cloudinary
    const result = await uploadToCloudinary(file.buffer, {
      public_id: `onetapp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image'
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Upload failed',
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: result.data
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: error.message
    });
  }
};

/**
 * Upload multiple files to Cloudinary
 */
const uploadMultipleFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided'
      });
    }

    const uploadPromises = req.files.map(async (file) => {
      const result = await uploadToCloudinary(file.buffer, {
        public_id: `onetapp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image'
      });
      
      return {
        originalName: file.originalname,
        ...result
      };
    });

    const results = await Promise.all(uploadPromises);
    const successfulUploads = results.filter(result => result.success);
    const failedUploads = results.filter(result => !result.success);

    res.json({
      success: true,
      message: `${successfulUploads.length} files uploaded successfully`,
      data: {
        successful: successfulUploads.map(upload => upload.data),
        failed: failedUploads.map(upload => upload.error)
      }
    });

  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: error.message
    });
  }
};

/**
 * Delete file from Cloudinary
 */
const deleteFile = async (req, res) => {
  try {
    const { publicId, resourceType = 'image' } = req.body;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }

    const result = await deleteFromCloudinary(publicId, resourceType);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Delete failed',
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'File deleted successfully',
      data: result.data
    });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Delete failed',
      error: error.message
    });
  }
};

module.exports = {
  upload,
  uploadFile,
  uploadMultipleFiles,
  deleteFile
}; 