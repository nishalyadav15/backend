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
const cloudinary = require('cloudinary').v2;
const axios = require('axios'); // Added missing semicolon

// Initialize Twilio client (Only if environment variables are set)
let twilioClient;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}
//configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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
// Send prescription to patient - USING EXPRESS STATIC FILES (NO CLOUDINARY)
    try {
      // Get hospital data for prescription
      const hospital = await Hospital.findById(hospitalId);
      
      if (!hospital) {
        throw new Error('Hospital not found');
      }
      
      // Import the PDF generation utility
      const { generatePrescriptionPDF } = require('../utils/pdf.utils');
      
      console.log('Generating PDF...');
      const { filePath, fileName } = await generatePrescriptionPDF(
        updatedVisit.prescription,
        patient,
        hospital,
        updatedVisit
      );
      console.log('PDF generated at:', filePath);
      
      // Check if the file actually exists
      if (!fs.existsSync(filePath)) {
        throw new Error('PDF file was not created properly');
      }
      
      // Get file stats and validate
      const stats = fs.statSync(filePath);
      console.log(`Local PDF file size: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        throw new Error('Generated PDF file is empty');
      }
      
      // Validate PDF header
      const fileBuffer = fs.readFileSync(filePath);
      const header = fileBuffer.toString('ascii', 0, 4);
      console.log(`PDF header: "${header}"`);
      
      if (header !== '%PDF') {
        throw new Error('Invalid PDF file - corrupted header');
      }
      
      // SKIP CLOUDINARY - Use local server with ngrok/public URL
      console.log('Using local server for file hosting...');
      
      // Use environment variable for the base URL (set this to your ngrok URL)
      const baseUrl = process.env.PUBLIC_BASE_URL || process.env.NGROK_URL || 'https://your-ngrok-url.ngrok.io';
      
      if (baseUrl.includes('your-ngrok-url')) {
        console.error('WARNING: Please set NGROK_URL in your .env file!');
        console.log('1. Run: ngrok http 5000');
        console.log('2. Copy the HTTPS URL from ngrok');
        console.log('3. Add NGROK_URL=https://your-actual-ngrok-url.ngrok.io to your .env file');
        throw new Error('NGROK_URL not configured. Please set up ngrok first.');
      }
      
      // Use the working debug route (we confirmed this works!)
      const pdfUrl = `${baseUrl}/api/patients/test-file/${fileName}`;
      console.log('PDF URL (via working debug route):', pdfUrl);
      
      // Test the URL accessibility
      console.log('Testing PDF URL accessibility...');
      try {
        const response = await axios.head(pdfUrl, { timeout: 10000 });
        console.log('PDF URL test PASSED - Status:', response.status);
        console.log('Content-Type:', response.headers['content-type']);
        console.log('Content-Length:', response.headers['content-length']);
      } catch (urlError) {
        console.error('PDF URL test FAILED:', urlError.message);
        console.error('Make sure:');
        console.error('1. ngrok is running: ngrok http 5000');
        console.error('2. Express static middleware is set up: app.use("/temp", express.static("temp"))');
        console.error('3. NGROK_URL is set correctly in .env');
        throw new Error('PDF URL is not accessible via ngrok');
      }
      
      // Send WhatsApp message with PDF
      if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
        try {
          console.log('Sending WhatsApp with PDF attachment...');
          console.log('WhatsApp details:');
          console.log('- To:', `whatsapp:+91${patient.contactNumber}`);
          console.log('- From:', `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`);
          console.log('- Media URL:', pdfUrl);
          
          const message = await twilioClient.messages.create({
            body: `Hello ${patient.name}, your prescription is ready.`,
            mediaUrl: [pdfUrl],
            from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
            to: `whatsapp:+91${patient.contactNumber}`,
          });
          
          console.log('WhatsApp message sent successfully!');
          console.log('- Message SID:', message.sid);
          console.log('- Status:', message.status);
          
          // Delete the PDF file after 10 minutes (keep it longer for delivery)
          setTimeout(() => {
            try {
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('Deleted temporary PDF file after delivery');
              }
            } catch (fileError) {
              console.error('Error deleting temporary file:', fileError);
            }
          }, 600000); // 10 minutes
          
        } catch (twilioError) {
          console.error('Error sending WhatsApp with PDF:');
          console.error('- Error code:', twilioError.code);
          console.error('- Error message:', twilioError.message);
          
          // Fallback text message
          try {
            console.log('Sending fallback text message...');
            await twilioClient.messages.create({
              body: `Hello ${patient.name}, your prescription is ready. Please contact the clinic for your prescription document. Details: ${updatedVisit.prescription}`,
              from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
              to: `whatsapp:+91${patient.contactNumber}`,
            });
            console.log('Fallback text message sent successfully');
          } catch (fallbackError) {
            console.error('Error sending fallback message:', fallbackError);
          }
          
          // Clean up file on error
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (cleanupError) {
            console.error('Error during cleanup:', cleanupError);
          }
        }
      } else {
        console.log('Twilio not configured, skipping WhatsApp message');
      }
      
    } catch (pdfError) {
      console.error('Error in PDF generation or sending:');
      console.error('- Error message:', pdfError.message);
      console.error('- Error stack:', pdfError.stack);
      
      // Clean up local file if it exists
      try {
        if (typeof filePath !== 'undefined' && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('Cleaned up PDF file after error');
        }
      } catch (cleanupError) {
        console.error('Error during file cleanup:', cleanupError);
      }
      
      // Send a text message as fallback on PDF error
      if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
        try {
          console.log('Sending fallback message due to PDF error...');
          await twilioClient.messages.create({
            body: `Hello ${patient.name}, your prescription is ready. Please contact the clinic for your prescription document. Details: ${updatedVisit.prescription}`,
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


// Debug route to test file serving
router.get('/test-file/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../temp', filename);
    
    console.log('Trying to serve file:', filePath);
    console.log('File exists:', fs.existsSync(filePath));
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found', path: filePath });
    }
    
    const stats = fs.statSync(filePath);
    console.log('File size:', stats.size);
    
    // Serve the file directly
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    console.log('File served successfully');
    
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug route to list temp files
router.get('/debug/temp-files', (req, res) => {
  try {
    const tempDir = path.join(__dirname, '../temp');
    console.log('Temp directory:', tempDir);
    
    if (!fs.existsSync(tempDir)) {
      return res.json({ error: 'Temp directory does not exist', path: tempDir });
    }
    
    const files = fs.readdirSync(tempDir);
    console.log('Files in temp:', files);
    
    res.json({ 
      tempDir, 
      files,
      fileCount: files.length 
    });
    
  } catch (error) {
    console.error('Error reading temp directory:', error);
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;