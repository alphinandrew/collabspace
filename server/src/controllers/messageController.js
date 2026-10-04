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
        senderName: req.user.name,
        senderAvatar: req.user.avatar,
      });

      // Broadcast to group room immediately
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

      const { getDatabase } = require('../db/database');
      const db = await getDatabase();

      // Parallelize message existence/group check with existing reaction check (1 network roundtrip instead of 3 sequential)
      const [msgCheck, existingReaction] = await Promise.all([
        db.get(`SELECT id FROM messages WHERE id = ? AND group_id = ?`, [messageId, groupId]),
        db.get(`SELECT id, emoji FROM message_reactions WHERE message_id = ? AND user_id = ?`, [messageId, userId]),
      ]);

      if (!msgCheck) {
        return res.status(404).json({ error: 'Message not found in this group.' });
      }

      const trimmedEmoji = emoji.trim();
      let action = 'added';
      const now = new Date().toISOString();

      if (existingReaction) {
        if (existingReaction.emoji === trimmedEmoji) {
          action = 'removed';
          await db.run(`DELETE FROM message_reactions WHERE id = ?`, [existingReaction.id]);
        } else {
          action = 'updated';
          await db.run(
            `UPDATE message_reactions SET emoji = ?, created_at = ? WHERE id = ?`,
            [trimmedEmoji, now, existingReaction.id]
          );
        }
      } else {
        const rxnId = 'rxn_' + uuidv4().replace(/-/g, '').slice(0, 16);
        await db.run(
          `INSERT INTO message_reactions (id, message_id, user_id, emoji, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [rxnId, messageId, userId, trimmedEmoji, now]
        );
      }

      // Fetch the updated reactions for this message
      const reactionMap = await reactionRepository.getReactionsForMessages([messageId]);
      const updatedReactions = reactionMap[messageId] || [];

      // Broadcast realtime reaction event immediately
      const io = req.app.get('io');
      if (io) {
        io.to(`group_${groupId}`).emit('chat:reaction', {
          messageId,
          groupId,
          emoji: trimmedEmoji,
          action,
          userId,
          userName: req.user.name,
          reactions: updatedReactions,
        });
      }

      return res.json({
        success: true,
        action,
        emoji: trimmedEmoji,
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
