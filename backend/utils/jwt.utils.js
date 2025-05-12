// utils/jwt.utils.js
const jwt = require('jsonwebtoken');

// Generate access token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'your_jwt_secret_key_here', {
    expiresIn: '1d', // Token expires in 1 day
  });
};

// Verify token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken,
};