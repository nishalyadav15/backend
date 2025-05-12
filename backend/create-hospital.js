// create-hospital.js - Script to create initial hospital account
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Define hospital schema (simplified, as we just need it for this script)
const hospitalSchema = new mongoose.Schema(
  {
    name: String,
    hospitalId: String,
    password: String,
    address: String,
    phoneNumber: String,
  },
  { timestamps: true }
);

async function createHospital() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/doctertia');
    console.log('Connected to MongoDB');

    // Register hospital model
    const Hospital = mongoose.model('Hospital', hospitalSchema);

    // Check if hospital already exists
    const existingHospital = await Hospital.findOne({ hospitalId: 'HOSP001' });
    if (existingHospital) {
      console.log('Hospital with ID HOSP001 already exists');
      await mongoose.connection.close();
      return;
    }

    // Create password hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // Create hospital
    const hospital = new Hospital({
      name: 'Test Hospital',
      hospitalId: 'HOSP001',
      password: hashedPassword,
      address: '123 Test Street, City',
      phoneNumber: '1234567890',
    });

    // Save hospital
    await hospital.save();
    console.log('Hospital created successfully:');
    console.log('Hospital ID: HOSP001');
    console.log('Password: password123');

    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error creating hospital:', error);
    if (mongoose.connection) {
      await mongoose.connection.close();
    }
  }
}

createHospital();