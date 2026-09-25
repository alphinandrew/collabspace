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
    const userName = socket.user.name;

    // Track user online sockets
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
      await userRepository.updateStatus(userId, 'online');
    }
    onlineUsers.get(userId).add(socket.id);

    // Join personal user room so server can route events directly to all sockets of this user
    const userRoom = `user_${userId}`;
    socket.join(userRoom);

    // Auto-join all group rooms this user belongs to on connection
    // Server guarantees socket joins authorized group rooms rather than relying solely on client timing
    try {
      const userGroups = await groupRepository.listUserGroups(userId);
      for (const g of userGroups) {
        const groupRoom = `group_${g.id}`;
        socket.join(groupRoom);
      }
      console.log(`[Socket:connect] Socket ${socket.id} (user: ${userName} / ${userId}) joined ${userRoom} + ${userGroups.length} group rooms.`);
    } catch (err) {
      console.error(`[Socket:connect] Error auto-joining group rooms for user ${userId}:`, err);
    }

    // Broadcast user online to all
    io.emit('presence:update', { userId, status: 'online' });

    // Join / focus a group room with membership verification
    socket.on('group:join', async ({ groupId }, callback) => {
      try {
        const membership = await groupRepository.findMember(groupId, userId);
        if (!membership) {
          console.warn(`[Socket:group:join] Unauthorized join attempt by user ${userId} for group ${groupId}`);
          if (typeof callback === 'function') {
            return callback({ success: false, error: 'Unauthorized: not a group member.' });
          }
          return;
        }

        const room = `group_${groupId}`;
        socket.join(room);
        socket.activeGroupId = groupId;
        console.log(`[Socket:group:join] Socket ${socket.id} (user: ${userId}) confirmed in ${room}`);

        if (typeof callback === 'function') {
          callback({ success: true, room });
        }
      } catch (err) {
        console.error(`[Socket:group:join] Error:`, err);
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    // Leave a group active focus
    socket.on('group:leave', ({ groupId }) => {
      if (socket.activeGroupId === groupId) {
        socket.activeGroupId = null;
      }
      console.log(`[Socket:group:leave] Socket ${socket.id} unfocused group ${groupId}`);
    });

    // Typing indicators
    socket.on('chat:typing', ({ groupId, isTyping }) => {
      if (!groupId) return;
      socket.to(`group_${groupId}`).emit('chat:typing', {
        groupId,
        userId: socket.user.id,
        userName: socket.user.name,
        userAvatar: socket.user.avatar || null,
        isTyping: Boolean(isTyping),
      });
    });

    // Setup WebRTC Call Signaling for this socket
    setupCallSignaler(io, socket);

    // Disconnect handling
    socket.on('disconnect', async (reason) => {
      console.log(`[Socket:disconnect] Socket ${socket.id} (user: ${userId}) disconnected: ${reason}`);
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
