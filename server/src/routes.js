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
router.get('/config/webrtc', (req, res) => {
  const iceServers = [
    { urls: config.webrtc.stunUrl }
  ];

  if (config.webrtc.turnUrl) {
    const turnServer = { urls: config.webrtc.turnUrl };
    if (config.webrtc.turnUsername) turnServer.username = config.webrtc.turnUsername;
    if (config.webrtc.turnCredential) turnServer.credential = config.webrtc.turnCredential;
    iceServers.push(turnServer);
  }

  res.json({ iceServers });
});

// Authentication Routes
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
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
