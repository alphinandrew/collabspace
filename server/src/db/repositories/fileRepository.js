const { getDatabase } = require('../database');

class FileRepository {
  async create({ id, groupId, uploaderId, filename, storageKey, mimeType, size }) {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO files (id, group_id, uploader_id, filename, storage_key, mime_type, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, groupId, uploaderId, filename, storageKey, mimeType, size, now]
    );
    return await this.findById(id);
  }

  async findById(id) {
    const db = await getDatabase();
    const sql = `
      SELECT f.*, u.name as uploader_name, u.avatar as uploader_avatar
      FROM files f
      INNER JOIN users u ON f.uploader_id = u.id
      WHERE f.id = ?
    `;
    return await db.get(sql, [id]);
  }

  async listGroupFiles(groupId, { category = 'all', search = '', sort = 'newest', limit = 100, offset = 0 } = {}) {
    const db = await getDatabase();
    let sql = `
      SELECT f.*, u.name as uploader_name, u.avatar as uploader_avatar
      FROM files f
      INNER JOIN users u ON f.uploader_id = u.id
      WHERE f.group_id = ?
    `;
    const params = [groupId];

    // Filter by search query
    if (search && search.trim()) {
      sql += ` AND (f.filename LIKE ? OR u.name LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    // Filter by category
    const cat = category.toLowerCase();
    if (cat === 'pdfs') {
      sql += ` AND (f.mime_type LIKE '%pdf%' OR f.filename LIKE '%.pdf')`;
    } else if (cat === 'documents') {
      sql += ` AND (f.filename LIKE '%.doc' OR f.filename LIKE '%.docx' OR f.filename LIKE '%.odt' OR f.filename LIKE '%.rtf' OR f.filename LIKE '%.txt' OR f.filename LIKE '%.md')`;
    } else if (cat === 'spreadsheets') {
      sql += ` AND (f.filename LIKE '%.xls' OR f.filename LIKE '%.xlsx' OR f.filename LIKE '%.csv' OR f.mime_type LIKE '%sheet%' OR f.mime_type LIKE '%excel%')`;
    } else if (cat === 'presentations') {
      sql += ` AND (f.filename LIKE '%.ppt' OR f.filename LIKE '%.pptx' OR f.mime_type LIKE '%presentation%' OR f.mime_type LIKE '%powerpoint%')`;
    } else if (cat === 'images') {
      sql += ` AND (f.mime_type LIKE 'image/%' OR f.filename LIKE '%.png' OR f.filename LIKE '%.jpg' OR f.filename LIKE '%.jpeg' OR f.filename LIKE '%.webp' OR f.filename LIKE '%.gif')`;
    } else if (cat === 'videos') {
      sql += ` AND (f.mime_type LIKE 'video/%' OR f.filename LIKE '%.mp4' OR f.filename LIKE '%.webm' OR f.filename LIKE '%.mov')`;
    } else if (cat === 'other') {
      sql += ` AND NOT (
        f.mime_type LIKE '%pdf%' OR f.filename LIKE '%.pdf' OR
        f.mime_type LIKE 'image/%' OR f.filename LIKE '%.png' OR f.filename LIKE '%.jpg' OR
        f.mime_type LIKE 'video/%' OR
        f.filename LIKE '%.doc' OR f.filename LIKE '%.docx' OR f.filename LIKE '%.xls' OR f.filename LIKE '%.xlsx' OR f.filename LIKE '%.ppt' OR f.filename LIKE '%.pptx'
      )`;
    }

    // Sorting
    if (sort === 'oldest') {
      sql += ` ORDER BY f.created_at ASC`;
    } else if (sort === 'filename') {
      sql += ` ORDER BY LOWER(f.filename) ASC`;
    } else if (sort === 'size') {
      sql += ` ORDER BY f.size DESC`;
    } else {
      sql += ` ORDER BY f.created_at DESC`; // newest default
    }

    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return await db.all(sql, params);
  }

  async countGroupFiles(groupId) {
    const db = await getDatabase();
    const row = await db.get(`SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total_size FROM files WHERE group_id = ?`, [groupId]);
    return {
      count: row ? parseInt(row.count || 0, 10) : 0,
      totalSize: row ? parseInt(row.total_size || 0, 10) : 0,
    };
  }

  async delete(id) {
    const db = await getDatabase();
    await db.run(`DELETE FROM files WHERE id = ?`, [id]);
    return true;
  }
}

module.exports = new FileRepository();
