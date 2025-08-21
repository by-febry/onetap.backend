const Event = require('../models/eventModel');
const Card = require('../models/cardModel');
const logActivity = require('../services/logActivity');

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

// @desc    Create a new event
// @route   POST /api/events
// @access  Private
exports.createEvent = async (req, res) => {
  try {
    const {
      cardId,
      name,
      description,
      location,
      dateTime
    } = req.body;

    // Validate required fields
    if (!cardId || !name || !location || !dateTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Helper function to parse date with timezone consideration
    const parseDateWithTimezone = (dateString, timezone = 'Asia/Manila') => {
      if (!dateString) return null;
      
      // If the date string is already an ISO string, parse it directly
      const date = new Date(dateString);
      
      // Validate the date
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date format');
      }
      
      return date;
    };

    // Parse dates with proper timezone handling
    const startDate = parseDateWithTimezone(dateTime.start, dateTime.timezone);
    const endDate = parseDateWithTimezone(dateTime.end, dateTime.timezone);

    // Validate date range
    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        error: 'End time must be after start time'
      });
    }

    // Check if card belongs to user
    const card = await Card.findOne({ _id: cardId, userId: req.user.id });
    if (!card) {
      return res.status(404).json({
        success: false,
        error: 'Card not found or access denied'
      });
    }

    // Check for overlapping events (optional - can be disabled)
    const overlappingEvent = await Event.findOne({
      cardId: cardId,
      status: 'active',
      $or: [
        {
          'dateTime.start': { $lt: endDate },
          'dateTime.end': { $gt: startDate }
        }
      ]
    });

    if (overlappingEvent) {
      return res.status(400).json({
        success: false,
        error: 'Event overlaps with existing event',
        overlappingEvent: {
          name: overlappingEvent.name,
          start: overlappingEvent.dateTime.start,
          end: overlappingEvent.dateTime.end
        }
      });
    }

    // Create event
    const event = new Event({
      userId: req.user.id,
      cardId: cardId,
      name: name,
      description: description,
      location: {
        name: location.name,
        address: location.address,
        city: location.city,
        province: location.province,
        country: location.country,
        coordinates: {
          latitude: location.coordinates.latitude,
          longitude: location.coordinates.longitude
        }
      },
      dateTime: {
        start: startDate,
        end: endDate,
        timezone: dateTime.timezone || 'Asia/Manila'
      },
      status: 'active'
    });

    await event.save();
    await logActivity({
      user: req.user._id,
      action: 'Event Create',
      targetType: 'Event',
      targetId: event._id,
      details: req.body,
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get all events for a user
// @route   GET /api/events
// @access  Private
exports.getEvents = async (req, res) => {
  try {
    const { cardId, status, limit = 20, page = 1 } = req.query;
    
    // Build query
    const query = { userId: req.user.id };
    
    if (cardId) {
      query.cardId = cardId;
    }
    
    if (status) {
      query.status = status;
    }

    // Get events with pagination
    const events = await Event.find(query)
      .populate('cardId', 'label')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Get total count
    const total = await Event.countDocuments(query);

    res.status(200).json({
      success: true,
      data: events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get a specific event
// @route   GET /api/events/:id
// @access  Private
exports.getEvent = async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      userId: req.user.id
    }).populate('cardId', 'label');

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    res.status(200).json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update an event
// @route   PUT /api/events/:id
// @access  Private
exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const before = { ...event.toObject() };
    
    // Handle date/time updates with proper timezone handling
    if (req.body.dateTime) {
      const parseDateWithTimezone = (dateString, timezone = 'Asia/Manila') => {
        if (!dateString) return null;
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date format');
        }
        return date;
      };

      // Parse dates if they're being updated
      if (req.body.dateTime.start) {
        req.body.dateTime.start = parseDateWithTimezone(req.body.dateTime.start, req.body.dateTime.timezone || event.dateTime.timezone);
      }
      if (req.body.dateTime.end) {
        req.body.dateTime.end = parseDateWithTimezone(req.body.dateTime.end, req.body.dateTime.timezone || event.dateTime.timezone);
      }
      
      // Validate date range if both dates are provided
      if (req.body.dateTime.start && req.body.dateTime.end) {
        if (req.body.dateTime.start >= req.body.dateTime.end) {
          return res.status(400).json({ error: 'End time must be after start time' });
        }
      }
    }
    
    Object.assign(event, req.body);
    await event.save();
    await logActivity({
      user: req.user._id,
      action: 'Event Update',
      targetType: 'Event',
      targetId: event._id,
      details: { before, after: event.toObject() },
      ip: req.ip,
    });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// @desc    Delete an event
// @route   DELETE /api/events/:id
// @access  Private
exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    await event.deleteOne();
    await logActivity({
      user: req.user._id,
      action: 'Event Delete',
      targetType: 'Event',
      targetId: req.params.id,
      details: { deletedEventId: req.params.id },
      ip: req.ip,
    });
    res.json({ success: true, message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// @desc    Get event analytics
// @route   GET /api/events/:id/analytics
// @access  Private
exports.getEventAnalytics = async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    // Get tap logs for this event
    const TapLog = require('../models/tapLogModel');
    const taps = await TapLog.find({
      eventId: event._id,
      timestamp: {
        $gte: event.dateTime.start,
        $lte: event.dateTime.end
      }
    });

    // Calculate analytics
    const totalTaps = taps.length;
    const atEventTaps = taps.filter(tap => 
      tap.geo.method === 'event_location'
    ).length;
    const remoteTaps = taps.filter(tap => 
      tap.geo.method === 'user_location_during_event'
    ).length;

    // Group by location (city/region/country)
    const locationStats = taps.reduce((acc, tap) => {
      // Handle cases where geo data might be missing or incomplete
      const city = tap.geo?.city || 'Unknown City';
      const region = tap.geo?.region || 'Unknown Region';
      const country = tap.geo?.country || 'Unknown Country';
      
      // Create a meaningful location string
      let location;
      if (city && region && country) {
        location = `${city}, ${region}, ${country}`;
      } else if (city && region) {
        location = `${city}, ${region}`;
      } else if (city && country) {
        location = `${city}, ${country}`;
      } else if (city) {
        location = city;
      } else {
        location = 'Unknown Location';
      }
      
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {});

    // Timeline (group by hour)
    const timeline = {};
    taps.forEach(tap => {
      const hour = new Date(tap.timestamp).toLocaleString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: event.dateTime.timezone || 'Asia/Manila'
      });
      timeline[hour] = (timeline[hour] || 0) + 1;
    });
    const timelineArr = Object.entries(timeline).map(([hour, count]) => ({ hour, count })).sort((a, b) => a.hour.localeCompare(b.hour));

    // At-event vs remote breakdown
    const breakdown = {
      atEvent: atEventTaps,
      remote: remoteTaps,
      atEventPercent: totalTaps > 0 ? Math.round((atEventTaps / totalTaps) * 100) : 0,
      remotePercent: totalTaps > 0 ? Math.round((remoteTaps / totalTaps) * 100) : 0
    };

    res.status(200).json({
      success: true,
      data: {
        event: {
          name: event.name,
          start: event.dateTime.start,
          end: event.dateTime.end,
          location: event.location
        },
        analytics: {
          totalTaps,
          atEventTaps,
          remoteTaps,
          eventEffectiveness: totalTaps > 0 ? Math.round((atEventTaps / totalTaps) * 100) : 0,
          locationStats,
          timeline: timelineArr,
          breakdown
        }
      }
    });
  } catch (error) {
    console.error('Get event analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}; 

// @desc    Get all event locations (admin)
// @route   GET /api/events/locations
// @access  Private/Admin
exports.getAllEventLocations = async (req, res) => {
  try {
    const events = await Event.find({}, {
      _id: 1,
      name: 1,
      location: 1,
      dateTime: 1
    });
    res.status(200).json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Get all event locations error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}; 