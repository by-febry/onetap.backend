const express = require('express');
const { createContactRequest } = require('../controllers/contactController');

const router = express.Router();

router.post('/request', createContactRequest);

module.exports = router; 