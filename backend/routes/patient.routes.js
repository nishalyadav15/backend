// routes/patient.routes.js
const express = require('express');
const router = express.Router();
const Patient = require('../models/patient.model');
const Chat = require('../models/chat.model');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
const twilio = require('twilio');

// Initialize Twilio client (Only if environment variables are set)
let twilioClient;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

// Get all patients for a hospital
router.get('/', authenticate, async (req, res) => {
  try {
    const hospitalId = req.user ? req.user.hospital : req.hospital._id;
    
    const patients = await Patient.find({ hospital: hospitalId })
      .sort({ createdAt: -1 });
    
    res.json(patients);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get today's patients
router.get('/today', authenticate, async (req, res) => {
  try {
    const hospitalId = req.user ? req.user.hospital : req.hospital._id;
    
    // Get today's date (start and end)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Find patients with visits today
    const patients = await Patient.find({
      hospital: hospitalId,
      'visits.date': {
        $gte: today,
        $lt: tomorrow,
      },
    }).sort({ 'visits.date': -1 });
    
    res.json(patients);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get patient by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    // Check if patient belongs to the hospital
    const hospitalId = req.user ? req.user.hospital : req.hospital._id;
    if (patient.hospital.toString() !== hospitalId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(patient);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new patient
router.post('/', authenticate, async (req, res) => {
  try {
    const hospitalId = req.user ? req.user.hospital : req.hospital._id;
    
    // Create patient
    const patient = new Patient({
      ...req.body,
      hospital: hospitalId,
    });
    
    // Save patient
    await patient.save();
    
    // Create new chat session
    const chat = new Chat({
      patient: patient._id,
      hospital: hospitalId,
      chatLinkId: patient.chatLink,
      messages: [
        {
          sender: 'bot',
          content: 'Hello! I\'m your AI health assistant. Please describe your symptoms and concerns so I can help prepare for your consultation with the doctor.',
        },
      ],
    });
    
    // Save chat
    await chat.save();
    
    // Add initial visit
    patient.visits.push({
      date: new Date(),
      status: 'pending',
    });
    
    // Save visit
    await patient.save();
    
    // Send WhatsApp message with chat link if Twilio is configured
    if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
      try {
        await twilioClient.messages.create({
          body: `Hello ${patient.name}, please click on the following link to chat with our AI assistant before your consultation: https://chat.doctertia.com/chat/${patient.chatLink}`,
          from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
          to: `whatsapp:+91${patient.contactNumber}`,
        });
      } catch (twilioError) {
        console.error('Error sending WhatsApp message:', twilioError);
        // Continue even if WhatsApp message fails
      }
    } else {
      console.log('Twilio not configured, skipping WhatsApp message');
    }
    
    res.status(201).json(patient);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update patient
router.put('/:id', authenticate, async (req, res) => {
  try {
    const hospitalId = req.user ? req.user.hospital : req.hospital._id;
    
    // Find patient
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    // Check if patient belongs to the hospital
    if (patient.hospital.toString() !== hospitalId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Update patient
    const updatedPatient = await Patient.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );
    
    res.json(updatedPatient);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update visit with prescription
router.put('/:id/visit/:visitId', authenticate, async (req, res) => {
  try {
    const hospitalId = req.user ? req.user.hospital : req.hospital._id;
    
    // Find patient
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    // Check if patient belongs to the hospital
    if (patient.hospital.toString() !== hospitalId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Find visit
    const visitIndex = patient.visits.findIndex(
      (visit) => visit._id.toString() === req.params.visitId
    );
    
    if (visitIndex === -1) {
      return res.status(404).json({ message: 'Visit not found' });
    }
    
    // Update visit
    patient.visits[visitIndex] = {
      ...patient.visits[visitIndex].toObject(),
      ...req.body,
      status: 'completed',
    };
    
    // Save patient
    await patient.save();
    
    // Update patient status if this is today's visit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const visitDate = new Date(patient.visits[visitIndex].date);
    if (visitDate >= today && visitDate < tomorrow) {
      patient.status = 'completed';
      await patient.save();
    }
    
    // Send WhatsApp message with prescription if Twilio is configured
    if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
      try {
        await twilioClient.messages.create({
          body: `Hello ${patient.name}, your prescription is ready. Here are the details: ${patient.visits[visitIndex].prescription}`,
          from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
          to: `whatsapp:+91${patient.contactNumber}`,
        });
      } catch (twilioError) {
        console.error('Error sending WhatsApp message:', twilioError);
        // Continue even if WhatsApp message fails
      }
    } else {
      console.log('Twilio not configured, skipping WhatsApp message');
    }
    
    res.json(patient);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Keep the test route for now
router.get('/test', (req, res) => {
  res.json({ message: 'Patient route is working' });
});

module.exports = router;