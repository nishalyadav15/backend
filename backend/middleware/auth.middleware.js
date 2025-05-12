// middleware/auth.middleware.js
const { verifyToken } = require('../utils/jwt.utils');
const User = require('../models/user.model');
const Hospital = require('../models/hospital.model');

// Authenticate JWT token
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify token
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Set user in request
    if (decoded.role === 'hospital') {
      const hospital = await Hospital.findById(decoded.id).select('-password');
      if (!hospital) {
        return res.status(401).json({ message: 'Hospital not found' });
      }
      req.hospital = hospital;
    } else {
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      req.user = user;
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin role required.' });
  }
  next();
};

// Check if user is doctor
const isDoctor = (req, res, next) => {
  if (!req.user || req.user.role !== 'doctor') {
    return res.status(403).json({ message: 'Access denied. Doctor role required.' });
  }
  next();
};

module.exports = {
  authenticate,
  isAdmin,
  isDoctor,
};