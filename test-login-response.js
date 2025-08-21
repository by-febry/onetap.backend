const axios = require('axios');

async function testLoginResponse() {
  try {
    console.log('=== TESTING LOGIN API RESPONSE ===');
    
    const loginData = {
      email: 'client@example.com',
      password: 'password123' // Replace with actual password
    };
    
    console.log('Sending login request with:', loginData);
    
    const response = await axios.post('https://onetapp-backend-website.onrender.com/api/auth/login', loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    // Test the subscription logic
    const userData = response.data;
    const isSubscribed = userData.subscriptionTier && 
                        userData.subscriptionTier !== 'unsubscribed' && 
                        userData.subscriptionStatus === 'active';
    
    console.log('\n=== SUBSCRIPTION ANALYSIS ===');
    console.log('Subscription tier:', userData.subscriptionTier);
    console.log('Subscription status:', userData.subscriptionStatus);
    console.log('Subscription expiry:', userData.subscriptionExpiryDate);
    console.log('Is subscribed?', isSubscribed);
    
    // Test routing logic
    let route = '/';
    if (userData.role === 'admin') {
      route = '/admin-dashboard';
    } else if (isSubscribed) {
      switch (userData.subscriptionTier) {
        case 'starter_tap':
          route = '/basic-dashboard';
          break;
        case 'pro_tap':
          route = '/client-dashboard';
          break;
        case 'power_tap':
          route = '/basic-dashboard';
          break;
        default:
          route = '/basic-dashboard';
      }
    } else {
      route = '/basic-dashboard';
    }
    
    console.log('Should route to:', route);
    
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testLoginResponse();
