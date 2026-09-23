const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Server } = require('socket.io');
const config = require('./config');
const routes = require('./routes');
const { getDatabase } = require('./db/database');
const { initSocketIO } = require('./realtime/socketHandler');

async function bootstrap() {
  const app = express();
  const server = http.createServer(app);

  // Initialize SQLite database
  await getDatabase();
  console.log('✅ SQLite persistent database initialized successfully.');

  // CORS configuration
  app.use(cors({
    origin: '*',
    credentials: true,
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Socket.IO configuration
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Attach io to express app for controller access
  app.set('io', io);

  // Initialize Socket.IO handlers
  initSocketIO(io);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'CollabSpace Backend',
      timestamp: new Date().toISOString(),
      storageDriver: config.storage.driver,
      dbDriver: config.db.driver,
    });
  });

  // Mount API routes
  app.use('/api', routes);

  // Serve static frontend client build if present
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  // Centralized Error Handling Middleware
  app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    if (err.name === 'MulterError') {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `File too large. Maximum size is ${config.storage.maxFileSizeMb}MB.` });
      }
      return res.status(400).json({ error: err.message });
    }
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
    });
  });

  // Start Server
  server.listen(config.port, () => {
    console.log(`🚀 CollabSpace Server running on http://localhost:${config.port}`);
    console.log(`📡 WebSocket / Socket.IO ready on port ${config.port}`);
  });

  return { app, server, io };
}

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { bootstrap };
