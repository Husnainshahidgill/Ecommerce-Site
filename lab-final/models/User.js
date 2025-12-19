const mongoose = require('mongoose');
const userSchema = mongoose.Schema({
  name: String,
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, required: true },
  roles: { type: [String], default: ['customer'] },
});
const User = mongoose.models.User || mongoose.model('User', userSchema);
module.exports = User;
