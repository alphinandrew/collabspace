const { getDatabase } = require('../db/database');

class SearchController {
  async searchGroup(req, res) {
    try {
      const { groupId } = req.params;
      const { q } = req.query;

      if (!q || !q.trim()) {
        return res.json({ messages: [], files: [], members: [] });
      }

      const query = q.trim();
      const wildcard = `%${query}%`;
      const db = await getDatabase();

      // 1. Search messages
      const messagesSql = `
        SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
        FROM messages m
        INNER JOIN users u ON m.sender_id = u.id
        WHERE m.group_id = ? AND m.content LIKE ?
        ORDER BY m.created_at DESC LIMIT 20
      `;
      const messages = db.all(messagesSql, [groupId, wildcard]);

      // 2. Search files
      const filesSql = `
        SELECT f.*, u.name as uploader_name
        FROM files f
        INNER JOIN users u ON f.uploader_id = u.id
        WHERE f.group_id = ? AND (f.filename LIKE ? OR u.name LIKE ?)
        ORDER BY f.created_at DESC LIMIT 20
      `;
      const files = db.all(filesSql, [groupId, wildcard, wildcard]);

      // 3. Search members
      const membersSql = `
        SELECT gm.role, gm.joined_at, u.id, u.name, u.email, u.avatar, u.status
        FROM group_members gm
        INNER JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = ? AND (u.name LIKE ? OR u.email LIKE ?)
        LIMIT 20
      `;
      const members = db.all(membersSql, [groupId, wildcard, wildcard]);

      return res.json({
        query,
        messages,
        files,
        members,
      });
    } catch (err) {
      console.error('Group search error:', err);
      return res.status(500).json({ error: 'Failed to execute search.' });
    }
  }

  async searchGlobal(req, res) {
    try {
      const { q } = req.query;
      const userId = req.user.id;

      if (!q || !q.trim()) {
        return res.json({ messages: [], files: [], groups: [] });
      }

      const query = q.trim();
      const wildcard = `%${query}%`;
      const db = await getDatabase();

      // Search across all groups current user belongs to
      const messagesSql = `
        SELECT m.*, u.name as sender_name, u.avatar as sender_avatar, g.name as group_name
        FROM messages m
        INNER JOIN users u ON m.sender_id = u.id
        INNER JOIN groups g ON m.group_id = g.id
        INNER JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = ? AND m.content LIKE ?
        ORDER BY m.created_at DESC LIMIT 25
      `;
      const messages = db.all(messagesSql, [userId, wildcard]);

      const filesSql = `
        SELECT f.*, u.name as uploader_name, g.name as group_name
        FROM files f
        INNER JOIN users u ON f.uploader_id = u.id
        INNER JOIN groups g ON f.group_id = g.id
        INNER JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = ? AND (f.filename LIKE ? OR u.name LIKE ?)
        ORDER BY f.created_at DESC LIMIT 25
      `;
      const files = db.all(filesSql, [userId, wildcard, wildcard]);

      const groupsSql = `
        SELECT g.*
        FROM groups g
        INNER JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = ? AND (g.name LIKE ? OR g.description LIKE ? OR g.join_code LIKE ?)
        LIMIT 10
      `;
      const groups = db.all(groupsSql, [userId, wildcard, wildcard, wildcard]);

      return res.json({
        query,
        messages,
        files,
        groups,
      });
    } catch (err) {
      console.error('Global search error:', err);
      return res.status(500).json({ error: 'Failed to execute global search.' });
    }
  }
}

module.exports = new SearchController();
