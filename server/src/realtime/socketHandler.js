const jwt = require('jsonwebtoken');
const config = require('../config');
const userRepository = require('../db/repositories/userRepository');
const groupRepository = require('../db/repositories/groupRepository');
const { setupCallSignaler, handleSocketDisconnect } = require('./callSignaler');

// Track online users: userId -> Set of socketIds
const onlineUsers = new Map();

function initSocketIO(io) {
  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) {
        return next(new Error('Authentication required for realtime connection.'));
      }

      const decoded = jwt.verify(token, config.authSecret);
      const user = await userRepository.findById(decoded.id);

      if (!user) {
        return next(new Error('User not found.'));
      }

      socket.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      };

      next();
    } catch (err) {
      next(new Error('Invalid socket authentication token.'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user.id;

    // Track user online sockets
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
      await userRepository.updateStatus(userId, 'online');
    }
    onlineUsers.get(userId).add(socket.id);

    // Broadcast user online to all
    io.emit('presence:update', { userId, status: 'online' });

    // Join a group room with membership verification
    socket.on('group:join', async ({ groupId }, callback) => {
      try {
        const membership = await groupRepository.findMember(groupId, userId);
        if (!membership) {
          if (typeof callback === 'function') {
            return callback({ success: false, error: 'Unauthorized: not a group member.' });
          }
          return;
        }

        const room = `group_${groupId}`;
        socket.join(room);

        if (typeof callback === 'function') {
          callback({ success: true, room });
        }
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    // Leave a group room
    socket.on('group:leave', ({ groupId }) => {
      socket.leave(`group_${groupId}`);
    });

    // Typing indicators
    socket.on('chat:typing', ({ groupId, isTyping }) => {
      socket.to(`group_${groupId}`).emit('chat:typing', {
        groupId,
        userId: socket.user.id,
        userName: socket.user.name,
        isTyping,
      });
    });

    // Setup WebRTC Call Signaling for this socket
    setupCallSignaler(io, socket);

    // Disconnect handling
    socket.on('disconnect', async () => {
      handleSocketDisconnect(io, socket);

      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          await userRepository.updateStatus(userId, 'offline');
          io.emit('presence:update', { userId, status: 'offline' });
        }
      }
    });
  });

  return io;
}

module.exports = {
  initSocketIO,
  onlineUsers,
};
