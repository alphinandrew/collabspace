const fs = require('fs');
const config = require('../config');
const localStorageDriver = require('./localStorage');
const { getDatabase } = require('../db/database');

class StorageService {
  constructor() {
    this.driver = localStorageDriver;
  }

  async saveFile(tempFilePath, storageKey) {
    let buffer = null;
    try {
      buffer = await fs.promises.readFile(tempFilePath);
    } catch (e) {
      console.warn('Could not read temp file buffer for cloud backup:', e.message);
    }

    const result = await this.driver.saveFile(tempFilePath, storageKey);

    // If connected to cloud database (Supabase), back up file blob to DB
    if (buffer) {
      try {
        const db = await getDatabase();
        if (db.driver === 'postgres') {
          const now = new Date().toISOString();
          await db.run(
            `INSERT INTO file_blobs (storage_key, data, created_at)
             VALUES (?, ?, ?)
             ON CONFLICT (storage_key) DO UPDATE SET data = EXCLUDED.data`,
            [storageKey, buffer, now]
          );
        }
      } catch (err) {
        console.warn('Could not persist file blob to cloud database:', err.message);
      }
    }

    return result;
  }

  async saveBuffer(buffer, storageKey) {
    const result = await this.driver.saveBuffer(buffer, storageKey);

    try {
      const db = await getDatabase();
      if (db.driver === 'postgres') {
        const now = new Date().toISOString();
        await db.run(
          `INSERT INTO file_blobs (storage_key, data, created_at)
           VALUES (?, ?, ?)
           ON CONFLICT (storage_key) DO UPDATE SET data = EXCLUDED.data`,
          [storageKey, buffer, now]
        );
      }
    } catch (err) {
      console.warn('Could not persist buffer blob to cloud database:', err.message);
    }

    return result;
  }

  async getBuffer(storageKey) {
    // 1. Check local disk first
    if (this.driver.fileExists(storageKey)) {
      return this.driver.getBuffer(storageKey);
    }

    // 2. If wiped by container restart, restore from cloud DB (Supabase)
    try {
      const db = await getDatabase();
      if (db.driver === 'postgres') {
        const row = await db.get(`SELECT data FROM file_blobs WHERE storage_key = ?`, [storageKey]);
        if (row && row.data) {
          await this.driver.saveBuffer(row.data, storageKey);
          return row.data;
        }
      }
    } catch (err) {
      console.warn('Could not restore file from cloud database:', err.message);
    }

    throw new Error('File not found on storage disk');
  }

  async getReadStream(storageKey) {
    // If missing from local disk (after container restart), restore from Supabase
    if (!this.driver.fileExists(storageKey)) {
      await this.getBuffer(storageKey);
    }
    return this.driver.getReadStream(storageKey);
  }

  async deleteFile(storageKey) {
    await this.driver.deleteFile(storageKey);
    try {
      const db = await getDatabase();
      if (db.driver === 'postgres') {
        await db.run(`DELETE FROM file_blobs WHERE storage_key = ?`, [storageKey]);
      }
    } catch (e) {}
    return true;
  }

  fileExists(storageKey) {
    return this.driver.fileExists(storageKey);
  }
}

module.exports = new StorageService();
