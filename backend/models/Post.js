// In models/Post.js
const mongoose = require('mongoose');

// We define the Comment schema separately to allow for recursion
const CommentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    replies: [this] // A comment can have replies of the same schema
}, { timestamps: true });


const PostSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    caption: {
        type: String,
        default: ''
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    comments: [CommentSchema], // Use the new CommentSchema
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.models.Post || mongoose.model('Post', PostSchema);