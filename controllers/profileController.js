const Profile = require('../models/profileModel');
const User = require('../models/userModel');
const mongoose = require('mongoose');
const logActivity = require('../services/logActivity');

// Helper to handle profile image data (supports both old base64 and new Cloudinary format)
function ensureProfileImageFormat(profile) {
  if (profile && profile.profileImage) {
    // If it's the old format with Buffer data, convert to base64 for backward compatibility
    if (profile.profileImage.data) {
      let buf = profile.profileImage.data;
      // Handle { type: 'Buffer', data: [...] }
      if (buf && typeof buf === 'object' && buf.type === 'Buffer' && Array.isArray(buf.data)) {
        buf = buf.data;
      }
      // Handle nested .data.data (BSON Binary)
      if (buf && typeof buf === 'object' && Array.isArray(buf.data)) {
        buf = buf.data;
      }
      // If still an object, try to convert to Buffer
      if (Array.isArray(buf)) {
        profile.profileImage.data = Buffer.from(buf).toString('base64');
      } else if (Buffer.isBuffer(buf)) {
        profile.profileImage.data = buf.toString('base64');
      } else if (typeof buf === 'string') {
        profile.profileImage.data = buf;
      } else {
        // Fallback: stringify and warn
        profile.profileImage.data = '';
        console.warn('Unknown profileImage.data format:', buf);
      }
    }
    
    // If it's the new Cloudinary format, ensure URL is available
    if (profile.profileImage.secureUrl && !profile.profileImage.url) {
      profile.profileImage.url = profile.profileImage.secureUrl;
    }
  }
}

// Helper to process gallery items and ensure proper format
function processGalleryItems(gallery) {
  if (!Array.isArray(gallery)) return gallery;
  
  return gallery.map(item => {
    // If item has Cloudinary data, ensure proper format
    if (item.publicId && item.secureUrl) {
      // Determine if it's a video based on URL or resource type
      let itemType = item.type || 'image';
      
      // Check if it's a Cloudinary video
      if (item.secureUrl.includes('/video/') || item.url?.includes('/video/')) {
        itemType = 'video';
      }
      
      // Check if it has duration (videos have duration)
      if (item.duration) {
        itemType = 'video';
      }
      
      return {
        ...item,
        url: item.url || item.secureUrl,
        type: itemType
      };
    }
    
    // If item has base64 data (legacy), keep as is
    if (item.url && item.url.startsWith('data:')) {
      return item;
    }
    
    // If item has external URL (legacy support), set type based on URL
    if (item.url && (item.url.includes('youtube.com') || item.url.includes('vimeo.com') || item.url.includes('drive.google.com'))) {
      // Determine if it's a video based on URL
      let itemType = item.type || 'document';
      if (item.url.includes('youtube.com') || item.url.includes('vimeo.com')) {
        itemType = 'video';
      }
      return {
        ...item,
        type: itemType
      };
    }
    
    return item;
  });
}

