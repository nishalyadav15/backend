// create-hospital.js - Script to create initial hospital account
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Define hospital schema (simplified, as we just need it for this script)
const hospitalSchema = new mongoose.Schema(
  {
    name: String,
    hospitalId: String,
    password: String,
    address: String,
    phoneNumber: String,
    email: String,
    // New fields for hospital branding
    branding: {
      logo: String, // Base64 encoded image or URL
      primaryColor: String,
      letterheadText: String,
    },
    // Doctor information (since hospital is the doctor)
    doctorName: String,
    doctorSignature: String, // Base64 encoded image
    doctorDesignation: String,
    doctorRegistrationNumber: String,
  },
  { timestamps: true }
);

// Custom function to get a default sample logo (optional)
const getDefaultLogo = () => {
  try {
    // Path to a default logo image file if you have one
    const logoPath = path.join(__dirname, 'assets', 'default-logo.png');
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath);
      return `data:image/png;base64,${logoData.toString('base64')}`;
    }
  } catch (err) {
    console.log('No default logo found, continuing without one');
  }
  return null;
};

async function createHospital() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/doctertia');
    console.log('Connected to MongoDB');

    // Register hospital model
    const Hospital = mongoose.model('Hospital', hospitalSchema);

    // Check if existing hospital ID
    const hospitalId = process.env.DEFAULT_HOSPITAL_ID || 'HOSP001';
    const existingHospital = await Hospital.findOne({ hospitalId });
    
    if (existingHospital) {
      console.log(`Hospital with ID ${hospitalId} already exists.`);
      console.log('Do you want to reset the password? (y/n)');
      
      // Simple way to get input in Node.js script
      process.stdin.once('data', async (data) => {
        const input = data.toString().trim().toLowerCase();
        if (input === 'y' || input === 'yes') {
          // Create password hash
          const salt = await bcrypt.genSalt(10);
          const password = 'password123';
          const hashedPassword = await bcrypt.hash(password, salt);
          
          // Update hospital password
          await Hospital.updateOne(
            { _id: existingHospital._id },
            { $set: { password: hashedPassword } }
          );
          
          console.log('Hospital password reset successfully:');
          console.log(`Hospital ID: ${hospitalId}`);
          console.log(`Password: ${password}`);
        }
        
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
        process.exit(0);
      });
      
      return; // Wait for input
    }

    // Create password hash
    const salt = await bcrypt.genSalt(10);
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create hospital with extended information
    const hospital = new Hospital({
      name: 'Test Hospital',
      hospitalId,
      password: hashedPassword,
      address: '123 Test Street, City',
      phoneNumber: '1234567890',
      email: 'hospital@example.com',
      branding: {
        logo: getDefaultLogo(),
        primaryColor: '#1a56db',
        letterheadText: 'Providing Quality Healthcare Since 2000',
      },
      doctorName: 'Dr. John Doe',
      doctorDesignation: 'MBBS, MD',
      doctorRegistrationNumber: 'MED123456',
    });

    // Save hospital
    await hospital.save();
    console.log('Hospital created successfully:');
    console.log(`Hospital ID: ${hospitalId}`);
    console.log(`Password: ${password}`);
    console.log('Additional information:');
    console.log('- Hospital Name: Test Hospital');
    console.log('- Doctor Name: Dr. John Doe');

    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error creating hospital:', error);
    if (mongoose.connection) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

createHospital();