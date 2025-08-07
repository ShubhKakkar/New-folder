// In models/User.js

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    fullName: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    // New Fields
    bio: {
        type: String,
        default: ''
    },
    profilePicture: {
        type: String,
        default: '' // Will store a URL to the image
    },
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Check if the model already exists before defining it
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
