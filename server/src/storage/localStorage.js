const fs = require('fs');
const path = require('path');
const config = require('../config');

class LocalStorageDriver {
  constructor() {
    this.uploadDir = config.storage.localDir;
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  getFilePath(storageKey) {
    // Sanitize storage key to avoid path traversal
    const safeKey = path.basename(storageKey);
    return path.join(this.uploadDir, safeKey);
  }

  async saveFile(tempFilePath, storageKey) {
    const targetPath = this.getFilePath(storageKey);
    await fs.promises.rename(tempFilePath, targetPath);
    return {
      storageKey,
      path: targetPath,
    };
  }

  async saveBuffer(buffer, storageKey) {
    const targetPath = this.getFilePath(storageKey);
    await fs.promises.writeFile(targetPath, buffer);
    return {
      storageKey,
      path: targetPath,
    };
  }

  getReadStream(storageKey) {
    const targetPath = this.getFilePath(storageKey);
    if (!fs.existsSync(targetPath)) {
      throw new Error('File not found on storage disk');
    }
    return fs.createReadStream(targetPath);
  }

  async getBuffer(storageKey) {
    const targetPath = this.getFilePath(storageKey);
    if (!fs.existsSync(targetPath)) {
      throw new Error('File not found on storage disk');
    }
    return fs.promises.readFile(targetPath);
  }

  async deleteFile(storageKey) {
    const targetPath = this.getFilePath(storageKey);
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
    return true;
  }

  fileExists(storageKey) {
    const targetPath = this.getFilePath(storageKey);
    return fs.existsSync(targetPath);
  }
}

module.exports = new LocalStorageDriver();
