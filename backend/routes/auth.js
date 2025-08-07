// In routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret';

// --- Signup Route ---
router.post('/signup', async (req, res) => {
    try {
        const { email, fullName, username, password } = req.body;
        if (!email || !fullName || !username || !password) {
            return res.status(400).json({ message: 'Please enter all fields.' });
        }
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists.' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = new User({ email, fullName, username, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'User created successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// --- Login Route ---
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }
        const payload = { user: { id: user.id } };
        jwt.sign(payload, JWT_SECRET, { expiresIn: '5h' }, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// --- Get Logged-in User Route (Protected) ---
router.get('/me', authMiddleware, async (req, res) => {
    try {
        // req.user is attached from authMiddleware
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Add this new route inside your routes/auth.js file

// --- Update User Profile (Protected) ---
router.put('/update', authMiddleware, async (req, res) => {
    try {
        const { fullName, bio, profilePicture } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        user.fullName = fullName || user.fullName;
        user.bio = bio || user.bio;
        user.profilePicture = profilePicture || user.profilePicture;

        await user.save();
        
        const updatedUser = await User.findById(req.user.id).select('-password');
        res.json(updatedUser);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


module.exports = router;