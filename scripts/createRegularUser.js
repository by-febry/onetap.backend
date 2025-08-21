const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/userModel');
require('dotenv').config({ path: '../.env' });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/NFC_DB';

async function createRegularUser() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const username = 'regularuser';
    const email = 'user@example.com';
    const passwordPlain = 'user1234'; // Change as needed
    const role = 'user';
    const status = 'active';

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      console.log('User already exists:', existing);
      process.exit(0);
    }

    const password = await bcrypt.hash(passwordPlain, 10);
    const regularUser = new User({
      username,
      email,
      password,
      role,
      status,
    });
    await regularUser.save();
    console.log('Regular user created:', regularUser);
    process.exit(0);
  } catch (err) {
    console.error('Error creating regular user:', err);
    process.exit(1);
  }
}

createRegularUser(); 