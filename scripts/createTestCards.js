const mongoose = require('mongoose');
const Card = require('../models/cardModel');
const User = require('../models/userModel');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const createTestCards = async () => {
  try {
    // Find a regular user (not admin)
    const user = await User.findOne({ role: { $ne: 'admin' } });
    
    if (!user) {
      console.log('No regular user found. Please create a user first.');
      return;
    }

    console.log(`Creating test cards for user: ${user.email}`);

    // Create test cards
    const testCards = [
      {
        userId: user._id,
        cardUid: 'TEST_CARD_001',
        label: 'Business Card',
        assignedUrl: 'https://example.com/business',
        status: 'active'
      },
      {
        userId: user._id,
        cardUid: 'TEST_CARD_002',
        label: 'Personal Card',
        assignedUrl: 'https://example.com/personal',
        status: 'active'
      },
      {
        userId: user._id,
        cardUid: 'TEST_CARD_003',
        label: 'Event Card',
        assignedUrl: 'https://example.com/event',
        status: 'active'
      }
    ];

    // Clear existing test cards for this user
    await Card.deleteMany({ 
      userId: user._id,
      cardUid: { $regex: /^TEST_CARD_/ }
    });

    // Insert new test cards
    const createdCards = await Card.insertMany(testCards);
    
    console.log(`Created ${createdCards.length} test cards:`);
    createdCards.forEach(card => {
      console.log(`- ${card.label} (${card.cardUid})`);
    });

    // Verify cards were created
    const userCards = await Card.find({ userId: user._id });
    console.log(`\nTotal cards for user ${user.email}: ${userCards.length}`);

  } catch (error) {
    console.error('Error creating test cards:', error);
  } finally {
    mongoose.connection.close();
  }
};

createTestCards(); 