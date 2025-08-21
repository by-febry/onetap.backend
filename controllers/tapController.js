const TapLog = require('../models/tapLogModel');
const Event = require('../models/eventModel');

// Helper function to get client IP
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.ip;
}

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

exports.logTap = async (req, res) => {
  try {
    // Add IP from request if not provided by frontend
    const tapData = { ...req.body };
    if (!tapData.ip) {
      tapData.ip = getClientIP(req);
    }
    
    // Check if there's an active event for this card
    const activeEvent = await Event.getActiveEvent(tapData.cardId);
    
    if (activeEvent && tapData.geo && tapData.geo.latitude && tapData.geo.longitude) {
      // Calculate distance between user and event location
      const distance = calculateDistance(
        tapData.geo.latitude, tapData.geo.longitude,
        activeEvent.location.coordinates.latitude, 
        activeEvent.location.coordinates.longitude
      );
      
      const PROXIMITY_THRESHOLD = 1; // 1km radius
      
      if (distance <= PROXIMITY_THRESHOLD) {
        // User is near event → Use event location
        tapData.eventId = activeEvent._id;
        tapData.geo.latitude = activeEvent.location.coordinates.latitude;
        tapData.geo.longitude = activeEvent.location.coordinates.longitude;
        tapData.geo.city = activeEvent.location.city;
        tapData.geo.region = activeEvent.location.province; // Map province to region
        tapData.geo.country = activeEvent.location.country;
        tapData.geo.method = 'event_location';
      } else {
        // User is far from event → Use actual location but associate with event
        tapData.eventId = activeEvent._id;
        tapData.geo.method = 'user_location_during_event';
      }
    }
    
    const tap = await TapLog.create(tapData);
    res.status(201).json(tap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.logUserAction = async (req, res) => {
  try {
    // Add IP from request if not provided by frontend
    const actionData = { ...req.body };
    if (!actionData.ip) {
      actionData.ip = getClientIP(req);
    }
    
    // Find the most recent tap log for this card and session
    const existingTap = await TapLog.findOne({
      cardId: actionData.cardId,
      sessionId: actionData.sessionId
    }).sort({ timestamp: -1 });
    
    if (existingTap) {
      // Update the existing tap log with the new action
      existingTap.actions.push({
        type: actionData.actions[0].type,
        label: actionData.actions[0].label,
        url: actionData.actions[0].url || '',
        timestamp: new Date()
      });
      
      // Update location data if available
      if (actionData.geo && Object.keys(actionData.geo).length > 0) {
        existingTap.geo = actionData.geo;
      }
      
      await existingTap.save();
      res.status(200).json(existingTap);
    } else {
      // If no existing tap found, create a new one (fallback)
      const actionLog = await TapLog.create(actionData);
      res.status(201).json(actionLog);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 

// @desc    Get map points for admin map (manual and auto tap locations)
// @route   GET /api/taplogs/map-points
// @access  Private/Admin
exports.getMapPoints = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 1000;
    const period = req.query.period || '30d';
    const now = new Date();
    let startDate = new Date(now);
    if (period.endsWith('d')) {
      const days = parseInt(period.replace('d', ''));
      startDate.setDate(now.getDate() - days);
    } else {
      startDate.setDate(now.getDate() - 30);
    }

    // Populate event for manual taps
    const tapLogs = await require('../models/tapLogModel').find({
      timestamp: { $gte: startDate, $lte: now }
    })
      .populate('eventId', 'name location')
      .sort({ timestamp: -1 })
      .limit(limit);

    const points = tapLogs.map(tap => {
      let lat, lng, type, city, province, country, eventName;
      if (
        tap.eventId &&
        (tap.geo?.method === 'event_location' || tap.geo?.method === 'user_location_during_event') &&
        tap.eventId.location?.coordinates
      ) {
        // Manual/event tap
        lat = tap.eventId.location.coordinates.latitude;
        lng = tap.eventId.location.coordinates.longitude;
        type = 'manual';
        city = tap.eventId.location.city;
        province = tap.eventId.location.province;
        country = tap.eventId.location.country;
        eventName = tap.eventId.name;
      } else if (tap.geo && tap.geo.latitude && tap.geo.longitude) {
        // Automatic tap
        lat = tap.geo.latitude;
        lng = tap.geo.longitude;
        type = 'auto';
        city = tap.geo.city;
        province = tap.geo.region || tap.geo.province;
        country = tap.geo.country;
        eventName = undefined;
      } else {
        // Skip if no valid location
        return null;
      }
      return {
        lat,
        lng,
        type,
        city,
        province,
        country,
        eventName,
        timestamp: tap.timestamp,
        count: 1 // Each map point represents one tap
      };
    }).filter(Boolean);

    res.status(200).json({ success: true, data: points });
  } catch (err) {
    console.error('Get map points error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}; 