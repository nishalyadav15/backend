// models/patient.model.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const patientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      required: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true,
    },
    contactNumber: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
    },
    chatLink: {
      type: String,
      unique: true,
    },
    medicalHistory: {
      type: String,
    },
    status: {
      type: String,
      enum: ['waiting', 'in-consultation', 'completed'],
      default: 'waiting',
    },
    visits: [
      {
        date: {
          type: Date,
          default: Date.now,
        },
        symptoms: String,
        diagnosis: String,
        prescription: String,
        doctorNotes: String,
        chatSummary: String,
        status: {
          type: String,
          enum: ['pending', 'completed'],
          default: 'pending',
        },
      },
    ],
  },
  { timestamps: true }
);

// Generate unique chat link before saving
patientSchema.pre('save', function (next) {
  if (!this.isModified('name') && this.chatLink) return next();
  
  const uniqueId = crypto.randomBytes(8).toString('hex');
  this.chatLink = uniqueId;
  next();
});

const Patient = mongoose.model('Patient', patientSchema);

module.exports = Patient;