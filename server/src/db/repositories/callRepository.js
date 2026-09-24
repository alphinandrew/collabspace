const { getDatabase } = require('../database');

class CallRepository {
  async create({ id, groupId, initiatedBy, callType = 'video' }) {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO calls (id, group_id, initiated_by, call_type, status, started_at)
       VALUES (?, ?, ?, ?, 'ringing', ?)`,
      [id, groupId, initiatedBy, callType, now]
    );
    return await this.findById(id);
  }

  async findById(id) {
    const db = await getDatabase();
    const sql = `
      SELECT c.*, u.name as initiator_name, u.avatar as initiator_avatar
      FROM calls c
      INNER JOIN users u ON c.initiated_by = u.id
      WHERE c.id = ?
    `;
    return await db.get(sql, [id]);
  }

  async findActiveCall(groupId) {
    const db = await getDatabase();
    const sql = `
      SELECT c.*, u.name as initiator_name, u.avatar as initiator_avatar
      FROM calls c
      INNER JOIN users u ON c.initiated_by = u.id
      WHERE c.group_id = ? AND c.status IN ('ringing', 'active')
      ORDER BY c.started_at DESC LIMIT 1
    `;
    return await db.get(sql, [groupId]);
  }

  async updateStatus(id, status, endedAt = null) {
    const db = await getDatabase();
    if (endedAt) {
      await db.run(`UPDATE calls SET status = ?, ended_at = ? WHERE id = ?`, [status, endedAt, id]);
    } else {
      await db.run(`UPDATE calls SET status = ? WHERE id = ?`, [status, id]);
    }
    return await this.findById(id);
  }

  async listGroupCalls(groupId, limit = 20) {
    const db = await getDatabase();
    const sql = `
      SELECT c.*, u.name as initiator_name, u.avatar as initiator_avatar
      FROM calls c
      INNER JOIN users u ON c.initiated_by = u.id
      WHERE c.group_id = ?
      ORDER BY c.started_at DESC LIMIT ?
    `;
    return await db.all(sql, [groupId, limit]);
  }
}

module.exports = new CallRepository();
