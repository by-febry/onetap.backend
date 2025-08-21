const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/userModel');
require('dotenv').config({ path: '../.env' });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/NFC_DB';

async function createAdminUser() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const username = 'admin';
    const email = 'admin@example.com';
    const password = 'admin123'; // Change this after first login
    const role = 'admin';
    const status = 'active';

    // Check if admin already exists
    const existing = await User.findOne({ email });
    if (existing) {
      console.log('Admin user already exists:', existing);
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const adminUser = new User({
      username,
      email,
      passwordHash,
      role,
      status,
    });
    await adminUser.save();
    console.log('Admin user created:', adminUser);
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin user:', err);
    process.exit(1);
  }
}

createAdminUser(); 