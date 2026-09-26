const { getDatabase } = require('../database');
const reactionRepository = require('./reactionRepository');
const { v4: uuidv4 } = require('uuid');

class MessageRepository {
  async create({
    id,
    groupId,
    senderId,
    content,
    messageType = 'text',
    fileId = null,
    forwardedFromMessageId = null,
    forwardedFromGroupId = null,
    forwardedFromSenderName = null,
  }) {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO messages (
        id, group_id, sender_id, content, message_type,
        forwarded_from_message_id, forwarded_from_group_id, forwarded_from_sender_name,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        groupId,
        senderId,
        content,
        messageType,
        forwardedFromMessageId,
        forwardedFromGroupId,
        forwardedFromSenderName,
        now,
        now,
      ]
    );

    if (fileId) {
      const attachmentId = 'att_' + id + '_' + fileId;
      await db.run(
        `INSERT INTO attachments (id, message_id, file_id) VALUES (?, ?, ?)`,
        [attachmentId, id, fileId]
      );
    }

    return await this.findById(id);
  }

  async findById(id) {
    const db = await getDatabase();
    const sql = `
      SELECT m.*, u.name as sender_name, u.avatar as sender_avatar,
             f.id as file_id, f.filename, f.mime_type, f.size as file_size, f.storage_key
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      LEFT JOIN attachments a ON m.id = a.message_id
      LEFT JOIN files f ON a.file_id = f.id
      WHERE m.id = ?
    `;
    const message = await db.get(sql, [id]);
    if (!message) return null;

    const reactionMap = await reactionRepository.getReactionsForMessages([id]);
    message.reactions = reactionMap[id] || [];
    return message;
  }

  async listGroupMessages(groupId, { limit = 100, before = null } = {}) {
    const db = await getDatabase();
    let sql = `
      SELECT m.*, u.name as sender_name, u.avatar as sender_avatar,
             f.id as file_id, f.filename, f.mime_type, f.size as file_size, f.storage_key
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      LEFT JOIN attachments a ON m.id = a.message_id
      LEFT JOIN files f ON a.file_id = f.id
      WHERE m.group_id = ?
    `;
    const params = [groupId];

    if (before) {
      sql += ` AND m.created_at < ?`;
      params.push(before);
    }

    sql += ` ORDER BY m.created_at ASC LIMIT ?`;
    params.push(limit);

    const rows = await db.all(sql, params);
    if (!rows || rows.length === 0) return [];

    const messageIds = rows.map((r) => r.id);
    const reactionMap = await reactionRepository.getReactionsForMessages(messageIds);

    for (const row of rows) {
      row.reactions = reactionMap[row.id] || [];
    }

    return rows;
  }

  async forwardMessage({ destinationGroupId, forwardedBy, originalMessage }) {
    const db = await getDatabase();
    const newMsgId = 'msg_' + uuidv4().replace(/-/g, '').slice(0, 16);
    const forwardRecordId = 'fwd_' + uuidv4().replace(/-/g, '').slice(0, 16);
    const now = new Date().toISOString();

    // Create the message in the destination group
    await db.run(
      `INSERT INTO messages (
        id, group_id, sender_id, content, message_type,
        forwarded_from_message_id, forwarded_from_group_id, forwarded_from_sender_name,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newMsgId,
        destinationGroupId,
        forwardedBy,
        originalMessage.content,
        originalMessage.message_type || 'text',
        originalMessage.id,
        originalMessage.group_id,
        originalMessage.sender_name,
        now,
        now,
      ]
    );

    // If source message had an attachment, safely attach it to the new forwarded message
    if (originalMessage.file_id) {
      const attachmentId = 'att_' + newMsgId + '_' + originalMessage.file_id;
      await db.run(
        `INSERT INTO attachments (id, message_id, file_id) VALUES (?, ?, ?)`,
        [attachmentId, newMsgId, originalMessage.file_id]
      );
    }

    // Record in forwarded_messages relationship table
    await db.run(
      `INSERT INTO forwarded_messages (
        id, original_message_id, forwarded_message_id, source_group_id,
        destination_group_id, forwarded_by, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        forwardRecordId,
        originalMessage.id,
        newMsgId,
        originalMessage.group_id,
        destinationGroupId,
        forwardedBy,
        now,
      ]
    );

    return await this.findById(newMsgId);
  }

  async deleteMessage(id) {
    const db = await getDatabase();
    await db.run(`DELETE FROM messages WHERE id = ?`, [id]);
    return true;
  }

  async searchMessages(groupId, query, limit = 30) {
    const db = await getDatabase();
    const wildcard = `%${query}%`;
    const sql = `
      SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      WHERE m.group_id = ? AND m.content LIKE ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `;
    return await db.all(sql, [groupId, wildcard, limit]);
  }
}

module.exports = new MessageRepository();
