// In routes/messages.js
const express = require('express');
const authMiddleware = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

const router = express.Router();

// Get messages between two users
router.get('/:userId', authMiddleware, async (req, res) => {
    try {
        const receiverId = req.params.userId;
        const senderId = req.user.id;

        const conversation = await Conversation.findOne({
            participants: { $all: [senderId, receiverId] }
        }).populate({
            path: 'messages',
            populate: {
                path: 'senderId',
                select: 'username profilePicture _id'
            }
        });

        if (!conversation) {
            return res.json([]);
        }

        res.json(conversation.messages);
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Server Error");
    }
});

module.exports = router;