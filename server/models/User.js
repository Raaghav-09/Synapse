const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    // Stored lowercase so exact-match lookups can use the index, and unique so
    // the database — not a check-then-act in application code — is what stops
    // two concurrent signups creating duplicate accounts.
    lowercase: true,
    unique: true,
    index: true,
  },
  password: {
    type: String,
    required: true,
  },
  accountType: {
    type: String,
    enum: ['Admin', 'Student', 'Instructor'],
    required: true,
  },
  active: {
    type: Boolean,
    default: true,
  },
  approved: {
    type: Boolean,
    default: true,
  },
  additionalDetails: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Profile',
  },
  courses: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Course',
    },
  ],
  image: {
    type: String,
  },
  token: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
  },
  courseProgress: [
    {
      type: Schema.Types.ObjectId,
      ref: 'CourseProgress',
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);