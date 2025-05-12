// routes/hospital.routes.js
const express = require('express');
const router = express.Router();
const Hospital = require('../models/hospital.model');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');

// Get all hospitals (admin only)
router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const hospitals = await Hospital.find().select('-password');
    res.json(hospitals);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get hospital by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id).select('-password');
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    
    res.json(hospital);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new hospital (admin only)
router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const { name, hospitalId, password, address, phoneNumber } = req.body;
    
    // Check if hospital ID already exists
    const existingHospital = await Hospital.findOne({ hospitalId });
    if (existingHospital) {
      return res.status(400).json({ message: 'Hospital ID already exists' });
    }
    
    // Create new hospital
    const hospital = new Hospital({
      name,
      hospitalId,
      password,
      address,
      phoneNumber,
    });
    
    // Save hospital
    await hospital.save();
    
    res.status(201).json({
      message: 'Hospital created successfully',
      hospital: {
        id: hospital._id,
        name: hospital.name,
        hospitalId: hospital.hospitalId,
        address: hospital.address,
        phoneNumber: hospital.phoneNumber,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Keep the test route for now
router.get('/test', (req, res) => {
  res.json({ message: 'Hospital route is working' });
});

module.exports = router;