const { v4: uuidv4 } = require('uuid');
const messageRepository = require('../db/repositories/messageRepository');

class MessageController {
  async getMessages(req, res) {
    try {
      const { groupId } = req.params;
      const limit = parseInt(req.query.limit || '50', 10);
      const before = req.query.before || null;

      const messages = await messageRepository.listGroupMessages(groupId, {
        limit: Math.min(limit, 100),
        before,
      });

      return res.json({ messages });
    } catch (err) {
      console.error('Get messages error:', err);
      return res.status(500).json({ error: 'Failed to retrieve messages.' });
    }
  }

  async sendMessage(req, res) {
    try {
      const { groupId } = req.params;
      const { content, messageType = 'text', fileId = null } = req.body;
      const senderId = req.user.id;

      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Message content cannot be empty.' });
      }

      const messageId = 'msg_' + uuidv4().replace(/-/g, '').slice(0, 16);

      const message = await messageRepository.create({
        id: messageId,
        groupId,
        senderId,
        content: content.trim(),
        messageType,
        fileId,
      });

      // If socket.io is accessible from app instance, broadcast to group room
      const io = req.app.get('io');
      if (io) {
        io.to(`group_${groupId}`).emit('chat:message', message);
      }

      return res.status(201).json({ message });
    } catch (err) {
      console.error('Send message error:', err);
      return res.status(500).json({ error: 'Failed to send message.' });
    }
  }
}

module.exports = new MessageController();
