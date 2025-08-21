const Card = require('../models/cardModel');
const Profile = require('../models/profileModel');
const TapLog = require('../models/tapLogModel');
const User = require('../models/userModel');
const Subscription = require('../models/subscriptionModel');

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get active cards count
    const activeCards = await Card.countDocuments({ 
      userId, 
      status: 'active' 
    });

    // Get total profiles count
    const totalProfiles = await Profile.countDocuments({ userId });

    // Get total views (from tap logs)
    const totalViews = await TapLog.countDocuments({
      cardId: { $in: await Card.find({ userId }).distinct('_id') }
    });

    // Get total taps (only user's cards)
    const totalTaps = await TapLog.countDocuments({
      cardId: { $in: await Card.find({ userId }).distinct('_id') }
    });

    // Get taps today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tapsToday = await TapLog.countDocuments({
      cardId: { $in: await Card.find({ userId }).distinct('_id') },
      timestamp: { $gte: today }
    });

    // Get user's subscription status
    const subscription = await Subscription.findOne({ user: userId });
    const subscriptionStatus = subscription ? subscription.status : 'none';

    res.status(200).json({
      success: true,
      data: {
        activeCards,
        totalProfiles,
        totalViews,
        totalTaps,
        tapsToday,
        subscriptionStatus
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get analytics data
exports.getAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '7d' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }

    // Get user's cards
    const userCards = await Card.find({ userId });
    const cardIds = userCards.map(card => card._id);

    // Get tap analytics
    const tapAnalytics = await TapLog.aggregate([
      {
        $match: {
          cardId: { $in: cardIds },
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get geographic data
    const geoData = await TapLog.aggregate([
      {
        $match: {
          cardId: { $in: cardIds },
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            country: "$geo.country",
            region: "$geo.region"
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get device data
    const deviceData = await TapLog.aggregate([
      {
        $match: {
          cardId: { $in: cardIds },
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$userAgent",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        period,
        tapAnalytics,
        geoData,
        deviceData,
        totalTaps: tapAnalytics.reduce((sum, item) => sum + item.count, 0),
        uniqueCountries: geoData.length,
        topCountries: geoData.slice(0, 5)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get comprehensive analytics for admin dashboard
exports.getAdminAnalytics = async (req, res) => {
  try {
    const { period = '7d', cardId } = req.query;

    console.log('🔍 Admin Analytics Request:', { period, cardId });

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }

    // If cardId is provided, filter all analytics to that specific card
    let cardFilter = {};
    let tapFilter = { timestamp: { $gte: startDate, $lte: endDate } };
    let selectedCard = null;
    
    if (cardId && cardId !== 'all') {
      // Validate that the card exists
      selectedCard = await Card.findById(cardId);
      if (!selectedCard) {
        return res.status(404).json({
          success: false,
          error: 'Card not found'
        });
      }
      cardFilter = { _id: cardId };
      tapFilter.cardId = cardId;
    }

    // Get overview metrics
    const totalUsers = cardId && cardId !== 'all' && selectedCard
      ? await User.countDocuments({ _id: selectedCard.userId, status: 'active' })
      : await User.countDocuments({ status: 'active' });
    const activeCards = await Card.countDocuments({ status: 'active', ...cardFilter });
    const totalViews = await TapLog.countDocuments(cardId && cardId !== 'all' ? { cardId } : {});
    const tapsToday = await TapLog.countDocuments({
      ...(cardId && cardId !== 'all' ? { cardId } : {}),
      timestamp: { $gte: new Date().setHours(0, 0, 0, 0) }
    });

    console.log('🔍 Overview Metrics:', { totalUsers, activeCards, totalViews, tapsToday });

    // Calculate conversion rate (views that led to save contact or book now)
    const totalViewsWithActions = await TapLog.countDocuments({
      ...(cardId && cardId !== 'all' ? { cardId } : {}),
      actions: {
        $elemMatch: {
          type: { $in: ['save_contact_click', 'book_now_click'] }
        }
      }
    });
    const conversionRate = totalViews > 0 ? ((totalViewsWithActions / totalViews) * 100).toFixed(1) : 0;

    // Calculate engagements (any action except just card_view)
    const totalEngagements = await TapLog.countDocuments({
      ...(cardId && cardId !== 'all' ? { cardId } : {}),
      actions: { $elemMatch: { type: { $ne: 'card_view' } } }
    });
    const engagementRate = totalViews > 0 ? ((totalEngagements / totalViews) * 100).toFixed(1) : 0;

    // Gallery item engagement breakdown
    const galleryEngagement = await TapLog.aggregate([
      {
        $match: {
          ...(cardId && cardId !== 'all' ? { cardId } : {}),
          actions: { $elemMatch: { type: 'gallery_item_click' } },
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: '$actions' },
      { $match: { 'actions.type': 'gallery_item_click' } },
      { $group: { _id: '$actions.label', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get geographic reach
    const uniqueCountries = await TapLog.distinct('geo.country', cardId && cardId !== 'all' ? { cardId } : {});
    const uniqueRegions = await TapLog.distinct('geo.region', cardId && cardId !== 'all' ? { cardId } : {});
    const geographicReach = uniqueCountries.filter(country => country).length;

    console.log('🔍 Conversion & Geographic:', { conversionRate, geographicReach });

    // Get timeline data
    const timelineData = await TapLog.aggregate([
      {
        $match: cardId && cardId !== 'all' ? tapFilter : { timestamp: { $gte: startDate, $lte: endDate } }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
          },
          views: { $sum: 1 },
          actions: {
            $sum: {
              $cond: [{ $gt: [{ $size: "$actions" }, 0] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    console.log('🔍 Timeline Data:', timelineData.length, 'entries');

    // Get geographic data
    const geographicData = await TapLog.aggregate([
      {
        $match: cardId && cardId !== 'all'
          ? { ...tapFilter, 'geo.country': { $exists: true, $ne: null } }
          : { 'geo.country': { $exists: true, $ne: null }, timestamp: { $gte: startDate, $lte: endDate } }
      },
      {
        $group: {
          _id: {
            country: '$geo.country',
            region: '$geo.region',
            city: '$geo.city'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    console.log('🔍 Geographic Data:', geographicData.length, 'locations');

    // Get device analytics
    const deviceData = await TapLog.aggregate([
      {
        $match: cardId && cardId !== 'all' ? tapFilter : { timestamp: { $gte: startDate, $lte: endDate } }
      },
      {
        $addFields: {
          deviceType: {
            $cond: [
              { $regexMatch: { input: '$userAgent', regex: /Mobile|Android|iPhone/i } },
              'Mobile',
              'Desktop'
            ]
          }
        }
      },
      {
        $group: {
          _id: '$deviceType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('🔍 Device Data:', deviceData);

    // Get action distribution
    const actionDistribution = await TapLog.aggregate([
      {
        $match: cardId && cardId !== 'all'
          ? { ...tapFilter, 'actions.0': { $exists: true } }
          : { 'actions.0': { $exists: true }, timestamp: { $gte: startDate, $lte: endDate } }
      },
      {
        $unwind: '$actions'
      },
      {
        $group: {
          _id: '$actions.type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('🔍 Action Distribution:', actionDistribution);

    // Calculate trends (compare with previous period)
    const previousStartDate = new Date(startDate);
    const previousEndDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - (endDate - startDate) / (1000 * 60 * 60 * 24));

    const previousPeriodViews = await TapLog.countDocuments({
      ...(cardId && cardId !== 'all' ? { cardId } : {}),
      timestamp: { $gte: previousStartDate, $lt: startDate }
    });

    const currentPeriodViews = await TapLog.countDocuments({
      ...(cardId && cardId !== 'all' ? { cardId } : {}),
      timestamp: { $gte: startDate, $lte: endDate }
    });

    const viewsTrend = previousPeriodViews > 0 
      ? (((currentPeriodViews - previousPeriodViews) / previousPeriodViews) * 100).toFixed(1)
      : 0;

    console.log('🔍 Trends:', { previousPeriodViews, currentPeriodViews, viewsTrend });

    const response = {
      success: true,
      data: {
        overview: {
          totalUsers,
          activeCards,
          totalViews,
          tapsToday,
          conversionRate: parseFloat(conversionRate),
          engagementRate: parseFloat(engagementRate),
          geographicReach,
          viewsTrend: parseFloat(viewsTrend)
        },
        timeline: timelineData,
        geographic: geographicData,
        devices: deviceData,
        actions: actionDistribution,
        galleryEngagement,
        period
      }
    };

    console.log('🔍 Final Response Overview:', response.data.overview);

    res.status(200).json(response);
  } catch (error) {
    console.error('❌ Admin Analytics Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get recent activity
exports.getRecentActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    // Get user's cards
    const userCards = await Card.find({ userId });
    const cardIds = userCards.map(card => card._id);

    // Get recent tap logs with actions
    const recentTaps = await TapLog.find({
      cardId: { $in: cardIds }
    })
    .populate('cardId', 'label')
    .sort({ timestamp: -1 })
    .limit(parseInt(limit));

    // Format activity data with detailed action information
    const activities = recentTaps.map(tap => {
      const cardLabel = tap.cardId?.label || 'Card';
      let title = `Card viewed: ${cardLabel}`;
      let description = tap.geo?.city ? 
        (tap.geo?.region && tap.geo.region !== tap.geo.country ? 
          `Viewed in ${tap.geo.city}, ${tap.geo.region}, ${tap.geo.country}` : 
          `Viewed in ${tap.geo.city}, ${tap.geo.country}`) : 
        'Card was viewed';
      let icon = 'FaEye';
      let color = 'text-blue-600';

      // Check if there are specific actions performed
      if (tap.actions && tap.actions.length > 0) {
        // Get the most recent action (last in the array)
        const lastAction = tap.actions[tap.actions.length - 1];
        
        console.log('Processing action:', lastAction);
        
        switch (lastAction.type) {
          case 'social_link_click':
            title = `Social link clicked: ${cardLabel}`;
            description = `Clicked: ${lastAction.label}`;
            icon = 'FaShare';
            color = 'text-purple-600';
            break;
          case 'featured_link_click':
            title = `Link clicked: ${cardLabel}`;
            description = `Clicked: ${lastAction.label}`;
            icon = 'FaLink';
            color = 'text-green-600';
            break;
          case 'book_now_click':
            title = `Meeting requested: ${cardLabel}`;
            description = `Book Now button clicked`;
            icon = 'FaCalendarCheck';
            color = 'text-indigo-600';
            break;
          case 'save_contact_click':
            title = `Contact saved: ${cardLabel}`;
            description = `Save Contact button clicked`;
            icon = 'FaUserPlus';
            color = 'text-indigo-600';
            break;
          case 'contact_downloaded':
            title = `Contact downloaded: ${cardLabel}`;
            description = `Contact information was downloaded`;
            icon = 'FaDownload';
            color = 'text-teal-600';
            break;
          case 'gallery_item_click':
            title = `Gallery viewed: ${cardLabel}`;
            description = `Viewed: ${lastAction.label}`;
            icon = 'FaImages';
            color = 'text-orange-600';
            break;
          case 'bio_expanded':
            title = `Bio expanded: ${cardLabel}`;
            description = `User expanded bio section`;
            icon = 'FaExpand';
            color = 'text-blue-600';
            break;
          case 'bio_collapsed':
            title = `Bio collapsed: ${cardLabel}`;
            description = `User collapsed bio section`;
            icon = 'FaCompress';
            color = 'text-blue-600';
            break;
          case 'card_view':
          default:
            title = `Card viewed: ${cardLabel}`;
            description = tap.geo?.city ? 
              (tap.geo?.region && tap.geo.region !== tap.geo.country ? 
                `Viewed in ${tap.geo.city}, ${tap.geo.region}, ${tap.geo.country}` : 
                `Viewed in ${tap.geo.city}, ${tap.geo.country}`) : 
              'Card was viewed';
            icon = 'FaEye';
            color = 'text-blue-600';
            break;
        }
      }

      return {
        id: tap._id,
        type: 'tap',
        title,
        description,
        time: tap.timestamp,
        icon,
        color,
        cardLabel,
        actions: tap.actions || [],
        geo: tap.geo || null
      };
    });

    res.status(200).json({
      success: true,
      data: activities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get cards summary
exports.getCardsSummary = async (req, res) => {
  try {
    const userId = req.user.id;

    const cards = await Card.find({ userId })
      .populate('defaultProfileId', 'fullName')
      .sort({ createdAt: -1 });

    const cardsWithStats = await Promise.all(
      cards.map(async (card) => {
        // Get tap count for this card
        const tapCount = await TapLog.countDocuments({ cardId: card._id });
        
        // Get last tap
        const lastTap = await TapLog.findOne({ cardId: card._id })
          .sort({ timestamp: -1 })
          .select('timestamp');

        return {
          id: card._id,
          label: card.label,
          status: card.status,
          cardUid: card.cardUid,
          assignedUrl: card.assignedUrl,
          defaultProfile: card.defaultProfileId?.fullName,
          totalTaps: tapCount,
          lastTap: lastTap?.timestamp,
          createdAt: card.createdAt
        };
      })
    );

    res.status(200).json({
      success: true,
      data: cardsWithStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get profiles summary
exports.getProfilesSummary = async (req, res) => {
  try {
    const userId = req.user.id;

    const profiles = await Profile.find({ userId })
      .select('fullName jobTitle company lastUpdated')
      .sort({ lastUpdated: -1 });

    const profilesWithStats = profiles.map(profile => ({
      id: profile._id,
      fullName: profile.fullName,
      jobTitle: profile.jobTitle,
      company: profile.company,
      lastUpdated: profile.lastUpdated,
      isDefault: false // You can add logic to determine default profile
    }));

    res.status(200).json({
      success: true,
      data: profilesWithStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}; 

// @desc    Get top cards by tap count
// @route   GET /api/analytics/top-cards
// @access  Private/Admin
exports.getTopCards = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topCards = await require('../models/tapLogModel').aggregate([
      { $group: { _id: '$cardId', taps: { $sum: 1 } } },
      { $sort: { taps: -1 } },
      { $limit: limit }
    ]);
    // Populate card label and user info
    const Card = require('../models/cardModel');
    const User = require('../models/userModel');
    const cardsWithInfo = await Promise.all(topCards.map(async (item) => {
      const card = await Card.findById(item._id).populate('userId', 'username email');
      return {
        cardId: item._id,
        label: card?.label || 'Unknown',
        taps: item.taps,
        user: card?.userId?.username || card?.userId?.email || 'Unknown',
      };
    }));
    res.status(200).json({ success: true, data: cardsWithInfo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get top cities by tap count
// @route   GET /api/analytics/top-cities
// @access  Private/Admin
exports.getTopCities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topCities = await require('../models/tapLogModel').aggregate([
      { $match: { 'geo.city': { $exists: true, $ne: null } } },
      { $group: { _id: '$geo.city', taps: { $sum: 1 } } },
      { $sort: { taps: -1 } },
      { $limit: limit }
    ]);
    res.status(200).json({ success: true, data: topCities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}; 

// Get client-specific analytics
exports.getClientAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '7d' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }

    // Get user's cards
    const userCards = await Card.find({ userId });
    const cardIds = userCards.map(card => card._id);

    // Get tap analytics with daily breakdown
    const tapAnalytics = await TapLog.aggregate([
      {
        $match: {
          cardId: { $in: cardIds },
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get geographic data
    const geoData = await TapLog.aggregate([
      {
        $match: {
          cardId: { $in: cardIds },
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            country: "$geo.country",
            region: "$geo.region"
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get device data
    const deviceData = await TapLog.aggregate([
      {
        $match: {
          cardId: { $in: cardIds },
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$userAgent",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Get card performance breakdown
    const cardPerformance = await TapLog.aggregate([
      {
        $match: {
          cardId: { $in: cardIds },
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'cards',
          localField: 'cardId',
          foreignField: '_id',
          as: 'card'
        }
      },
      {
        $group: {
          _id: "$cardId",
          cardName: { $first: "$card.label" },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Get engagement metrics
    const engagementMetrics = await TapLog.aggregate([
      {
        $match: {
          cardId: { $in: cardIds },
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $project: {
          hasActions: { $gt: [{ $size: "$actions" }, 0] },
          hasEngagement: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$actions",
                    cond: { $ne: ["$$this.type", "card_view"] }
                  }
                }
              },
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalTaps: { $sum: 1 },
          tapsWithActions: { $sum: { $cond: ["$hasActions", 1, 0] } },
          tapsWithEngagement: { $sum: { $cond: ["$hasEngagement", 1, 0] } }
        }
      }
    ]);

    const metrics = engagementMetrics[0] || { totalTaps: 0, tapsWithActions: 0, tapsWithEngagement: 0 };

    res.status(200).json({
      success: true,
      data: {
        period,
        tapAnalytics,
        geoData,
        deviceData,
        cardPerformance,
        totalTaps: tapAnalytics.reduce((sum, item) => sum + item.count, 0),
        uniqueCountries: geoData.length,
        topCountries: geoData.slice(0, 5),
        engagementRate: metrics.totalTaps > 0 ? Math.round((metrics.tapsWithEngagement / metrics.totalTaps) * 100) : 0,
        actionRate: metrics.totalTaps > 0 ? Math.round((metrics.tapsWithActions / metrics.totalTaps) * 100) : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}; 