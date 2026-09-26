const { v4: uuidv4 } = require('uuid');
const messageRepository = require('../db/repositories/messageRepository');
const reactionRepository = require('../db/repositories/reactionRepository');
const groupRepository = require('../db/repositories/groupRepository');

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

      // Broadcast to group room
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

  async toggleReaction(req, res) {
    try {
      const { groupId, messageId } = req.params;
      const { emoji } = req.body;
      const userId = req.user.id;

      if (!emoji || typeof emoji !== 'string' || !emoji.trim()) {
        return res.status(400).json({ error: 'Emoji is required.' });
      }

      const message = await messageRepository.findById(messageId);
      if (!message || message.group_id !== groupId) {
        return res.status(404).json({ error: 'Message not found in this group.' });
      }

      const result = await reactionRepository.toggleReaction({
        messageId,
        userId,
        emoji: emoji.trim(),
      });

      const reactionMap = await reactionRepository.getReactionsForMessages([messageId]);
      const updatedReactions = reactionMap[messageId] || [];

      // Broadcast realtime reaction event
      const io = req.app.get('io');
      if (io) {
        io.to(`group_${groupId}`).emit('chat:reaction', {
          messageId,
          groupId,
          emoji: emoji.trim(),
          action: result.action,
          userId,
          userName: req.user.name,
          reactions: updatedReactions,
        });
      }

      return res.json({
        success: true,
        action: result.action,
        emoji: emoji.trim(),
        reactions: updatedReactions,
      });
    } catch (err) {
      console.error('Toggle reaction error:', err);
      return res.status(500).json({ error: 'Failed to toggle reaction.' });
    }
  }

  async forwardMessage(req, res) {
    try {
      const { groupId, messageId } = req.params;
      const { destinationGroupId } = req.body;
      const userId = req.user.id;

      if (!destinationGroupId) {
        return res.status(400).json({ error: 'Destination group ID is required.' });
      }

      // Verify user is an active member of destination group
      const destMembership = await groupRepository.findMember(destinationGroupId, userId);
      if (!destMembership) {
        return res.status(403).json({ error: 'You are not a member of the destination group.' });
      }

      // Verify source message exists in source group
      const originalMessage = await messageRepository.findById(messageId);
      if (!originalMessage || originalMessage.group_id !== groupId) {
        return res.status(404).json({ error: 'Source message not found.' });
      }

      const forwardedMessage = await messageRepository.forwardMessage({
        destinationGroupId,
        forwardedBy: userId,
        originalMessage,
      });

      // Broadcast to destination group room
      const io = req.app.get('io');
      if (io) {
        io.to(`group_${destinationGroupId}`).emit('chat:message', forwardedMessage);
        io.to(`group_${groupId}`).emit('chat:message_forwarded', {
          originalMessageId: messageId,
          forwardedMessageId: forwardedMessage.id,
          sourceGroupId: groupId,
          destinationGroupId,
        });
      }

      return res.status(201).json({ message: forwardedMessage });
    } catch (err) {
      console.error('Forward message error:', err);
      return res.status(500).json({ error: 'Failed to forward message.' });
    }
  }

  async deleteMessage(req, res) {
    try {
      const { groupId, messageId } = req.params;
      const userId = req.user.id;

      const message = await messageRepository.findById(messageId);
      if (!message || message.group_id !== groupId) {
        return res.status(404).json({ error: 'Message not found.' });
      }

      // Only sender or group admin/owner can delete
      const isAdminOrOwner = req.membership && (req.membership.role === 'owner' || req.membership.role === 'admin');
      if (message.sender_id !== userId && !isAdminOrOwner) {
        return res.status(403).json({ error: 'You are not authorized to delete this message.' });
      }

      await messageRepository.deleteMessage(messageId);

      const io = req.app.get('io');
      if (io) {
        io.to(`group_${groupId}`).emit('chat:message_deleted', {
          messageId,
          groupId,
        });
      }

      return res.json({ message: 'Message deleted successfully.', messageId });
    } catch (err) {
      console.error('Delete message error:', err);
      return res.status(500).json({ error: 'Failed to delete message.' });
    }
  }
}

module.exports = new MessageController();