// Get all profiles
exports.getProfiles = async (req, res) => {
  try {
    const userId = req.user.id;
    const profiles = await Profile.find({ userId }).populate('userId', 'username email');
    profiles.forEach(ensureProfileImageFormat);
    
    res.json({
      success: true,
      data: profiles
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get all profiles (admin only - for admin dashboard)
exports.getAllProfiles = async (req, res) => {
  try {
    console.log('🔍 Admin getAllProfiles - Fetching all profiles...');
    const profiles = await Profile.find().populate('userId', 'username email');
    console.log(`🔍 Admin getAllProfiles - Found ${profiles.length} profiles:`, profiles.map(p => ({ id: p._id, name: p.fullName, userId: p.userId })));
    
    profiles.forEach(ensureProfileImageFormat);
    
    res.json({
      success: true,
      data: profiles
    });
  } catch (err) {
    console.error('🔍 Admin getAllProfiles - Error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get a single profile by ID
exports.getProfileById = async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id).populate('userId', 'username email');
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    ensureProfileImageFormat(profile);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a new profile
exports.createProfile = async (req, res) => {
  try {
    console.log('=== CREATE PROFILE START ===');
    console.log('req.user:', req.user);
    console.log('req.user._id:', req.user?._id);
    
    const {
      userId, fullName, jobTitle, company, bio, contactEmail, contactPhone, contactLocation,
      socialLinks, qrUrl,
      featuredLinks, gallery, recentActivity, verificationStatus
    } = req.body;
    
    console.log('Create Profile - Received socialLinks:', socialLinks);
    console.log('Create Profile - Request body:', req.body);
    
    // Validate required fields
    if (!userId || !fullName) {
      return res.status(400).json({ error: 'User ID and Full Name are required' });
    }
    
    // Check for valid MongoDB ObjectId for userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Test authentication
    if (!req.user || !req.user._id) {
      console.log('Authentication failed - req.user:', req.user);
      return res.status(401).json({ error: 'Authentication failed' });
    }
    
    // Parse socialLinks if it's a JSON string
    let parsedSocialLinks = {};
    if (socialLinks) {
      try {
        parsedSocialLinks = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks;
        console.log('Create Profile - Parsed socialLinks:', parsedSocialLinks);
      } catch (error) {
        console.error('Error parsing socialLinks:', error);
        return res.status(400).json({ error: 'Invalid socialLinks format' });
      }
    }
    
    const profile = new Profile({
      userId,
      fullName,
      jobTitle,
      company,
      bio,
      contact: {
        email: contactEmail,
        phone: contactPhone,
        location: contactLocation
      },
      socialLinks: parsedSocialLinks,
      qrUrl
    });
    
    console.log('Create Profile - Profile object before save:', profile);
    
    // Handle new fields (parse JSON if needed) with better error handling
    if (featuredLinks) {
      try {
        profile.featuredLinks = typeof featuredLinks === 'string' ? JSON.parse(featuredLinks) : featuredLinks;
      } catch (error) {
        console.error('Error parsing featuredLinks:', error);
        return res.status(400).json({ error: 'Invalid featuredLinks format' });
      }
    }
    if (gallery) {
      try {
        profile.gallery = typeof gallery === 'string' ? JSON.parse(gallery) : gallery;
      } catch (error) {
        console.error('Error parsing gallery:', error);
        return res.status(400).json({ error: 'Invalid gallery format' });
      }
    }
    if (recentActivity) {
      try {
        profile.recentActivity = typeof recentActivity === 'string' ? JSON.parse(recentActivity) : recentActivity;
      } catch (error) {
        console.error('Error parsing recentActivity:', error);
        return res.status(400).json({ error: 'Invalid recentActivity format' });
      }
    }
    if (verificationStatus) {
      try {
        profile.verificationStatus = typeof verificationStatus === 'string' ? JSON.parse(verificationStatus) : verificationStatus;
      } catch (error) {
        console.error('Error parsing verificationStatus:', error);
        return res.status(400).json({ error: 'Invalid verificationStatus format' });
      }
    }
    
    // Handle profile image (supports both Cloudinary and base64 formats)
    if (req.body.profileImage) {
      try {
        const imageData = typeof req.body.profileImage === 'string' 
          ? JSON.parse(req.body.profileImage) 
          : req.body.profileImage;
        
        // If it's Cloudinary format
        if (imageData.publicId && imageData.secureUrl) {
          profile.profileImage = {
            publicId: imageData.publicId,
            url: imageData.url || imageData.secureUrl,
            secureUrl: imageData.secureUrl,
            format: imageData.format,
            width: imageData.width,
            height: imageData.height,
            bytes: imageData.bytes
          };
        } else if (imageData.data) {
          // If it's base64 format (backward compatibility)
          profile.profileImage = {
            data: imageData.data,
            contentType: imageData.contentType || 'image/jpeg'
          };
        }
      } catch (error) {
        console.error('Error parsing profileImage:', error);
        return res.status(400).json({ error: 'Invalid profileImage format' });
      }
    }
    
    await profile.save();
    await logActivity({
      user: req.user?._id || 'unknown',
      action: 'Profile Create',
      targetType: 'Profile',
      targetId: profile._id,
      details: req.body,
      ip: req.ip,
    });
    console.log('Create Profile - Saved profile with socialLinks:', profile.socialLinks);
    ensureProfileImageFormat(profile);
    res.status(201).json(profile);
  } catch (err) {
    console.error('Create profile error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Test endpoint to see what data is being received
exports.testUpdate = async (req, res) => {
  console.log('=== TEST UPDATE ENDPOINT ===');
  console.log('Request body:', req.body);
  console.log('Request files:', req.file);
  console.log('All request headers:', req.headers);
  console.log('Content-Type:', req.headers['content-type']);
  res.json({ message: 'Test endpoint called', body: req.body });
};

// Update a profile
exports.updateProfile = async (req, res) => {
  try {
    console.log('=== UPDATE PROFILE START ===');
    console.log('Request params:', req.params);
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request body:', req.body);
    console.log('Request files:', req.file);
    console.log('req.user:', req.user);
    console.log('req.user._id:', req.user?._id);
    console.log('Authorization header:', req.headers.authorization);

    const {
      userId, fullName, jobTitle, company, bio, contactEmail, contactPhone, contactLocation,
      socialLinks, qrUrl,
      featuredLinks, gallery, recentActivity, verificationStatus
    } = req.body;

    console.log('Update Profile - Received socialLinks:', socialLinks);
    console.log('Update Profile - socialLinks type:', typeof socialLinks);
    console.log('Update Profile - Request body:', req.body);

    // Validate required fields
    if (!userId || !fullName) {
      return res.status(400).json({ error: 'User ID and Full Name are required' });
    }

    // Check for valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }
    
    // Test authentication
    if (!req.user || !req.user._id) {
      console.log('Authentication failed - req.user:', req.user);
      return res.status(401).json({ error: 'Authentication failed' });
    }
    
    const profile = await Profile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Capture 'before' state for logging
    const before = { ...profile.toObject() };

    console.log('Update Profile - Existing profile socialLinks:', profile.socialLinks);

    // Parse socialLinks if it's a JSON string
    let parsedSocialLinks = {};
    if (socialLinks !== undefined) {
      try {
        parsedSocialLinks = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks;
        console.log('Update Profile - Parsed socialLinks:', parsedSocialLinks);
      } catch (error) {
        console.error('Error parsing socialLinks:', error);
        return res.status(400).json({ error: 'Invalid socialLinks format' });
      }
    } else {
      console.log('Update Profile - socialLinks is undefined!');
    }

    // Store the existing image before updating other fields
    const existingImage = profile.profileImage;
    console.log('=== BEFORE FIELD UPDATES ===');
    console.log('Existing image before updates:', existingImage ? 'exists' : 'none');
    if (existingImage) {
      console.log('Existing image contentType:', existingImage.contentType);
      console.log('Existing image data length:', existingImage.data ? existingImage.data.length : 'none');
    }
    
    profile.userId = userId;
    profile.fullName = fullName;
    profile.jobTitle = jobTitle;
    profile.company = company;
    profile.bio = bio;
    profile.contact = {
      email: contactEmail,
      phone: contactPhone,
      location: contactLocation
    };
    profile.socialLinks = parsedSocialLinks;
    profile.qrUrl = qrUrl;
    profile.lastUpdated = Date.now();
    
    // Restore the existing image if no new one is uploaded
    if (!req.file && existingImage) {
      profile.profileImage = existingImage;
      console.log('Restored existing image after field updates');
      console.log('Image after restoration:', profile.profileImage ? 'exists' : 'none');
    } else if (!req.file && !existingImage) {
      console.log('No existing image to restore');
    }

    console.log('Update Profile - Profile object before save:', profile);

    // Handle new fields (parse JSON if needed) with better error handling
    if (featuredLinks !== undefined) {
      try {
        profile.featuredLinks = typeof featuredLinks === 'string' ? JSON.parse(featuredLinks) : featuredLinks;
      } catch (error) {
        console.error('Error parsing featuredLinks:', error);
        return res.status(400).json({ error: 'Invalid featuredLinks format' });
      }
    }
    if (gallery !== undefined) {
      try {
        const parsedGallery = typeof gallery === 'string' ? JSON.parse(gallery) : gallery;
        profile.gallery = processGalleryItems(parsedGallery);
        console.log('Gallery processed:', profile.gallery.length, 'items');
      } catch (error) {
        console.error('Error parsing gallery:', error);
        return res.status(400).json({ error: 'Invalid gallery format' });
      }
    }
    if (recentActivity !== undefined) {
      try {
        profile.recentActivity = typeof recentActivity === 'string' ? JSON.parse(recentActivity) : recentActivity;
      } catch (error) {
        console.error('Error parsing recentActivity:', error);
        return res.status(400).json({ error: 'Invalid recentActivity format' });
      }
    }
    if (verificationStatus !== undefined) {
      try {
        profile.verificationStatus = typeof verificationStatus === 'string' ? JSON.parse(verificationStatus) : verificationStatus;
      } catch (error) {
        console.error('Error parsing verificationStatus:', error);
      }
    }

    // Handle profile image (supports both Cloudinary and base64 formats)
    if (req.body.profileImage) {
      try {
        const imageData = typeof req.body.profileImage === 'string' 
          ? JSON.parse(req.body.profileImage) 
          : req.body.profileImage;
        
        // If it's Cloudinary format
        if (imageData.publicId && imageData.secureUrl) {
          profile.profileImage = {
            publicId: imageData.publicId,
            url: imageData.url || imageData.secureUrl,
            secureUrl: imageData.secureUrl,
            format: imageData.format,
            width: imageData.width,
            height: imageData.height,
            bytes: imageData.bytes
          };
          console.log('Profile image updated with Cloudinary data');
        } else if (imageData.data) {
          // If it's base64 format (backward compatibility)
          profile.profileImage = {
            data: imageData.data,
            contentType: imageData.contentType || 'image/jpeg'
          };
          console.log('Profile image updated with base64 data');
        }
      } catch (error) {
        console.error('Error parsing profileImage:', error);
        return res.status(400).json({ error: 'Invalid profileImage format' });
      }
    } else if (req.file) {
      // Handle file upload (legacy support)
      console.log('=== NEW IMAGE UPLOADED ===');
      console.log('File size:', req.file.size);
      console.log('File type:', req.file.mimetype);
      
      // Check file size (max 2MB)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (req.file.size > maxSize) {
        return res.status(400).json({ error: 'Image file size must be less than 2MB' });
      }

      // Check file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Only JPG, PNG, and GIF files are allowed' });
      }

      profile.profileImage = {
        data: req.file.buffer,
        contentType: req.file.mimetype
      };
      console.log('Profile image updated with new file');
    } else {
      // If no new image is provided, preserve the existing image
      console.log('=== NO NEW IMAGE UPLOADED ===');
      console.log('Existing profileImage before save:', profile.profileImage ? 'exists' : 'none');
      if (profile.profileImage) {
        console.log('Existing profileImage type:', typeof profile.profileImage);
        if (profile.profileImage.contentType) {
          console.log('Existing profileImage contentType:', profile.profileImage.contentType);
        }
        if (profile.profileImage.data) {
          console.log('Existing profileImage data length:', profile.profileImage.data.length);
        }
      }
      // DO NOT modify profile.profileImage - keep the existing one
    }

    await profile.save();
    
    // Debug: Check if image was preserved after save
    console.log('=== AFTER SAVE ===');
    console.log('Profile image after save:', profile.profileImage ? 'exists' : 'none');
    if (profile.profileImage) {
      console.log('Profile image contentType after save:', profile.profileImage.contentType);
      console.log('Profile image data length after save:', profile.profileImage.data ? profile.profileImage.data.length : 'none');
    }
    
    // Log before and after states
    await logActivity({
      user: req.user?._id || 'unknown',
      action: 'Profile Update',
      targetType: 'Profile',
      targetId: profile._id,
      details: { before, after: profile.toObject() },
      ip: req.ip,
    });
    console.log('Update Profile - Saved profile with socialLinks:', profile.socialLinks);
    console.log('=== UPDATE PROFILE END ===');
    
    // Debug: Fetch the profile again to see if image was actually saved
    const savedProfile = await Profile.findById(req.params.id);
    console.log('=== FETCHED AFTER SAVE ===');
    console.log('Saved profile image:', savedProfile.profileImage ? 'exists' : 'none');
    if (savedProfile.profileImage) {
      console.log('Saved profile image contentType:', savedProfile.profileImage.contentType);
      console.log('Saved profile image data length:', savedProfile.profileImage.data ? savedProfile.profileImage.data.length : 'none');
    }
    
    ensureProfileImageFormat(profile);
    res.json(profile);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete a profile
exports.deleteProfile = async (req, res) => {
  try {
    // Check for valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }
    const profile = await Profile.findById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    await profile.deleteOne();
    await logActivity({
      user: req.user?._id || 'unknown',
      action: 'Profile Delete',
      targetType: 'Profile',
      targetId: req.params.id,
      details: { deletedProfileId: req.params.id },
      ip: req.ip,
    });
    res.json({ success: true, message: 'Profile deleted' });
  } catch (err) {
    console.error('Error deleting profile:', err);
    res.status(500).json({ error: err.message });
  }
};

// Upload gallery image (for gallery/media section)
exports.uploadGalleryImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    
    // Use Cloudinary service to upload the file
    const { uploadToCloudinary } = require('../services/cloudinaryService');
    
    const result = await uploadToCloudinary(req.file.buffer, {
      public_id: `onetapp-gallery-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      resource_type: req.file.mimetype.startsWith('video/') ? 'video' : 'image'
    });

    if (!result.success) {
      return res.status(500).json({ 
        error: 'Upload failed', 
        details: result.error 
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (err) {
    console.error('Gallery upload error:', err);
    res.status(500).json({ error: err.message });
  }
}; 