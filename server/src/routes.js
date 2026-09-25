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
router.get('/config/webrtc', (req, res) => {
  const iceServers = [];

  // 1. Custom TURN server if configured in environment
  if (config.webrtc.turnUrl) {
    const customTurn = { urls: config.webrtc.turnUrl };
    if (config.webrtc.turnUsername) customTurn.username = config.webrtc.turnUsername;
    if (config.webrtc.turnCredential) customTurn.credential = config.webrtc.turnCredential;
    iceServers.push(customTurn);
  }

  // 2. High-availability Google & Metered STUN servers
  iceServers.push(
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
      ],
    },
    {
      urls: 'stun:stun.relay.metered.ca:80',
    }
  );

  // 3. Fallback TURN relay servers (OpenRelay / Metered free relay for NAT & firewall traversal)
  // Ensures calls succeed across mobile hotspot (Realme/CGNAT), cellular data, VPNs, and strict firewalls
  iceServers.push(
    {
      urls: 'turn:standard.relay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:standard.relay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:standard.relay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    }
  );

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
router.get('/groups/:groupId/invitation', requireAuth, requireGroupMember, groupController.getInvitation);
router.get('/groups/:groupId/members', requireAuth, requireGroupMember, groupController.listMembers);
router.put('/groups/:groupId/members/:userId/role', requireAuth, requireGroupAdmin, groupController.updateMemberRole);
router.delete('/groups/:groupId/members/:userId', requireAuth, requireGroupAdmin, groupController.removeMember);

// Chat Messages Routes
router.get('/groups/:groupId/messages', requireAuth, requireGroupMember, messageController.getMessages);
router.post('/groups/:groupId/messages', requireAuth, requireGroupMember, messageController.sendMessage);

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
