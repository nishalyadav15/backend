// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const Hospital = require('../models/hospital.model');
const User = require('../models/user.model');
const { generateToken } = require('../utils/jwt.utils');

// Hospital login
router.post('/hospital/login', async (req, res) => {
  try {
    const { hospitalId, password } = req.body;

    // Validate input
    if (!hospitalId || !password) {
      return res.status(400).json({ message: 'Hospital ID and password are required' });
    }

    // Find hospital
    const hospital = await Hospital.findOne({ hospitalId });
    if (!hospital) {
      return res.status(401).json({ message: 'Invalid hospital ID or password' });
    }

    // Check password
    const isMatch = await hospital.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid hospital ID or password' });
    }

    // Generate token
    const token = generateToken({
      id: hospital._id,
      role: 'hospital',
    });

    res.json({
      token,
      hospital: {
        id: hospital._id,
        name: hospital.name,
        hospitalId: hospital.hospitalId,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// User login (admin/doctor)
router.post('/user/login', async (req, res) => {
  try {
    const { email, password, hospitalId } = req.body;

    // Validate input
    if (!email || !password || !hospitalId) {
      return res.status(400).json({ message: 'Email, password, and hospital ID are required' });
    }

    // Find hospital
    const hospital = await Hospital.findOne({ hospitalId });
    if (!hospital) {
      return res.status(401).json({ message: 'Invalid hospital ID' });
    }

    // Find user
    const user = await User.findOne({ email, hospital: hospital._id });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken({
      id: user._id,
      role: user.role,
      hospital: hospital._id,
    });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospital: {
          id: hospital._id,
          name: hospital.name,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Keep the test route for now
router.get('/test', (req, res) => {
  res.json({ message: 'Auth route is working' });
});

module.exports = router;