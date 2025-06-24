const express = require('express');
const router = express.Router();
const Card = require('../models/cardModel');
const { protect, authorize } = require('../middleware/authMiddleware');

// @desc    Get all cards
// @route   GET /api/cards
// @access  Private/Admin
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const cards = await Card.find({}).populate('user', 'name email');
    res.json({ cards });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc    Create a new card
// @route   POST /api/cards
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { user, nfcId, template, socialLinks, website, bio, customFields } = req.body;
    if (!user || !nfcId) {
      return res.status(400).json({ message: 'User and NFC ID are required' });
    }
    const card = await Card.create({ user, nfcId, template, socialLinks, website, bio, customFields });
    res.status(201).json(card);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc    Get card by ID
// @route   GET /api/cards/:id
// @access  Private/Admin
router.get('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ message: 'Card not found' });
    res.json({ card });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc    Update card
// @route   PUT /api/cards/:id
// @access  Private/Admin
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const updates = req.body;
    const card = await Card.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!card) return res.status(404).json({ message: 'Card not found' });
    res.json({ card });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc    Delete card
// @route   DELETE /api/cards/:id
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const card = await Card.findByIdAndDelete(req.params.id);
    if (!card) return res.status(404).json({ message: 'Card not found' });
    res.json({ message: 'Card deleted' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router; 