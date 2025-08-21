const mongoose = require('mongoose');
const User = require('../models/userModel');
require('dotenv').config();

// Connect to database
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function updateUserSubscriptions() {
  try {
    console.log('🔧 Updating user subscription tiers...\n');

    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users to update\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      // Check if user already has subscription fields
      if (user.subscriptionTier && user.subscriptionStatus) {
        console.log(`⏭️  Skipping ${user.username} - already has subscription data`);
        skippedCount++;
        continue;
      }

      // Set default subscription tier based on user role
      let subscriptionTier = 'unsubscribed';
      let subscriptionStatus = 'expired';
      let subscriptionExpiryDate = null;

      // If user is admin, give them power_tap tier
      if (user.role === 'admin') {
        subscriptionTier = 'power_tap';
        subscriptionStatus = 'active';
        // Set expiry date to 1 year from now
        subscriptionExpiryDate = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000));
      }

      // Update user
      user.subscriptionTier = subscriptionTier;
      user.subscriptionStatus = subscriptionStatus;
      user.subscriptionExpiryDate = subscriptionExpiryDate;

      await user.save();
      
      console.log(`✅ Updated ${user.username} (${user.email})`);
      console.log(`   Tier: ${subscriptionTier}`);
      console.log(`   Status: ${subscriptionStatus}`);
      console.log(`   Expiry: ${subscriptionExpiryDate ? subscriptionExpiryDate.toDateString() : 'N/A'}`);
      console.log('');

      updatedCount++;
    }

    console.log('🎉 User subscription update completed!');
    console.log(`📊 Summary:`);
    console.log(`   Updated: ${updatedCount} users`);
    console.log(`   Skipped: ${skippedCount} users (already had data)`);
    console.log(`   Total: ${users.length} users`);

  } catch (error) {
    console.error('❌ Error updating user subscriptions:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the update
updateUserSubscriptions();
