const axios = require('axios');

const API_BASE_URL = 'https://onetapp-backend-website.onrender.com';

async function testUserSubscriptionAPI() {
  console.log('🧪 Testing User Subscription API...\n');

  try {
    // Test 1: Check if the endpoint exists (should return 401 without auth)
    console.log('1. Testing endpoint existence...');
    try {
      const response = await axios.get(`${API_BASE_URL}/api/users/subscriptions`);
      console.log('❌ Unexpected success - endpoint should require authentication');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Endpoint exists and requires authentication (401 Unauthorized)');
      } else {
        console.log(`❌ Unexpected error: ${error.response?.status || error.message}`);
      }
    }

    // Test 2: Check if the route is properly configured
    console.log('\n2. Testing route configuration...');
    try {
      const response = await axios.get(`${API_BASE_URL}/api/users/subscriptions/nonexistent`);
      console.log('❌ Unexpected success - should return 401 or 404');
    } catch (error) {
      if (error.response && (error.response.status === 401 || error.response.status === 404)) {
        console.log(`✅ Route properly configured (${error.response.status})`);
      } else {
        console.log(`❌ Unexpected error: ${error.response?.status || error.message}`);
      }
    }

    // Test 3: Check if the server is responding
    console.log('\n3. Testing server health...');
    try {
      const response = await axios.get(`${API_BASE_URL}/`);
      console.log('✅ Server is responding');
      console.log(`   Response: ${response.data}`);
    } catch (error) {
      console.log(`❌ Server error: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testUserSubscriptionAPI();
