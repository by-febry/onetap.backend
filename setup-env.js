const fs = require('fs');
const path = require('path');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('.env file already exists');
  process.exit(0);
}

// Create .env file with default values
const envContent = `# Database Configuration
MONGODB_URI=mongodb://localhost:27017/NFC_DB

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=30d

# Server Configuration
PORT=5000
NODE_ENV=development

# Maya Payment Configuration (optional)
MAYA_API_URL=https://pg-sandbox.paymaya.com
MAYA_PUBLIC_KEY=your-maya-public-key
`;

try {
  fs.writeFileSync(envPath, envContent);
  console.log('.env file created successfully!');
  console.log('Please update the JWT_SECRET with a secure random string before using in production.');
} catch (error) {
  console.error('Error creating .env file:', error);
} 