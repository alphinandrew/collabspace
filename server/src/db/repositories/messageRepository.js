const { getDatabase } = require('../database');

class MessageRepository {
  async create({ id, groupId, senderId, content, messageType = 'text', fileId = null }) {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO messages (id, group_id, sender_id, content, message_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, groupId, senderId, content, messageType, now, now]
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
    return await db.get(sql, [id]);
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

    return await db.all(sql, params);
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
