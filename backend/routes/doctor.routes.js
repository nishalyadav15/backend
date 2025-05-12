// routes/doctor.routes.js
const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');

// Get all doctors for a hospital
router.get('/', authenticate, async (req, res) => {
  try {
    const hospitalId = req.user ? req.user.hospital : req.hospital._id;
    
    const doctors = await User.find({
      hospital: hospitalId,
      role: 'doctor',
    }).select('-password');
    
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get doctor by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const doctor = await User.findById(req.params.id).select('-password');
    
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    
    // Check if doctor belongs to the hospital
    const hospitalId = req.user ? req.user.hospital : req.hospital._id;
    if (doctor.hospital.toString() !== hospitalId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new doctor (admin only)
router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    
    // Create new user
    const user = new User({
      name,
      email,
      password,
      role: role || 'doctor', // Default to doctor if role not specified
      hospital: req.user.hospital,
    });
    
    // Save user
    await user.save();
    
    res.status(201).json({
      message: 'Doctor created successfully',
      doctor: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Keep the test route for now
router.get('/test', (req, res) => {
  res.json({ message: 'Doctor route is working' });
});

module.exports = router;