const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');
const axios = require('axios');
const Subscription = require('./models/subscriptionModel');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({
  origin: 'https://onetapfrontend.vercel.app'
}));

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/cards', require('./routes/cardRoutes'));
app.use('/api/subscriptions', require('./routes/subscriptionRoutes'));
// app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
// app.use('/api/payments', require('./routes/paymentRoutes'));

app.get('/', (req, res) => {
  res.send('NFC Backend API is running!');
});

app.post('/maya-checkout', async (req, res) => {
  try {
    const { email, phone, plan, billingPeriod } = req.body;
    let amount = 99;
    if (plan === 'Pro Tap') amount = 299;
    if (plan === 'Power Tap') amount = 899;
    if (billingPeriod === 'yearly') {
      if (plan === 'Starter Tap') amount = 999;
      if (plan === 'Pro Tap') amount = 2999;
      if (plan === 'Power Tap') amount = 8999;
    }
    const requestReferenceNumber = `SUBSCRIPTION-${Date.now()}`;

    // Save the subscription as pending
    await Subscription.create({
      email,
      phone,
      plan,
      billingPeriod,
      status: 'pending',
      requestReferenceNumber
    });

    const response = await axios.post(
      process.env.MAYA_API_URL + '/checkout/v1/checkouts',
      {
        totalAmount: { value: amount, currency: 'PHP' },
        buyer: {
          firstName: 'NFC',
          lastName: 'User',
          contact: { phone, email }
        },
        redirectUrl: {
          success: 'https://onetapfrontend.vercel.app/success',
          failure: 'https://onetapfrontend.vercel.app/failure',
          cancel: 'https://onetapfrontend.vercel.app/cancel'
        },
        requestReferenceNumber,
        items: [
          {
            name: plan,
            quantity: 1,
            totalAmount: { value: amount, currency: 'PHP' }
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(process.env.MAYA_PUBLIC_KEY + ':').toString('base64')}`
        }
      }
    );
    res.json({ redirectUrl: response.data.redirectUrl });
  } catch (error) {
    res.status(500).json({ error: error.response ? error.response.data : error.message });
  }
});

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 