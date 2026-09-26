const { getDatabase } = require('../database');
const { v4: uuidv4 } = require('uuid');

class ReactionRepository {
  async toggleReaction({ messageId, userId, emoji }) {
    const db = await getDatabase();
    
    // Check if user already has any reaction on this message
    const existing = await db.get(
      `SELECT * FROM message_reactions WHERE message_id = ? AND user_id = ?`,
      [messageId, userId]
    );

    if (existing) {
      if (existing.emoji === emoji) {
        // Same emoji -> toggle off (remove)
        await db.run(
          `DELETE FROM message_reactions WHERE id = ?`,
          [existing.id]
        );
        return { action: 'removed', id: existing.id, messageId, userId, emoji };
      } else {
        // Different emoji -> update existing reaction to the new emoji
        const now = new Date().toISOString();
        await db.run(
          `UPDATE message_reactions SET emoji = ?, created_at = ? WHERE id = ?`,
          [emoji, now, existing.id]
        );
        return { action: 'updated', id: existing.id, messageId, userId, emoji, previousEmoji: existing.emoji };
      }
    } else {
      const id = 'rxn_' + uuidv4().replace(/-/g, '').slice(0, 16);
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO message_reactions (id, message_id, user_id, emoji, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, messageId, userId, emoji, now]
      );
      return { action: 'added', id, messageId, userId, emoji };
    }
  }

  async getReactionsForMessages(messageIds) {
    if (!messageIds || messageIds.length === 0) return {};
    const db = await getDatabase();

    const placeholders = messageIds.map(() => '?').join(',');
    const sql = `
      SELECT r.id, r.message_id, r.user_id, r.emoji, r.created_at, u.name as user_name
      FROM message_reactions r
      INNER JOIN users u ON r.user_id = u.id
      WHERE r.message_id IN (${placeholders})
      ORDER BY r.created_at ASC
    `;
    const rows = await db.all(sql, messageIds);

    // Group by message_id -> emoji -> count & users
    const map = {};
    for (const msgId of messageIds) {
      map[msgId] = [];
    }

    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.message_id]) grouped[row.message_id] = {};
      if (!grouped[row.message_id][row.emoji]) {
        grouped[row.message_id][row.emoji] = {
          emoji: row.emoji,
          count: 0,
          userIds: [],
          users: [],
        };
      }
      grouped[row.message_id][row.emoji].count += 1;
      grouped[row.message_id][row.emoji].userIds.push(row.user_id);
      grouped[row.message_id][row.emoji].users.push({ id: row.user_id, name: row.user_name });
    }

    for (const msgId of Object.keys(grouped)) {
      map[msgId] = Object.values(grouped[msgId]);
    }

    return map;
  }
}

module.exports = new ReactionRepository();
