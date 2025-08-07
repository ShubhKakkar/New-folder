const express = require('express');
const authMiddleware = require('../middleware/auth');
const Post = require('../models/Post');
const User = require('../models/User');

const router = express.Router();

// --- Update a Post ---
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { imageUrl, caption } = req.body;
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }

        // Check if the user is the owner of the post
        if (post.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        post.imageUrl = imageUrl || post.imageUrl;
        post.caption = caption || post.caption;

        await post.save();
        res.json(post);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- Delete a Post ---
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }

        // Check if the user is the owner of the post
        if (post.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        await post.deleteOne();
        res.json({ msg: 'Post removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- Create a Post ---
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { imageUrl, caption } = req.body;
        const newPost = new Post({ imageUrl, caption, user: req.user.id });
        const post = await newPost.save();
        const populatedPost = await Post.findById(post._id).populate('user', ['username', 'profilePicture']);
        res.json(populatedPost);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- Get All Posts for Feed (FIXED) ---
router.get('/', authMiddleware, async (req, res) => {
    try {
        const posts = await Post.find()
            .populate('user', 'username profilePicture')
            .populate({
                path: 'comments',
                populate: {
                    path: 'user replies.user', // This will populate the user for comments and replies
                    select: 'username profilePicture'
                }
            })
            .sort({ createdAt: -1 });
        
        res.json(posts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- Get Posts for a Specific User (FIXED) ---
router.get('/user/:userId', authMiddleware, async (req, res) => {
    try {
        const posts = await Post.find({ user: req.params.userId })
            .populate('user', 'username profilePicture') // <-- Corrected: Populating user data
            .sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- Like/Unlike a Post ---
router.put('/like/:id', authMiddleware, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }
        if (post.likes.some(like => like.toString() === req.user.id)) {
            post.likes = post.likes.filter(like => like.toString() !== req.user.id);
        } else {
            post.likes.unshift(req.user.id);
        }
        await post.save();
        res.json(post.likes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- Comment on a Post or Reply to a Comment (FIXED) ---
router.post('/comment/:id', authMiddleware, async (req, res) => {
    try {
        const { text, parentId } = req.body;
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        const newComment = {
            user: req.user.id,
            text,
            replies: []
        };

        if (parentId) {
            const findAndPushReply = (comments, pId) => {
                for (let comment of comments) {
                    if (comment && comment._id && comment._id.toString() === pId) {
                        comment.replies.unshift(newComment);
                        return comment;
                    }
                    if (comment && comment.replies && comment.replies.length > 0) {
                        const found = findAndPushReply(comment.replies, pId);
                        if (found) return found;
                    }
                }
                return null;
            };
            findAndPushReply(post.comments, parentId);
        } else {
            post.comments.unshift(newComment);
        }

        await post.save();
        
        // Repopulate the entire post to get all nested user details
        const populatedPost = await Post.findById(req.params.id)
            .populate('user', 'username profilePicture')
            .populate({
                path: 'comments',
                populate: {
                    path: 'user replies.user',
                    select: 'username profilePicture'
                }
            });

        res.json(populatedPost.comments);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


module.exports = router;