const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: 'dqgyxcpau',
  api_key: '184934868975626',
  api_secret: 'CBZzL0COtiDNZBIHIFJ8U-pKArA'
});

/**
 * Upload file to Cloudinary
 * @param {Buffer|String} file - File buffer or base64 string
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadToCloudinary = async (file, options = {}) => {
  try {
    const uploadOptions = {
      resource_type: 'auto', // Automatically detect image/video
      folder: 'onetapp-profiles',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'avi', 'webm'],
      transformation: [
        { quality: 'auto:good' }, // Optimize quality
        { fetch_format: 'auto' }  // Auto format optimization
      ],
      ...options
    };

    let uploadResult;
    
    if (typeof file === 'string' && file.startsWith('data:')) {
      // Handle base64 string
      uploadResult = await cloudinary.uploader.upload(file, uploadOptions);
    } else {
      // Handle file buffer
      uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        
        uploadStream.end(file);
      });
    }

    return {
      success: true,
      data: {
        publicId: uploadResult.public_id,
        url: uploadResult.url,
        secureUrl: uploadResult.secure_url,
        format: uploadResult.format,
        width: uploadResult.width,
        height: uploadResult.height,
        bytes: uploadResult.bytes,
        duration: uploadResult.duration, // for videos
        resourceType: uploadResult.resource_type
      }
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete file from Cloudinary
 * @param {String} publicId - Cloudinary public ID
 * @param {String} resourceType - 'image' or 'video'
 * @returns {Promise<Object>} Deletion result
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Generate optimized URL for different use cases
 * @param {String} publicId - Cloudinary public ID
 * @param {Object} options - Transformation options
 * @returns {String} Optimized URL
 */
const getOptimizedUrl = (publicId, options = {}) => {
  const defaultOptions = {
    width: 800,
    height: 600,
    crop: 'fill',
    quality: 'auto:good',
    format: 'auto'
  };
  
  return cloudinary.url(publicId, {
    ...defaultOptions,
    ...options
  });
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  getOptimizedUrl
}; 