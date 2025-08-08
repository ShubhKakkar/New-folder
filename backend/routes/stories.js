const express = require('express');
const authMiddleware = require('../middleware/auth');
const Story = require('../models/Story');
const User = require('../models/User');

const router = express.Router();

// Create a new story
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { imageUrl } = req.body;
        const newStory = new Story({ user: req.user.id, imageUrl });
        await newStory.save();
        res.status(201).json(newStory);
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Server Error");
    }
});

// Get stories from users the current user follows, and the current user's own stories
router.get('/', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('following');
        
        // Combine the current user's ID with the IDs of the people they follow
        const userIdsToFetchStories = [req.user.id, ...user.following];

        const stories = await Story.find({ user: { $in: userIdsToFetchStories } })
            .populate('user', 'username profilePicture')
            .sort({ createdAt: -1 });

        res.json(stories);
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Server Error");
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);

        if (!story) {
            return res.status(404).json({ msg: 'Story not found' });
        }

        // Check if the user owns the story
        if (story.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        // Use deleteOne() to remove the story
        await story.deleteOne(); 
        res.json({ msg: 'Story removed' });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Story not found' });
        }
        res.status(500).send('Server Error');
    }
});

module.exports = router;