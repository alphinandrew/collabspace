const { getDatabase } = require('../database');

class GroupRepository {
  async create({ id, name, description, avatar, ownerId, joinCode }) {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO groups (id, name, description, avatar, owner_id, join_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, description || '', avatar || null, ownerId, joinCode, now, now]
    );

    // Add owner as group_member with role 'owner'
    const memberId = 'gm_' + id + '_' + ownerId;
    await db.run(
      `INSERT INTO group_members (id, group_id, user_id, role, joined_at)
       VALUES (?, ?, ?, 'owner', ?)`,
      [memberId, id, ownerId, now]
    );

    return await this.findById(id);
  }

  async findById(id) {
    const db = await getDatabase();
    const group = await db.get(`SELECT * FROM groups WHERE id = ?`, [id]);
    if (!group) return null;
    const memberCountRow = await db.get(`SELECT COUNT(*) as count FROM group_members WHERE group_id = ?`, [id]);
    group.member_count = memberCountRow ? parseInt(memberCountRow.count, 10) : 0;
    return group;
  }

  async findByCode(joinCode) {
    const db = await getDatabase();
    const formatted = joinCode.toUpperCase().trim();
    const group = await db.get(`SELECT * FROM groups WHERE join_code = ?`, [formatted]);
    if (!group) return null;
    const memberCountRow = await db.get(`SELECT COUNT(*) as count FROM group_members WHERE group_id = ?`, [group.id]);
    group.member_count = memberCountRow ? parseInt(memberCountRow.count, 10) : 0;
    return group;
  }

  async listUserGroups(userId) {
    const db = await getDatabase();
    const sql = `
      SELECT g.*, gm.role as user_role, gm.joined_at as user_joined_at,
             (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
             (SELECT COUNT(*) FROM messages WHERE group_id = g.id) as message_count,
             (SELECT created_at FROM messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_activity
      FROM groups g
      INNER JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ?
      ORDER BY g.created_at DESC
    `;
    const rows = await db.all(sql, [userId]);
    return (rows || []).map((r) => ({
      ...r,
      member_count: parseInt(r.member_count || 0, 10),
      message_count: parseInt(r.message_count || 0, 10),
    }));
  }

  async addMember({ id, groupId, userId, role = 'member' }) {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO group_members (id, group_id, user_id, role, joined_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, groupId, userId, role, now]
    );
    return await this.findMember(groupId, userId);
  }

  async findMember(groupId, userId) {
    const db = await getDatabase();
    const sql = `
      SELECT gm.*, u.name, u.email, u.avatar, u.status
      FROM group_members gm
      INNER JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ? AND gm.user_id = ?
    `;
    return await db.get(sql, [groupId, userId]);
  }

  async listMembers(groupId) {
    const db = await getDatabase();
    const sql = `
      SELECT gm.id as membership_id, gm.role, gm.joined_at,
             u.id, u.name, u.email, u.avatar, u.status
      FROM group_members gm
      INNER JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
      ORDER BY 
        CASE gm.role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          ELSE 3
        END,
        u.name ASC
    `;
    return await db.all(sql, [groupId]);
  }

  async updateMemberRole(groupId, userId, role) {
    const db = await getDatabase();
    await db.run(
      `UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?`,
      [role, groupId, userId]
    );
    return await this.findMember(groupId, userId);
  }

  async removeMember(groupId, userId) {
    const db = await getDatabase();
    await db.run(
      `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`,
      [groupId, userId]
    );
    return true;
  }

  async updateGroup(groupId, { name, description, avatar }) {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.run(
      `UPDATE groups 
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           avatar = COALESCE(?, avatar),
           updated_at = ?
       WHERE id = ?`,
      [name, description, avatar, now, groupId]
    );
    return await this.findById(groupId);
  }
}

module.exports = new GroupRepository();
