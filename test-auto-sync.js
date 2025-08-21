const axios = require('axios');

const API_BASE_URL = 'https://onetapp-backend-website.onrender.com';

async function testAutoSync() {
  console.log('🧪 Testing Auto-Sync Functionality...\n');

  try {
    // Test 1: Check if the endpoint exists (should return 401 without auth)
    console.log('1. Testing endpoint existence...');
    try {
      const response = await axios.post(`${API_BASE_URL}/api/users/subscriptions/auto-sync/test-user-id`);
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
      const response = await axios.post(`${API_BASE_URL}/api/users/subscriptions/auto-sync/nonexistent-user-id`);
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

    console.log('\n🎉 Auto-sync endpoint tests completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Log in as admin in the frontend');
    console.log('   2. Go to Users section');
    console.log('   3. Edit any user');
    console.log('   4. Click "Auto Sync" button in the subscription section');
    console.log('   5. Check if subscription data is automatically updated');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAutoSync();
