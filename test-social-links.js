const express = require('express');
const multer = require('multer');
const cors = require('cors');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.put('/test/:id', upload.single('profileImage'), (req, res) => {
  console.log('=== TEST ENDPOINT ===');
  console.log('Request body:', req.body);
  console.log('Request files:', req.file);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('All headers:', req.headers);
  
  // Check if socialLinks is in the body
  if (req.body.socialLinks) {
    console.log('socialLinks found:', req.body.socialLinks);
    try {
      const parsed = JSON.parse(req.body.socialLinks);
      console.log('Parsed socialLinks:', parsed);
    } catch (e) {
      console.log('Failed to parse socialLinks:', e.message);
    }
  } else {
    console.log('socialLinks NOT found in body');
  }
  
  res.json({ 
    message: 'Test successful',
    body: req.body,
    socialLinks: req.body.socialLinks ? JSON.parse(req.body.socialLinks) : null
  });
});

app.listen(3001, () => {
  console.log('Test server running on port 3001');
}); 