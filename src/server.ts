import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { Collection, Document, MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Configure CORS to allow requests from specific origins
app.use(cors({
  origin: ['http://localhost:3000', 'https://langhub2.vercel.app'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'https://langhub2.vercel.app'],
  },
});

// Ensure environment variables are set
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI environment variable is not set');
  process.exit(1); // Exit if the environment variable is not set
}

const client = new MongoClient(uri);
let messagesCollection: Collection<Document> | null = null;

async function connectToDatabase() {
  try {
    await client.connect();
    const database = client.db('chat-app');
    messagesCollection = database.collection('messages');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

// Connect to the database
connectToDatabase()
  .then(() => {
    console.log('Database connection established');
  })
  .catch((error) => {
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  });

// Handle socket connection
io.on('connection', (socket: Socket) => {
  console.log('A user connected');

  if (!messagesCollection) {
    console.error('messagesCollection is not initialized');
    socket.emit('error', 'Database not connected');
    return;
  }

  // Send existing messages to the newly connected user
  messagesCollection
    .find()
    .toArray()
    .then((messages) => {
      console.log('Sending existing messages to the user');
      socket.emit('load-messages', messages);
    })
    .catch((err) => {
      console.error('Error fetching messages from MongoDB:', err);
    });

  socket.on('message', async (data) => {
    try {
      const { username, message } = data;
      console.log(`Received message from ${username}: ${message}`);

      // Store the message in the database
      const newMessage = { username, message, timestamp: new Date() };
      if (messagesCollection) {
        await messagesCollection.insertOne(newMessage);
      } else {
        console.error('messagesCollection is null');
      }

      // Broadcast the message to all clients
      io.emit('message', newMessage);
    } catch (err) {
      console.error('Error handling message:', err);
      socket.emit('error', 'Failed to process the message');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running at http://localhost:${PORT}`);
});
