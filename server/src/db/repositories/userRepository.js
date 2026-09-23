const { getDatabase } = require('../database');

class UserRepository {
  async create({ id, name, email, avatar, passwordHash, status = 'online' }) {
    const db = await getDatabase();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO users (id, name, email, avatar, password_hash, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, email, avatar || null, passwordHash, status, now, now]
    );
    return this.findById(id);
  }

  async findById(id) {
    const db = await getDatabase();
    const user = db.get(`SELECT id, name, email, avatar, status, created_at, updated_at FROM users WHERE id = ?`, [id]);
    return user || null;
  }

  async findByEmail(email) {
    const db = await getDatabase();
    const user = db.get(`SELECT * FROM users WHERE email = ?`, [email.toLowerCase().trim()]);
    return user || null;
  }

  async updateStatus(id, status) {
    const db = await getDatabase();
    const now = new Date().toISOString();
    db.run(`UPDATE users SET status = ?, updated_at = ? WHERE id = ?`, [status, now, id]);
    return this.findById(id);
  }

  async updateProfile(id, { name, avatar, status }) {
    const db = await getDatabase();
    const now = new Date().toISOString();
    db.run(
      `UPDATE users SET name = COALESCE(?, name), avatar = COALESCE(?, avatar), status = COALESCE(?, status), updated_at = ? WHERE id = ?`,
      [name, avatar, status, now, id]
    );
    return this.findById(id);
  }
}

module.exports = new UserRepository();
