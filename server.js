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

const allowedOrigins = [
  'http://localhost:3000',
  'https://onetapp-webpage-3wnn.vercel.app',
  'https://onetapp-webpage.vercel.app',
  'https://onetapp-client1-card.vercel.app',
  'http://localhost:60275',
  'http://localhost:63726'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.options('*', cors());

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

app.get('/', (req, res) => {
  res.send('NFC Backend API is running!');
});

app.post('/contact-request', async (req, res) => {
  try {
    const { email, phone, plan } = req.body;
    const requestReferenceNumber = `CONTACT-${Date.now()}`;

    // Save the contact request
    await Subscription.create({
      email,
      phone,
      plan,
      status: 'contact_request',
      requestReferenceNumber
    });

    // For now, just return success - you can integrate with your CRM or email service later
    res.json({ 
      success: true, 
      message: 'Contact request received. We will get back to you soon.',
      requestReferenceNumber 
    });
  } catch (error) {
    console.error('Contact request error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/maya-checkout', async (req, res) => {
  try {
    const { email, phone, plan, billingPeriod } = req.body;
    
    // Pricing logic based on plan and billing period
    let amount = 0;
    if (plan === 'Starter Tap') amount = 99;
    if (plan === 'Pro Tap') amount = 299;
    if (plan === 'Pro Tap +') amount = 499;
    if (plan === 'Power Tap (Enterprise)') amount = 1499;
    
    if (billingPeriod === 'yearly') {
      // Apply yearly discount (10 months for yearly billing)
      if (plan === 'Starter Tap') amount = 999;
      if (plan === 'Pro Tap') amount = 2999;
      if (plan === 'Pro Tap +') amount = 4999;
      if (plan === 'Power Tap (Enterprise)') amount = 14999;
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
          success: 'https://onetapp-webpage-3wnn.vercel.app',
          failure: 'https://onetapp-webpage-3wnn.vercel.app',
          cancel: 'https://onetapp-webpage-3wnn.vercel.app'
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

// Webhook endpoints for payment status updates
app.post('/webhook/payment-success', async (req, res) => {
  try {
    const { requestReferenceNumber, paymentId, amount } = req.body;
    
    console.log('Payment Success Webhook:', { requestReferenceNumber, paymentId, amount });
    
    // Update subscription status to success
    const subscription = await Subscription.findOneAndUpdate(
      { requestReferenceNumber },
      { 
        status: 'success',
        paymentId,
        nextBillingDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 days from now
      },
      { new: true }
    );
    
    if (!subscription) {
      console.error('Subscription not found for reference:', requestReferenceNumber);
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    console.log('Subscription updated to success:', subscription._id);
    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Payment success webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/webhook/payment-failure', async (req, res) => {
  try {
    const { requestReferenceNumber, errorMessage } = req.body;
    
    console.log('Payment Failure Webhook:', { requestReferenceNumber, errorMessage });
    
    // Update subscription status to failed
    const subscription = await Subscription.findOneAndUpdate(
      { requestReferenceNumber },
      { 
        status: 'failed',
        errorMessage: errorMessage || 'Payment failed'
      },
      { new: true }
    );
    
    if (!subscription) {
      console.error('Subscription not found for reference:', requestReferenceNumber);
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    console.log('Subscription updated to failed:', subscription._id);
    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Payment failure webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/webhook/payment-cancel', async (req, res) => {
  try {
    const { requestReferenceNumber } = req.body;
    
    console.log('Payment Cancel Webhook:', { requestReferenceNumber });
    
    // Update subscription status to cancelled
    const subscription = await Subscription.findOneAndUpdate(
      { requestReferenceNumber },
      { 
        status: 'cancelled'
      },
      { new: true }
    );
    
    if (!subscription) {
      console.error('Subscription not found for reference:', requestReferenceNumber);
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    console.log('Subscription updated to cancelled:', subscription._id);
    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Payment cancel webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual status check endpoint
app.get('/api/subscription/status/:referenceNumber', async (req, res) => {
  try {
    const { referenceNumber } = req.params;
    
    const subscription = await Subscription.findOne({ requestReferenceNumber: referenceNumber });
    
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    res.json({ 
      success: true, 
      subscription: {
        status: subscription.status,
        plan: subscription.plan,
        email: subscription.email,
        requestReferenceNumber: subscription.requestReferenceNumber,
        createdAt: subscription.createdAt
      }
    });
  } catch (error) {
    console.error('Subscription status check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 