const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');
const axios = require('axios');
const Subscription = require('./models/subscriptionModel');
const tapRoutes = require('./routes/tapRoutes');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://onetapp-webpage-3wnn.vercel.app',
    'https://onetapp-webpage.vercel.app',
    'https://onetapp-client1-card.vercel.app',
    'http://localhost:60275',
    'http://localhost:63726'
  ]
}));

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/users/subscriptions', require('./routes/userSubscriptionRoutes'));
app.use('/api/cards', require('./routes/cardRoutes'));
app.use('/api/subscriptions', require('./routes/subscriptionRoutes'));
app.use('/api/profiles', require('./routes/profileRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/taps', tapRoutes);
app.use('/api', require('./routes/dashboardRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/activity-logs', require('./routes/activityLogRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));

app.get('/', (req, res) => {
  res.send('NFC Backend API is running!');
});

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 