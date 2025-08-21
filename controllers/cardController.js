const asyncHandler = require('express-async-handler');
const Card = require('../models/cardModel');
const User = require('../models/userModel');
const Profile = require('../models/profileModel');
const TapLog = require('../models/tapLogModel');
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

// @desc    Get all cards for an admin
// @route   GET /api/cards
// @access  Private/Admin
const getCardsForAdmin = asyncHandler(async (req, res) => {
    const cards = await Card.find({}).populate('userId', 'username email');
    // Flatten userId to user object or string for frontend
    const cardsWithOwner = cards.map(card => {
      const cardObj = card.toObject();
      if (cardObj.userId && typeof cardObj.userId === 'object') {
        cardObj.owner = cardObj.userId.username || cardObj.userId.email || '';
        cardObj.ownerEmail = cardObj.userId.email || '';
        cardObj.userId = cardObj.userId._id ? cardObj.userId._id.toString() : cardObj.userId;
      } else {
        cardObj.owner = '';
        cardObj.ownerEmail = '';
      }
      return cardObj;
    });
    res.status(200).json({ success: true, count: cardsWithOwner.length, cards: cardsWithOwner });
});

// @desc    Get cards for current user
// @route   GET /api/cards/my-cards
// @access  Private
const getMyCards = asyncHandler(async (req, res) => {
    const cards = await Card.find({ userId: req.user.id });
    res.status(200).json({ success: true, count: cards.length, cards });
});

// @desc    Get a single card's public data
// @route   GET /api/cards/public/:id
// @access  Public
const getCardByIdPublic = asyncHandler(async (req, res) => {
    const card = await Card.findById(req.params.id).populate('defaultProfileId');
    if (card) {
        // Return only public card data and profile info
        const publicCardData = {
            _id: card._id,
            label: card.label,
            assignedUrl: card.assignedUrl,
            status: card.status,
            createdAt: card.createdAt,
            profile: card.defaultProfileId || null
        };
        res.status(200).json({ success: true, card: publicCardData });
    } else {
        res.status(404);
        throw new Error('Card not found');
    }
});

// @desc    Get a single card's public data by cardUid
// @route   GET /api/cards/public/uid/:cardUid
// @access  Public
const getCardByUidPublic = asyncHandler(async (req, res) => {
    const card = await Card.findOne({ cardUid: req.params.cardUid }).populate('defaultProfileId');
    if (card) {
        const publicCardData = {
            _id: card._id,
            label: card.label,
            assignedUrl: card.assignedUrl,
            status: card.status,
            createdAt: card.createdAt,
            profile: card.defaultProfileId || null
        };
        res.status(200).json({ success: true, card: publicCardData });
    } else {
        res.status(404);
        throw new Error('Card not found');
    }
});

// @desc    Create a new card
// @route   POST /api/cards
// @access  Private
const createCard = asyncHandler(async (req, res) => {
    const { userId, cardUid, label, assignedUrl, defaultProfileId, status } = req.body;
    if (!label || !assignedUrl) {
        res.status(400);
        throw new Error('Label and assignedUrl are required');
    }
    if (cardUid) {
        const existingCard = await Card.findOne({ cardUid });
        if (existingCard) {
            res.status(400);
            throw new Error('Card UID already exists');
        }
    }
    // Allow admin to specify userId, otherwise use current user
    const cardUserId = (req.user.role === 'admin' && userId) ? userId : req.user.id;
    const card = await Card.create({ 
        userId: cardUserId, 
        cardUid, 
        label, 
        assignedUrl, 
        defaultProfileId, 
        status
    });
    await logActivity({
        user: req.user._id,
        action: 'Card Create',
        targetType: 'Card',
        targetId: card._id,
        details: { userId, cardUid, label, assignedUrl, defaultProfileId, status },
        ip: req.ip,
    });
    res.status(201).json({ success: true, card });
});

// @desc    Get card by ID for an admin
// @route   GET /api/cards/:id
// @access  Private/Admin
const getCardByIdForAdmin = asyncHandler(async (req, res) => {
    const card = await Card.findById(req.params.id).populate('userId', 'username email').populate('defaultProfileId');
    if (!card) {
        res.status(404);
        throw new Error('Card not found');
    }
    res.status(200).json({ success: true, card });
});

// @desc    Get card by ID for current user
// @route   GET /api/cards/my-cards/:id
// @access  Private
const getMyCardById = asyncHandler(async (req, res) => {
    const card = await Card.findOne({ 
        _id: req.params.id, 
        userId: req.user.id 
    }).populate('defaultProfileId');
    if (!card) {
        res.status(404);
        throw new Error('Card not found');
    }
    res.status(200).json({ success: true, card });
});

