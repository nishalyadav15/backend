// routes/hospital.routes.js
const express = require('express');
const router = express.Router();
const Hospital = require('../models/hospital.model');
const { authenticate } = require('../middleware/auth.middleware');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Set up multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Get current hospital profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const hospitalId = req.hospital ? req.hospital._id : req.user.hospital;
    
    const hospital = await Hospital.findById(hospitalId).select('-password');
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    
    res.json(hospital);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update hospital profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const hospitalId = req.hospital ? req.hospital._id : req.user.hospital;
    
    // Get updateable fields
    const {
      name,
      address,
      phoneNumber,
      doctorName,
      doctorDesignation,
      doctorRegistrationNumber,
      email,
      branding
    } = req.body;
    
    // Create update object with only provided fields
    const updateData = {};
    if (name) updateData.name = name;
    if (address) updateData.address = address;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (doctorName) updateData.doctorName = doctorName;
    if (doctorDesignation) updateData.doctorDesignation = doctorDesignation;
    if (doctorRegistrationNumber) updateData.doctorRegistrationNumber = doctorRegistrationNumber;
    if (email) updateData.email = email;
    
    // Handle branding updates if provided
    if (branding) {
      updateData.branding = {};
      if (branding.primaryColor) updateData.branding.primaryColor = branding.primaryColor;
      if (branding.letterheadText) updateData.branding.letterheadText = branding.letterheadText;
      // Note: We don't update logo here - that's done in a separate endpoint
    }
    
    // Update hospital
    const hospital = await Hospital.findByIdAndUpdate(
      hospitalId,
      { $set: updateData },
      { new: true }
    ).select('-password');
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    
    res.json(hospital);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Upload hospital logo
router.post('/logo', authenticate, upload.single('logo'), async (req, res) => {
  try {
    const hospitalId = req.hospital ? req.hospital._id : req.user.hospital;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No logo file provided' });
    }
    
    // Convert file to base64
    const logoBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    // Update hospital with logo
    const hospital = await Hospital.findByIdAndUpdate(
      hospitalId,
      { $set: { 'branding.logo': logoBase64 } },
      { new: true }
    ).select('-password');
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    
    res.json({ message: 'Logo uploaded successfully', hospital });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Upload doctor signature
router.post('/signature', authenticate, upload.single('signature'), async (req, res) => {
  try {
    const hospitalId = req.hospital ? req.hospital._id : req.user.hospital;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No signature file provided' });
    }
    
    // Convert file to base64
    const signatureBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    // Update hospital with signature
    const hospital = await Hospital.findByIdAndUpdate(
      hospitalId,
      { $set: { doctorSignature: signatureBase64 } },
      { new: true }
    ).select('-password');
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    
    res.json({ message: 'Signature uploaded successfully', hospital });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update base64 signature directly from drawing
router.post('/signature/data', authenticate, async (req, res) => {
  try {
    const hospitalId = req.hospital ? req.hospital._id : req.user.hospital;
    const { signature } = req.body;
    
    if (!signature) {
      return res.status(400).json({ message: 'No signature data provided' });
    }
    
    // Update hospital with signature
    const hospital = await Hospital.findByIdAndUpdate(
      hospitalId,
      { $set: { doctorSignature: signature } },
      { new: true }
    ).select('-password');
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    
    res.json({ message: 'Signature saved successfully', hospital });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete route kept for completeness
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    
    await hospital.remove();
    
    res.json({ message: 'Hospital deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;