// models/hospital.model.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const hospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    hospitalId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    // New fields for hospital branding
    branding: {
      logo: {
        type: String, // Base64 encoded image or URL
        default: null,
      },
      primaryColor: {
        type: String,
        default: '#ffffff',
      },
      letterheadText: {
        type: String,
        default: '',
      },
    },
    // Doctor information (since hospital is the doctor)
    doctorName: {
      type: String,
      default: '',
    },
    doctorSignature: {
      type: String, // Base64 encoded image
      default: null,
    },
    doctorDesignation: {
      type: String,
      default: '',
    },
    doctorRegistrationNumber: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Hash password before saving
hospitalSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
hospitalSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

const Hospital = mongoose.model('Hospital', hospitalSchema);

module.exports = Hospital;