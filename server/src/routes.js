const express = require('express');
const router = express.Router();
const config = require('./config');

const authController = require('./controllers/authController');
const groupController = require('./controllers/groupController');
const messageController = require('./controllers/messageController');
const fileController = require('./controllers/fileController');
const callController = require('./controllers/callController');
const searchController = require('./controllers/searchController');

const { requireAuth } = require('./middleware/auth');
const { requireGroupMember, requireGroupAdmin } = require('./middleware/permissions');
const upload = require('./middleware/upload');

// Public WebRTC configuration endpoint
// Public WebRTC configuration endpoint
router.get('/config/webrtc', async (req, res) => {
  const iceServers = [];

  // 1. High-availability Google STUN servers (verified working)
  iceServers.push({
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun4.l.google.com:19302',
    ],
  });

  // 2. Custom TURN server if configured in environment (TURN_SERVER_URL / TURN_URL)
  if (config.webrtc.turnUrl) {
    const urls = config.webrtc.turnUrl.includes(',')
      ? config.webrtc.turnUrl.split(',').map((u) => u.trim())
      : config.webrtc.turnUrl;

    const customTurn = { urls };
    if (config.webrtc.turnUsername) customTurn.username = config.webrtc.turnUsername;
    if (config.webrtc.turnCredential) customTurn.credential = config.webrtc.turnCredential;
    iceServers.push(customTurn);
  }

  // 3. Optional dynamic Metered TURN credentials if METERED_API_KEY is configured
  if (process.env.METERED_API_KEY) {
    try {
      const meteredDomain = process.env.METERED_DOMAIN || 'collabspace';
      const response = await fetch(`https://${meteredDomain}.metered.ca/api/v1/turn/credentials?apiKey=${process.env.METERED_API_KEY}`);
      if (response.ok) {
        const meteredServers = await response.json();
        if (Array.isArray(meteredServers)) {
          iceServers.push(...meteredServers);
        }
      }
    } catch (err) {
      console.warn('[WebRTC] Failed to fetch dynamic Metered credentials:', err.message);
    }
  }

  res.json({ iceServers });
});

// Authentication Routes
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);
router.get('/auth/me', requireAuth, authController.me);
router.put('/auth/profile', requireAuth, authController.updateProfile);
router.post('/auth/logout', requireAuth, authController.logout);

// Groups Management Routes
router.get('/groups', requireAuth, groupController.getMyGroups);
router.post('/groups', requireAuth, groupController.createGroup);
router.post('/groups/join-code', requireAuth, groupController.joinByCode);
router.post('/groups/join-qr', requireAuth, groupController.joinByQr);

router.get('/groups/:groupId', requireAuth, requireGroupMember, groupController.getGroupDetails);
router.put('/groups/:groupId', requireAuth, requireGroupAdmin, groupController.updateGroup);
router.delete('/groups/:groupId', requireAuth, requireGroupAdmin, groupController.deleteGroup);
router.get('/groups/:groupId/invitation', requireAuth, requireGroupMember, groupController.getInvitation);
router.get('/groups/:groupId/members', requireAuth, requireGroupMember, groupController.listMembers);
router.put('/groups/:groupId/members/:userId/role', requireAuth, requireGroupAdmin, groupController.updateMemberRole);
router.delete('/groups/:groupId/members/:userId', requireAuth, requireGroupAdmin, groupController.removeMember);

// Chat Messages Routes
router.get('/groups/:groupId/messages', requireAuth, requireGroupMember, messageController.getMessages);
router.post('/groups/:groupId/messages', requireAuth, requireGroupMember, messageController.sendMessage);
router.post('/groups/:groupId/messages/:messageId/reactions', requireAuth, requireGroupMember, messageController.toggleReaction);
router.post('/groups/:groupId/messages/:messageId/forward', requireAuth, requireGroupMember, messageController.forwardMessage);
router.delete('/groups/:groupId/messages/:messageId', requireAuth, requireGroupMember, messageController.deleteMessage);

// File Upload & Library Routes
router.post('/groups/:groupId/files', requireAuth, requireGroupMember, upload.single('file'), fileController.uploadFile);
router.get('/groups/:groupId/files', requireAuth, requireGroupMember, fileController.getFiles);
router.get('/groups/:groupId/files/:fileId/download', requireAuth, requireGroupMember, fileController.downloadFile);
router.get('/groups/:groupId/files/:fileId/preview', requireAuth, requireGroupMember, fileController.previewFile);

// Call Lifecycle Routes
router.post('/groups/:groupId/calls', requireAuth, requireGroupMember, callController.initiateCall);
router.get('/groups/:groupId/calls/active', requireAuth, requireGroupMember, callController.getActiveCall);
router.post('/groups/:groupId/calls/:callId/end', requireAuth, requireGroupMember, callController.endCall);
router.get('/groups/:groupId/calls/history', requireAuth, requireGroupMember, callController.getCallHistory);

// Search Routes
router.get('/groups/:groupId/search', requireAuth, requireGroupMember, searchController.searchGroup);
router.get('/search', requireAuth, searchController.searchGlobal);

module.exports = router;
