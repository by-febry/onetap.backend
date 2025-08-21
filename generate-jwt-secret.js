const crypto = require('crypto');

// Generate a secure random JWT secret
const jwtSecret = crypto.randomBytes(64).toString('hex');

console.log('Generated JWT_SECRET:');
console.log(jwtSecret);
console.log('\nAdd this to your .env file as:');
console.log(`JWT_SECRET=${jwtSecret}`); 