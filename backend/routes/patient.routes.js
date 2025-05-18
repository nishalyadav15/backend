// routes/patient.routes.js
const express = require('express');
const router = express.Router();
const Patient = require('../models/patient.model');
const Chat = require('../models/chat.model');
const Hospital = require('../models/hospital.model');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
const twilio = require('twilio');
const path = require('path');
const fs = require('fs');

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

// Update visit with prescription - SIMPLIFIED VERSION WITHOUT PDF GENERATION
// Update visit with prescription - Update this section in routes/patient.routes.js

// Update this section in routes/patient.routes.js
router.put('/:id/visit/:visitId', authenticate, async (req, res) => {
  try {
    console.log('Received visit update request');
    console.log('Request body:', req.body);
    
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
    
    // Extract form data
    const { symptoms, diagnosis, prescription, doctorNotes } = req.body;
    
    // Create updated visit object with existing data
    const updatedVisit = patient.visits[visitIndex].toObject();
    
    // Update only the fields that are provided
    if (symptoms !== undefined) updatedVisit.symptoms = symptoms;
    if (diagnosis !== undefined) updatedVisit.diagnosis = diagnosis;
    if (prescription !== undefined) updatedVisit.prescription = prescription;
    if (doctorNotes !== undefined) updatedVisit.doctorNotes = doctorNotes;
    updatedVisit.status = 'completed';
    
    // Apply the update
    patient.visits[visitIndex] = updatedVisit;
    
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
    
    // Send prescription to patient (either as PDF or text)
    try {
      // Get hospital data for prescription
      const hospital = await Hospital.findById(hospitalId);
      
      if (!hospital) {
        throw new Error('Hospital not found');
      }
      
      // Import the PDF generation utility
      const { generatePrescriptionPDF } = require('../utils/pdf.utils');
      
      // Generate the PDF file
      console.log('Generating PDF...');
      const { filePath, fileName } = await generatePrescriptionPDF(
        updatedVisit.prescription,
        patient,
        hospital,
        updatedVisit
      );
      console.log('PDF generated at:', filePath);
      
      // Make sure the server can serve this file
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
      const pdfUrl = `${baseUrl}/temp/${fileName}`;
      console.log('PDF URL:', pdfUrl);

      // Check if the file actually exists
      if (!fs.existsSync(filePath)) {
        throw new Error('PDF file was not created properly');
      }
      
      // Set a timeout to ensure file is fully written
      setTimeout(async () => {
        if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
          try {
            console.log('Sending WhatsApp with PDF attachment');
            // Send WhatsApp message with PDF attachment
            const message = await twilioClient.messages.create({
              body: `Hello ${patient.name}, your prescription is ready.`,
              mediaUrl: [pdfUrl],
              from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
              to: `whatsapp:+91${patient.contactNumber}`,
            });
            
            console.log('WhatsApp message sent successfully:', message.sid);
            
            // Delete the PDF file after 5 minutes
            setTimeout(() => {
              try {
                fs.unlinkSync(filePath);
                console.log('Deleted temporary PDF file');
              } catch (fileError) {
                console.error('Error deleting temporary file:', fileError);
              }
            }, 300000); // 5 minutes
          } catch (twilioError) {
            console.error('Error sending WhatsApp with PDF:', twilioError);
            
            // Try sending a plain text message as fallback
            try {
              console.log('Sending fallback text message');
              await twilioClient.messages.create({
                body: `Hello ${patient.name}, your prescription is ready. Details: ${updatedVisit.prescription}`,
                from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
                to: `whatsapp:+91${patient.contactNumber}`,
              });
              console.log('Fallback text message sent successfully');
            } catch (fallbackError) {
              console.error('Error sending fallback message:', fallbackError);
            }
            
            // Clean up the file
            try {
              fs.unlinkSync(filePath);
            } catch (fileError) {
              console.error('Error deleting temp file:', fileError);
            }
          }
        } else {
          console.log('Twilio not configured, skipping WhatsApp message');
          
          // Clean up the temp file if not sending via Twilio
          try {
            fs.unlinkSync(filePath);
          } catch (fileError) {
            console.error('Error deleting temp file:', fileError);
          }
        }
      }, 1000); // Wait 1 second to ensure the file is readable
      
    } catch (pdfError) {
      console.error('Error in PDF generation or sending:', pdfError);
      
      // Send a text message as fallback on PDF error
      if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
        try {
          await twilioClient.messages.create({
            body: `Hello ${patient.name}, your prescription is ready. Details: ${updatedVisit.prescription}`,
            from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
            to: `whatsapp:+91${patient.contactNumber}`,
          });
          console.log('Fallback WhatsApp text message sent successfully');
        } catch (fallbackError) {
          console.error('Error sending fallback message:', fallbackError);
        }
      }
    }
    
    res.json(patient);
  } catch (error) {
    console.error('Patient visit update error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;