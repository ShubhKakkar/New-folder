// In routes/users.js

const express = require('express');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// --- Get all users (for suggestions) ---
router.get('/', authMiddleware, async (req, res) => {
    try {
        // Find all users except the currently logged-in one
        const users = await User.find({ _id: { $ne: req.user.id } }).select('-password');
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- Get a specific user's profile ---
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('following', ['username', 'profilePicture'])
            .populate('followers', ['username', 'profilePicture'])
            .populate({
                path: 'bookmarks',
                populate: {
                    path: 'user', // Populate user for each bookmarked post
                    select: 'username profilePicture'
                }
            });

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- Follow/Unfollow a user ---
router.put('/follow/:id', authMiddleware, async (req, res) => {
    try {
        const userToFollow = await User.findById(req.params.id);
        const currentUser = await User.findById(req.user.id);

        if (!userToFollow || !currentUser) {
            return res.status(404).json({ msg: 'User not found' });
        }

        if (currentUser.following.includes(userToFollow.id)) {
            // --- Unfollow logic ---
            currentUser.following = currentUser.following.filter(
                (followingId) => followingId.toString() !== userToFollow.id.toString()
            );
            userToFollow.followers = userToFollow.followers.filter(
                (followerId) => followerId.toString() !== currentUser.id.toString()
            );
        } else {
            // --- Follow logic ---
            currentUser.following.unshift(userToFollow.id);
            userToFollow.followers.unshift(currentUser.id);
        }

        await currentUser.save();
        await userToFollow.save();

        res.json(currentUser);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;