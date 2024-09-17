import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { Collection, Document, MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
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

const client = new MongoClient(uri);
let messagesCollection: Collection<Document> | null = null;
let userColorsCollection: Collection<Document> | null = null;

async function connectToDatabase() {
  try {
    await client.connect();
    const database = client.db('chat-app');
    messagesCollection = database.collection('messages');
    userColorsCollection = database.collection('userColors');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

connectToDatabase();

io.on('connection', (socket: Socket) => {
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

  socket.on('set-color', async (data) => {
    try {
      const { username, color } = data;
      console.log(`Setting color for ${username}: ${color}`);
  
      // Save or update the user color in the database
      if (userColorsCollection) {
        await userColorsCollection.updateOne(
          { username },
          { $set: { color } },
          { upsert: true }
        );
      } else {
        console.error('userColorsCollection is null');
      }
  
      // Notify all clients about the updated color
      io.emit('update-user-color', { username, color });
    } catch (err) {
      console.error('Error setting color:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running at http://localhost:${PORT}`);
});
