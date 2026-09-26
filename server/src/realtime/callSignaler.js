const callRepository = require('../db/repositories/callRepository');
const groupRepository = require('../db/repositories/groupRepository');
const { getDatabase } = require('../db/database');

// Map to track active in-memory call state: groupId -> CallState
const activeCalls = new Map();

function getActiveCallSummary(groupId) {
  const callState = activeCalls.get(groupId);
  if (!callState || callState.participants.size === 0) {
    return { active: false, groupId };
  }

  const participants = Array.from(callState.participants.values()).map((p) => ({
    userId: p.user?.id,
    userName: p.user?.name,
    userAvatar: p.user?.avatar,
    isMuted: p.isMuted,
    isCameraOff: p.isCameraOff,
    isScreenSharing: p.isScreenSharing,
  }));

  return {
    active: true,
    callId: callState.callId,
    groupId,
    groupName: callState.groupName,
    callType: callState.callType,
    initiator: callState.initiator,
    startedAt: callState.startedAt,
    participantCount: callState.participants.size,
    participants,
  };
}

function broadcastActiveCallState(io, groupId) {
  if (!io || !groupId) return;
  const summary = getActiveCallSummary(groupId);
  io.to(`group_${groupId}`).emit('call:active', summary);
}

function setupCallSignaler(io, socket) {
  // 0. Query active call state for a group
  socket.on('call:get_active', ({ groupId }, callback) => {
    const summary = getActiveCallSummary(groupId);
    if (typeof callback === 'function') callback(summary);
  });

  // 1. Initiate Call
  socket.on('call:initiate', async ({ groupId, callType = 'video' }, callback) => {
    try {
      const user = socket.user;
      if (!user) {
        if (typeof callback === 'function') return callback({ success: false, error: 'Unauthenticated socket.' });
        return;
      }

      // Verify caller is an authorized member of this group
      const membership = await groupRepository.findMember(groupId, user.id);
      if (!membership) {
        console.warn(`[Call:initiate] Unauthorized attempt: User ${user.id} is not a member of group ${groupId}`);
        if (typeof callback === 'function') return callback({ success: false, error: 'Unauthorized: You are not a member of this group.' });
        return;
      }

      const group = await groupRepository.findById(groupId);
      if (!group) {
        if (typeof callback === 'function') return callback({ success: false, error: 'Group does not exist.' });
        return;
      }

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
          groupName: group.name,
          callType,
          initiator: user,
          startedAt: new Date().toISOString(),
          participants: new Map(), // socketId -> { user, isMuted, isCameraOff }
        };
        activeCalls.set(groupId, callState);
      } else {
        console.log(`[Call:initiate] Group ${groupId} already has active call ${callState.callId}. Joining existing.`);
      }

      // Add initiator as participant
      callState.participants.set(socket.id, {
        socketId: socket.id,
        user,
        isMuted: false,
        isCameraOff: false,
      });

      // Record in call_participants table
      try {
        const db = await getDatabase();
        const cpId = 'cp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        await db.run(
          `INSERT INTO call_participants (id, call_id, user_id, socket_id, joined_at, status)
           VALUES (?, ?, ?, ?, ?, 'joined')`,
          [cpId, callState.callId, user.id, socket.id, new Date().toISOString()]
        );
      } catch (cpErr) {
        console.warn('[Call:initiate] DB participant record note:', cpErr.message);
      }

      // Retrieve all authorized members of this group
      const groupMembers = await groupRepository.listMembers(groupId);
      const recipientMembers = groupMembers.filter((m) => m.id !== user.id);

      console.log(`[Call:initiate] Caller: ${user.name} (${user.id}) | Socket: ${socket.id} | Group: ${groupId} ("${group.name}") | CallId: ${callState.callId}`);

      const incomingPayload = {
        groupId,
        groupName: group.name,
        callId: callState.callId,
        callType: callState.callType,
        initiator: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        },
      };

      // Route incoming-call event ONLY to authorized group members
      socket.to(`group_${groupId}`).emit('call:incoming', incomingPayload);
      for (const member of recipientMembers) {
        io.to(`user_${member.id}`).emit('call:incoming', incomingPayload);
      }

      // Broadcast active call banner state to entire group room
      broadcastActiveCallState(io, groupId);

      if (typeof callback === 'function') {
        callback({ success: true, callId: callState.callId });
      }
    } catch (err) {
      console.error('[Call:initiate] Error:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // 2. Join Call (Late Joiner or Ringing Answer)
  socket.on('call:join', async ({ groupId, isMuted = false, isCameraOff = false }, callback) => {
    try {
      const user = socket.user;
      if (!user) {
        if (typeof callback === 'function') return callback({ success: false, error: 'Unauthenticated socket.' });
        return;
      }

      // Verify caller is an authorized member
      const membership = await groupRepository.findMember(groupId, user.id);
      if (!membership) {
        console.warn(`[Call:join] Unauthorized join attempt: User ${user.id} is not a member of group ${groupId}`);
        if (typeof callback === 'function') return callback({ success: false, error: 'Unauthorized: You are not a member of this group.' });
        return;
      }

      let callState = activeCalls.get(groupId);

      if (!callState) {
        // Create if joining directly
        const callId = 'cal_' + Date.now();
        await callRepository.create({
          id: callId,
          groupId,
          initiatedBy: user.id,
          callType: 'video',
        });
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

      // Update call status to 'active' once multiple participants join
      try {
        await callRepository.updateStatus(callState.callId, 'active');
      } catch (dbErr) {
        console.warn('[Call:join] DB status update warning:', dbErr.message);
      }

      // Remove any older stale sockets for the SAME user (e.g. from page refresh or network change)
      for (const [sId, p] of callState.participants.entries()) {
        if (sId !== socket.id && p.user && p.user.id === user.id) {
          console.log(`[Call:join] Pruning older session socket ${sId} for user ${user.name}`);
          callState.participants.delete(sId);
          socket.to(`group_${groupId}`).emit('call:peer-left', {
            socketId: sId,
            userId: user.id,
          });
        }
      }

      // Add participant to call state
      callState.participants.set(socket.id, {
        socketId: socket.id,
        user,
        isMuted,
        isCameraOff,
      });

      // Record in call_participants table
      try {
        const db = await getDatabase();
        const cpId = 'cp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        await db.run(
          `INSERT INTO call_participants (id, call_id, user_id, socket_id, joined_at, status)
           VALUES (?, ?, ?, ?, ?, 'joined')`,
          [cpId, callState.callId, user.id, socket.id, new Date().toISOString()]
        );
      } catch (cpErr) {
        console.warn('[Call:join] DB participant record note:', cpErr.message);
      }

      console.log(`[Call:join] User ${user.name} (${socket.id}) joined call ${callState.callId} in group ${groupId}. Total participants: ${callState.participants.size}`);

      // Notify others in call
      socket.to(`group_${groupId}`).emit('call:peer-joined', {
        socketId: socket.id,
        user,
        isMuted,
        isCameraOff,
      });

      // Broadcast active call banner update to all group members
      broadcastActiveCallState(io, groupId);

      // Return current participants to caller (only connected remote peers, never self)
      const existingParticipants = [];
      for (const [sId, p] of callState.participants.entries()) {
        if (sId !== socket.id && p.user && p.user.id !== user.id) {
          const remoteSocket = io.sockets.sockets.get(sId);
          if (remoteSocket && remoteSocket.connected) {
            existingParticipants.push(p);
          } else {
            // Stale or disconnected socket: prune
            callState.participants.delete(sId);
          }
        }
      }

      if (typeof callback === 'function') {
        callback({
          success: true,
          callId: callState.callId,
          callType: callState.callType,
          participants: existingParticipants,
        });
      }
    } catch (err) {
      console.error('[Call:join] Error:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
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

  // 6. Media State Toggle (Mute mic, camera, or screen share)
  socket.on('call:toggle-media', ({ groupId, isMuted, isCameraOff, isScreenSharing }) => {
    const callState = activeCalls.get(groupId);
    if (callState && callState.participants.has(socket.id)) {
      const p = callState.participants.get(socket.id);
      if (typeof isMuted === 'boolean') p.isMuted = isMuted;
      if (typeof isCameraOff === 'boolean') p.isCameraOff = isCameraOff;
      if (typeof isScreenSharing === 'boolean') p.isScreenSharing = isScreenSharing;
      socket.to(`group_${groupId}`).emit('call:peer-media-toggled', {
        socketId: socket.id,
        isMuted: p.isMuted,
        isCameraOff: p.isCameraOff,
        isScreenSharing: p.isScreenSharing,
      });
      broadcastActiveCallState(io, groupId);
    }
  });

  // 7. Decline Call
  socket.on('call:decline', ({ groupId, callId }) => {
    const user = socket.user;
    console.log(`[Call:decline] User ${user?.name} (${user?.id}) declined call ${callId} in group ${groupId}`);
    socket.to(`group_${groupId}`).emit('call:declined', {
      groupId,
      callId,
      userId: user?.id,
      userName: user?.name,
    });
  });

  // 8. Leave Call
  socket.on('call:leave', async ({ groupId }) => {
    handleCallLeave(io, socket, groupId);
  });
}

async function handleCallLeave(io, socket, groupId) {
  const callState = activeCalls.get(groupId);
  if (!callState) return;

  if (callState.participants.has(socket.id)) {
    callState.participants.delete(socket.id);

    // Update DB call_participants status
    try {
      const db = await getDatabase();
      const userId = socket.user ? socket.user.id : null;
      if (userId) {
        await db.run(
          `UPDATE call_participants SET status = 'left', left_at = ? WHERE call_id = ? AND user_id = ? AND status = 'joined'`,
          [new Date().toISOString(), callState.callId, userId]
        );
      }
    } catch (cpErr) {
      console.warn('[Call:leave] DB update note:', cpErr.message);
    }

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

    // Broadcast updated active call state (or active: false)
    broadcastActiveCallState(io, groupId);
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
  handleCallLeave,
  getActiveCallSummary,
  broadcastActiveCallState,
  activeCalls,
};