// @desc    Update card (Admin only)
// @route   PUT /api/cards/:id
// @access  Private/Admin
const updateCard = asyncHandler(async (req, res) => {
    const card = await Card.findById(req.params.id);
    if (card) {
        const allowedUpdates = ['cardUid', 'label', 'assignedUrl', 'defaultProfileId', 'status', 'userId'];
        const updateData = {};
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });
        const updatedCard = await Card.findByIdAndUpdate(
            req.params.id, 
            updateData, 
            { new: true, runValidators: true }
        ).populate('userId', 'username email').populate('defaultProfileId');
        
        // Format the response to match getCardsForAdmin
        const cardObj = updatedCard.toObject();
        if (cardObj.userId && typeof cardObj.userId === 'object') {
          cardObj.owner = cardObj.userId.username || cardObj.userId.email || '';
          cardObj.ownerEmail = cardObj.userId.email || '';
          cardObj.userId = cardObj.userId._id ? cardObj.userId._id.toString() : cardObj.userId;
        } else {
          cardObj.owner = '';
          cardObj.ownerEmail = '';
        }
        
        await logActivity({
            user: req.user._id,
            action: 'Card Update',
            targetType: 'Card',
            targetId: updatedCard._id,
            details: { before: card.toObject(), after: updatedCard.toObject() },
            ip: req.ip,
        });
        res.status(200).json({ success: true, card: cardObj });
    } else {
        res.status(404);
        throw new Error('Card not found');
    }
});

// @desc    Update my card
// @route   PUT /api/cards/my-cards/:id
// @access  Private
const updateMyCard = asyncHandler(async (req, res) => {
    const card = await Card.findOne({ 
        _id: req.params.id, 
        userId: req.user.id 
    });
    if (card) {
        const allowedUpdates = ['label', 'assignedUrl', 'defaultProfileId', 'status'];
        const updateData = {};
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });
        const updatedCard = await Card.findByIdAndUpdate(
            req.params.id, 
            updateData, 
            { new: true, runValidators: true }
        ).populate('defaultProfileId');
        res.status(200).json({ success: true, card: updatedCard });
    } else {
        res.status(404);
        throw new Error('Card not found');
    }
});

// @desc    Delete card (Admin only)
// @route   DELETE /api/cards/:id
// @access  Private/Admin
const deleteCard = asyncHandler(async (req, res) => {
    const card = await Card.findById(req.params.id);
    if (card) {
        await card.deleteOne();
        await logActivity({
            user: req.user._id,
            action: 'Card Delete',
            targetType: 'Card',
            targetId: req.params.id,
            details: { deletedCardId: req.params.id },
            ip: req.ip,
        });
        res.status(200).json({ success: true, message: 'Card removed' });
    } else {
        res.status(404);
        throw new Error('Card not found');
    }
});

// @desc    Delete my card
// @route   DELETE /api/cards/my-cards/:id
// @access  Private
const deleteMyCard = asyncHandler(async (req, res) => {
    const card = await Card.findOne({ 
        _id: req.params.id, 
        userId: req.user.id 
    });
    if (card) {
        await card.deleteOne();
        res.status(200).json({ success: true, message: 'Card removed' });
    } else {
        res.status(404);
        throw new Error('Card not found');
    }
});

// @desc    Get card, user, and profile info by cardUid (for dynamic NFC card)
// @route   GET /api/cards/dynamic/:cardUid
// @access  Public
const getCardUserProfileByUid = asyncHandler(async (req, res) => {
    const card = await Card.findOne({ cardUid: req.params.cardUid });
    if (!card) {
        res.status(404);
        throw new Error('Card not found');
    }
    const user = await User.findById(card.userId).select('-password');
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    let profile = null;
    if (card.defaultProfileId) {
        profile = await Profile.findById(card.defaultProfileId);
    } else {
        // Try to find a profile for the user
        profile = await Profile.findOne({ userId: user._id });
    }
        if (profile) {
      ensureProfileImageFormat(profile);
      
      // Process gallery items to ensure proper format
      if (profile.gallery && Array.isArray(profile.gallery)) {
        console.log('Processing gallery items:', profile.gallery);
        profile.gallery = profile.gallery.map(item => {
          console.log('Processing gallery item:', item);
          
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
            
            const processedItem = {
              ...item,
              url: item.url || item.secureUrl,
              type: itemType
            };
            console.log('Processed Cloudinary item:', processedItem);
            return processedItem;
          }
          
          // If item has base64 data (legacy), keep as is
          if (item.url && item.url.startsWith('data:')) {
            console.log('Legacy base64 item:', item);
            return item;
          }
          
          // If item has external URL (legacy support), set type based on URL
          if (item.url && (item.url.includes('youtube.com') || item.url.includes('vimeo.com') || item.url.includes('drive.google.com'))) {
            // Determine if it's a video based on URL
            let itemType = item.type || 'document';
            if (item.url.includes('youtube.com') || item.url.includes('vimeo.com')) {
              itemType = 'video';
            }
            const processedItem = {
              ...item,
              type: itemType
            };
            console.log('External URL item:', processedItem);
            return processedItem;
          }
          
          console.log('Unprocessed item:', item);
          return item;
        });
        console.log('Final processed gallery:', profile.gallery);
      }
    }
    
    res.status(200).json({
        success: true,
        card,
        user,
        profile
    });
});

