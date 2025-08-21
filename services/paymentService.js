const axios = require('axios');
const Subscription = require('../models/subscriptionModel');

function calculateAmount(plan, billingPeriod) {
  let amount = 0;

  if (plan === 'Starter Tap') amount = 99;
  if (plan === 'Pro Tap') amount = 299;
  if (plan === 'Pro Tap +') amount = 499;
  if (plan === 'Power Tap (Enterprise)') amount = 1499;

  if (billingPeriod === 'yearly') {
    if (plan === 'Starter Tap') amount = 999;
    if (plan === 'Pro Tap') amount = 2999;
    if (plan === 'Pro Tap +') amount = 4999;
    if (plan === 'Power Tap (Enterprise)') amount = 14999;
  }

  return amount;
}

async function createMayaCheckout({ email, phone, plan, billingPeriod }) {
  const requestReferenceNumber = `SUBSCRIPTION-${Date.now()}`;
  const amount = calculateAmount(plan, billingPeriod);

  await Subscription.create({
    email,
    phone,
    plan,
    billingPeriod,
    status: 'pending',
    requestReferenceNumber
  });

  const successUrl = process.env.MAYA_REDIRECT_SUCCESS_URL || 'https://onetapp-webpage-3wnn.vercel.app';
  const failureUrl = process.env.MAYA_REDIRECT_FAILURE_URL || 'https://onetapp-webpage-3wnn.vercel.app';
  const cancelUrl = process.env.MAYA_REDIRECT_CANCEL_URL || 'https://onetapp-webpage-3wnn.vercel.app';

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
        success: successUrl,
        failure: failureUrl,
        cancel: cancelUrl
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

  return { redirectUrl: response.data.redirectUrl, requestReferenceNumber };
}

module.exports = {
  calculateAmount,
  createMayaCheckout
}; 