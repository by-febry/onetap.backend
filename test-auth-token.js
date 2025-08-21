const axios = require('axios');

const API_BASE_URL = 'https://onetapp-backend-website.onrender.com';

async function testAuthToken() {
  console.log('🔐 Testing Authentication Token...\n');

  // Test with a sample token (this will likely fail, but we can see the error)
  const sampleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY2ZjJjZjJjZjJjZjJjZjJjZjJjZjJjZiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTczNDU2Nzg5MCwiZXhwIjoxNzM3MTU5ODkwfQ.example';

  try {
    console.log('1. Testing with sample token...');
    const response = await axios.get(`${API_BASE_URL}/api/users/subscriptions`, {
      headers: {
        'Authorization': `Bearer ${sampleToken}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('✅ Token is valid!');
    console.log('Response:', response.data);
  } catch (error) {
    if (error.response) {
      console.log(`❌ Token test failed: ${error.response.status} - ${error.response.statusText}`);
      if (error.response.data) {
        console.log('Error details:', error.response.data);
      }
    } else {
      console.log('❌ Network error:', error.message);
    }
  }

  console.log('\n2. Testing without token...');
  try {
    const response = await axios.get(`${API_BASE_URL}/api/users/subscriptions`);
    console.log('❌ Unexpected success - should require authentication');
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ Correctly requires authentication (401 Unauthorized)');
    } else {
      console.log(`❌ Unexpected error: ${error.response?.status || error.message}`);
    }
  }
}

// Run the test
testAuthToken();
