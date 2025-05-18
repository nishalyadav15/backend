// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const Hospital = require('../models/hospital.model');
const User = require('../models/user.model');
const { generateToken } = require('../utils/jwt.utils');
const { authenticate } = require('../middleware/auth.middleware');

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

// Change password
router.put('/password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    
    // Determine if the user is a hospital or a user
    let entity;
    let model;
    
    if (req.hospital) {
      entity = req.hospital;
      model = Hospital;
    } else if (req.user) {
      entity = req.user;
      model = User;
    } else {
      return res.status(401).json({ message: 'Authentication failed' });
    }
    
    // Check current password
    const isMatch = await entity.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Update password
    entity.password = newPassword;
    await entity.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Verify token
router.get('/verify', authenticate, (req, res) => {
  try {
    if (req.hospital) {
      return res.json({
        isAuthenticated: true,
        role: 'hospital',
        hospital: {
          id: req.hospital._id,
          name: req.hospital.name,
          hospitalId: req.hospital.hospitalId,
        },
      });
    }
    
    if (req.user) {
      return res.json({
        isAuthenticated: true,
        role: req.user.role,
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          hospital: req.user.hospital,
        },
      });
    }
    
    return res.status(401).json({ isAuthenticated: false, message: 'Invalid token' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Keep the test route for now
router.get('/test', (req, res) => {
  res.json({ message: 'Auth route is working' });
});

module.exports = router;