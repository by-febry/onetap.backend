const axios = require('axios');

const API_BASE_URL = 'https://onetapp-backend-website.onrender.com';

async function fixSubscriptionStatus() {
  console.log('🔧 Fixing Subscription Status...\n');

  // Your subscription reference numbers
  const subscriptions = [
    'SUBSCRIPTION-1755235723084', // First subscription
    'SUBSCRIPTION-1755236838429'  // Latest subscription
  ];

  for (const referenceNumber of subscriptions) {
    console.log(`Processing: ${referenceNumber}`);
    
    try {
      // Update status to success
      const response = await axios.put(`${API_BASE_URL}/api/subscriptions/update-status`, {
        requestReferenceNumber: referenceNumber,
        status: 'success',
        paymentId: `PAYMENT-${Date.now()}`,
        amount: 299 // Pro Tap monthly amount
      });

      console.log('✅ Status updated successfully!');
      console.log('   New Status:', response.data.subscription.status);
      console.log('   Plan:', response.data.subscription.plan);
      console.log('   Email:', response.data.subscription.email);
      console.log('   Payment ID:', response.data.subscription.paymentId);
      console.log('   Amount:', response.data.subscription.amount);
      console.log('');

    } catch (error) {
      console.log('❌ Failed to update status:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('   Error details:', error.response.data);
      }
      console.log('');
    }
  }

  console.log('🎉 Subscription status fix completed!');
  console.log('\n🔗 Test your updated subscription:');
  console.log('   Success: https://onetapp-fresh.vercel.app/success?requestReferenceNumber=SUBSCRIPTION-1755236838429');
  console.log('   Direct API: GET https://onetapp-backend-website.onrender.com/api/subscriptions/reference/SUBSCRIPTION-1755236838429');
}

// Run the fix
fixSubscriptionStatus(); 