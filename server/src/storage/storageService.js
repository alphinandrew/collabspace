const config = require('../config');
const localStorageDriver = require('./localStorage');

class StorageService {
  constructor() {
    this.driver = localStorageDriver;
    // When S3 is configured, this.driver = s3StorageDriver can be assigned cleanly
  }

  async saveFile(tempFilePath, storageKey) {
    return this.driver.saveFile(tempFilePath, storageKey);
  }

  async saveBuffer(buffer, storageKey) {
    return this.driver.saveBuffer(buffer, storageKey);
  }

  getReadStream(storageKey) {
    return this.driver.getReadStream(storageKey);
  }

  async getBuffer(storageKey) {
    return this.driver.getBuffer(storageKey);
  }

  async deleteFile(storageKey) {
    return this.driver.deleteFile(storageKey);
  }

  fileExists(storageKey) {
    return this.driver.fileExists(storageKey);
  }
}

module.exports = new StorageService();