// @desc    Get analytics for a single card
// @route   GET /api/cards/:id/analytics
// @access  Private/Admin
const getCardAnalytics = asyncHandler(async (req, res) => {
  const cardId = req.params.id;
  const { period = '30d' } = req.query;

  // Use 'new' for ObjectId
  const objectId = new (require('mongoose').Types.ObjectId)(cardId);

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  switch (period) {
    case '7d': startDate.setDate(endDate.getDate() - 7); break;
    case '30d': startDate.setDate(endDate.getDate() - 30); break;
    case '90d': startDate.setDate(endDate.getDate() - 90); break;
    default: startDate.setDate(endDate.getDate() - 30);
  }

  // Timeline (taps per day)
  const timeline = await TapLog.aggregate([
    { $match: { cardId: objectId, timestamp: { $gte: startDate, $lte: endDate } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  // Top cities
  const topCities = await TapLog.aggregate([
    { $match: { cardId: objectId, timestamp: { $gte: startDate, $lte: endDate }, 'geo.city': { $exists: true, $ne: null } } },
    { $group: { _id: '$geo.city', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  // Gallery engagement
  const galleryEngagement = await TapLog.aggregate([
    { $match: { cardId: objectId, actions: { $elemMatch: { type: 'gallery_item_click' } }, timestamp: { $gte: startDate, $lte: endDate } } },
    { $unwind: '$actions' },
    { $match: { 'actions.type': 'gallery_item_click' } },
    { $group: { _id: '$actions.label', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // Device breakdown
  const deviceData = await TapLog.aggregate([
    { $match: { cardId: objectId, timestamp: { $gte: startDate, $lte: endDate } } },
    { $addFields: { deviceType: { $cond: [ { $regexMatch: { input: '$userAgent', regex: /Mobile|Android|iPhone/i } }, 'Mobile', 'Desktop' ] } } },
    { $group: { _id: '$deviceType', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // Action distribution (for most common action)
  const actionDistribution = await TapLog.aggregate([
    { $match: { cardId: objectId, timestamp: { $gte: startDate, $lte: endDate }, 'actions.0': { $exists: true } } },
    { $unwind: '$actions' },
    { $group: { _id: '$actions.type', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // Recent activity
  const recentActivity = await TapLog.find({ cardId: objectId, timestamp: { $gte: startDate, $lte: endDate } })
    .sort({ timestamp: -1 })
    .limit(10)
    .select('timestamp geo actions userAgent');

  // Tap locations for map visualization
  const tapLogs = await TapLog.find({ cardId: objectId, timestamp: { $gte: startDate, $lte: endDate } })
    .select('geo.timestamp geo.latitude geo.longitude geo.city timestamp');
  const tapLocations = tapLogs
    .filter(tap => tap.geo && tap.geo.latitude && tap.geo.longitude)
    .map(tap => ({
      lat: tap.geo.latitude,
      lng: tap.geo.longitude,
      city: tap.geo.city,
      timestamp: tap.timestamp
    }));

  res.status(200).json({
    success: true,
    data: {
      timeline,
      topCities,
      galleryEngagement,
      deviceData,
      actionDistribution,
      recentActivity,
      tapLocations
    }
  });
});

// @desc    Get all tap logs for a card
// @route   GET /api/cards/:id/taplogs
// @access  Private/Admin
const getCardTapLogs = asyncHandler(async (req, res) => {
  const cardId = req.params.id;
  const TapLog = require('../models/tapLogModel');
  const logs = await TapLog.find({ cardId })
    .select('timestamp geo actions')
    .sort({ timestamp: -1 });
  res.status(200).json({ success: true, data: logs });
});

module.exports = {
    getCardsForAdmin,
    getMyCards,
    getCardByIdPublic,
    getCardByUidPublic,
    createCard,
    getCardByIdForAdmin,
    getMyCardById,
    updateCard,
    updateMyCard,
    deleteCard,
    deleteMyCard,
    getCardUserProfileByUid,
    getCardAnalytics,
    getCardTapLogs
}; 