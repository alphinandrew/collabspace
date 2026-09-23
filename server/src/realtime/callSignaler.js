const callRepository = require('../db/repositories/callRepository');

// Map to track active in-memory call state: groupId -> CallState
const activeCalls = new Map();

function setupCallSignaler(io, socket) {
  // 1. Initiate Call
  socket.on('call:initiate', async ({ groupId, callType = 'video' }, callback) => {
    try {
      const user = socket.user;
      let callState = activeCalls.get(groupId);

      if (!callState) {
        // Create DB record
        const callId = 'cal_' + Date.now();
        await callRepository.create({
          id: callId,
          groupId,
          initiatedBy: user.id,
          callType,
        });

        callState = {
          callId,
          groupId,
          callType,
          initiator: user,
          startedAt: new Date().toISOString(),
          participants: new Map(), // socketId -> { user, isMuted, isCameraOff }
        };
        activeCalls.set(groupId, callState);
      }

      // Add initiator as first participant
      callState.participants.set(socket.id, {
        socketId: socket.id,
        user,
        isMuted: false,
        isCameraOff: false,
      });

      // Broadcast incoming call notification to all other members in the group
      socket.to(`group_${groupId}`).emit('call:incoming', {
        groupId,
        callId: callState.callId,
        callType: callState.callType,
        initiator: user,
      });

      if (typeof callback === 'function') {
        callback({ success: true, callId: callState.callId });
      }
    } catch (err) {
      console.error('Call initiate error:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // 2. Join Call
  socket.on('call:join', ({ groupId, isMuted = false, isCameraOff = false }, callback) => {
    const user = socket.user;
    let callState = activeCalls.get(groupId);

    if (!callState) {
      // Create if joining directly
      const callId = 'cal_' + Date.now();
      callState = {
        callId,
        groupId,
        callType: 'video',
        initiator: user,
        startedAt: new Date().toISOString(),
        participants: new Map(),
      };
      activeCalls.set(groupId, callState);
    }

    // Add participant
    callState.participants.set(socket.id, {
      socketId: socket.id,
      user,
      isMuted,
      isCameraOff,
    });

    // Notify others in call
    socket.to(`group_${groupId}`).emit('call:peer-joined', {
      socketId: socket.id,
      user,
      isMuted,
      isCameraOff,
    });

    // Return current participants to caller
    const existingParticipants = [];
    for (const [sId, p] of callState.participants.entries()) {
      if (sId !== socket.id) {
        existingParticipants.push(p);
      }
    }

    if (typeof callback === 'function') {
      callback({
        success: true,
        callId: callState.callId,
        participants: existingParticipants,
      });
    }
  });

  // 3. WebRTC Offer Relay
  socket.on('call:offer', ({ targetSocketId, offer }) => {
    io.to(targetSocketId).emit('call:offer', {
      callerSocketId: socket.id,
      callerUser: socket.user,
      offer,
    });
  });

  // 4. WebRTC Answer Relay
  socket.on('call:answer', ({ targetSocketId, answer }) => {
    io.to(targetSocketId).emit('call:answer', {
      responderSocketId: socket.id,
      answer,
    });
  });

  // 5. ICE Candidate Relay
  socket.on('call:ice-candidate', ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit('call:ice-candidate', {
      senderSocketId: socket.id,
      candidate,
    });
  });

  // 6. Media State Toggle (Mute mic or camera)
  socket.on('call:toggle-media', ({ groupId, isMuted, isCameraOff }) => {
    const callState = activeCalls.get(groupId);
    if (callState && callState.participants.has(socket.id)) {
      const p = callState.participants.get(socket.id);
      p.isMuted = isMuted;
      p.isCameraOff = isCameraOff;
      socket.to(`group_${groupId}`).emit('call:peer-media-toggled', {
        socketId: socket.id,
        isMuted,
        isCameraOff,
      });
    }
  });

  // 7. Leave Call
  socket.on('call:leave', async ({ groupId }) => {
    handleCallLeave(io, socket, groupId);
  });
}

async function handleCallLeave(io, socket, groupId) {
  const callState = activeCalls.get(groupId);
  if (!callState) return;

  if (callState.participants.has(socket.id)) {
    callState.participants.delete(socket.id);

    // Broadcast peer left
    socket.to(`group_${groupId}`).emit('call:peer-left', {
      socketId: socket.id,
      userId: socket.user ? socket.user.id : null,
    });

    // If call is now empty, end it in DB and memory
    if (callState.participants.size === 0) {
      activeCalls.delete(groupId);
      try {
        const now = new Date().toISOString();
        await callRepository.updateStatus(callState.callId, 'ended', now);
        io.to(`group_${groupId}`).emit('call:ended', {
          callId: callState.callId,
          groupId,
        });
      } catch (err) {
        console.error('Error ending call in DB:', err);
      }
    }
  }
}

function handleSocketDisconnect(io, socket) {
  // Check any active calls this socket was participating in
  for (const [groupId, callState] of activeCalls.entries()) {
    if (callState.participants.has(socket.id)) {
      handleCallLeave(io, socket, groupId);
    }
  }
}

module.exports = {
  setupCallSignaler,
  handleSocketDisconnect,
  activeCalls,
};
