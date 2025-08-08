const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const http = require('http');
const { Server } = require("socket.io");
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || 'YOUR_MONGODB_CONNECTION_STRING';
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected successfully!'))
    .catch(err => console.error('MongoDB connection error:', err));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/stories', require('./routes/stories'));

let onlineUsers = new Map();

// Socket.io Connection Logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinRoom', (userId) => {
        socket.join(userId);
        onlineUsers.set(userId, socket.id);
        
        // Broadcast the online user list to all connected clients
        io.emit('onlineUsers', Array.from(onlineUsers.keys()));
        console.log(`User ${socket.id} with ID ${userId} joined room and is online.`);
    });

    socket.on('sendMessage', async ({ senderId, receiverId, message }) => {
        try {
            const newMessage = new Message({ senderId, receiverId, message });
            await newMessage.save();

            let conversation = await Conversation.findOne({
                participants: { $all: [senderId, receiverId] }
            });

            if (!conversation) {
                conversation = await Conversation.create({
                    participants: [senderId, receiverId]
                });
            }

            conversation.messages.push(newMessage._id);
            await conversation.save();
            
            const sender = await User.findById(senderId).select('username profilePicture');

            const messageData = {
                _id: newMessage._id,
                senderId: {
                    _id: sender._id,
                    username: sender.username,
                    profilePicture: sender.profilePicture
                },
                message: newMessage.message,
                createdAt: newMessage.createdAt
            };

            io.to(receiverId).emit('receiveMessage', messageData);
        } catch (error) {
            console.log("Error sending message: ", error);
        }
    });

    socket.on('bookmarkPost', async ({ userId, postId, action }) => {
        try {
            const user = await User.findById(userId);
            if (!user) {
                console.error('User not found');
                return;
            }

            const isBookmarked = user.bookmarks.some(bookmarkId => bookmarkId.toString() === postId);

            if (action === 'add' && !isBookmarked) {
                user.bookmarks.unshift(postId);
            } else if (action === 'remove' && isBookmarked) {
                user.bookmarks = user.bookmarks.filter(
                    (bookmarkId) => bookmarkId.toString() !== postId
                );
            }

            await user.save();
            
            // Emit the updated bookmarks array to the user's room to update all their devices
            io.to(userId).emit('post-bookmarked', { postId, bookmarks: user.bookmarks });
        } catch (error) {
            console.error("Error bookmarking post:", error);
        }
    });

    socket.on('disconnect', () => {
        let disconnectedUserId = null;
        for (let [userId, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) {
                disconnectedUserId = userId;
                onlineUsers.delete(userId);
                break;
            }
        }
        if (disconnectedUserId) {
            // Broadcast the updated online user list to all clients
            io.emit('onlineUsers', Array.from(onlineUsers.keys()));
            console.log(`User with ID ${disconnectedUserId} disconnected.`);
        }
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});