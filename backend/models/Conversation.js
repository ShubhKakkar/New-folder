// In models/Conversation.js
const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    messages: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    }]
}, { timestamps: true });

module.exports = mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema);