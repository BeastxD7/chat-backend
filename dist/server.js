"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const mongodb_1 = require("mongodb");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});
// Ensure environment variables are set
const uri = process.env.MONGODB_URI;
const PORT = process.env.PORT || 4000;
if (!uri) {
    console.error('MONGODB_URI environment variable is not set');
    process.exit(1);
}
const client = new mongodb_1.MongoClient(uri);
let messagesCollection = null;
let userColorsCollection = null;
function connectToDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield client.connect();
            const database = client.db('chat-app');
            messagesCollection = database.collection('messages');
            userColorsCollection = database.collection('userColors');
            console.log('Connected to MongoDB');
        }
        catch (error) {
            console.error('Error connecting to MongoDB:', error);
            process.exit(1);
        }
    });
}
connectToDatabase();
io.on('connection', (socket) => {
    console.log('A user connected');
    if (!messagesCollection || !userColorsCollection) {
        console.error('Collections are not initialized');
        socket.emit('error', 'Database not connected');
        return;
    }
    // Send existing messages to the newly connected user
    messagesCollection.find().toArray()
        .then((messages) => {
        console.log('Sending existing messages to the user');
        socket.emit('load-messages', messages);
    })
        .catch((err) => {
        console.error('Error fetching messages from MongoDB:', err);
    });
    // Send existing user colors to the newly connected user
    userColorsCollection.find().toArray()
        .then((userColors) => {
        console.log('Sending existing user colors to the user');
        socket.emit('load-user-colors', userColors);
    })
        .catch((err) => {
        console.error('Error fetching user colors from MongoDB:', err);
    });
    socket.on('message', (data) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { username, message } = data;
            console.log(`Received message from ${username}: ${message}`);
            // Store the message in the database
            const newMessage = { username, message, timestamp: new Date() };
            if (messagesCollection) {
                yield messagesCollection.insertOne(newMessage);
            }
            else {
                console.error('messagesCollection is null');
            }
            // Broadcast the message to all clients
            io.emit('message', newMessage);
        }
        catch (err) {
            console.error('Error handling message:', err);
            socket.emit('error', 'Failed to process the message');
        }
    }));
    socket.on('set-color', (data) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { username, color } = data;
            console.log(`Setting color for ${username}: ${color}`);
            // Save or update the user color in the database
            if (userColorsCollection) {
                yield userColorsCollection.updateOne({ username }, { $set: { color } }, { upsert: true });
            }
            else {
                console.error('userColorsCollection is null');
            }
            // Notify all clients about the updated color
            io.emit('update-user-color', { username, color });
        }
        catch (err) {
            console.error('Error setting color:', err);
        }
    }));
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});
httpServer.listen(PORT, () => {
    console.log(`Socket.IO server running at http://localhost:${PORT}`);
});
