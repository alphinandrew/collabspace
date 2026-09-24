const { getDatabase } = require('../database');

class InvitationRepository {
  async create({ id, groupId, token, createdBy, maxUses = 0, expiresAt = null }) {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO invitations (id, group_id, token, created_by, max_uses, uses_count, expires_at, is_revoked, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?)`,
      [id, groupId, token, createdBy, maxUses, expiresAt, now]
    );
    return await this.findById(id);
  }

  async findById(id) {
    const db = await getDatabase();
    return await db.get(`SELECT * FROM invitations WHERE id = ?`, [id]);
  }

  async findByToken(token) {
    const db = await getDatabase();
    return await db.get(`SELECT * FROM invitations WHERE token = ?`, [token]);
  }

  async findActiveByGroup(groupId) {
    const db = await getDatabase();
    const now = new Date().toISOString();
    return await db.get(
      `SELECT * FROM invitations 
       WHERE group_id = ? AND is_revoked = 0 AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY created_at DESC LIMIT 1`,
      [groupId, now]
    );
  }

  async incrementUsage(id) {
    const db = await getDatabase();
    await db.run(`UPDATE invitations SET uses_count = uses_count + 1 WHERE id = ?`, [id]);
    return await this.findById(id);
  }

  async revoke(id) {
    const db = await getDatabase();
    await db.run(`UPDATE invitations SET is_revoked = 1 WHERE id = ?`, [id]);
    return await this.findById(id);
  }
}

module.exports = new InvitationRepository();
