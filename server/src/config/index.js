const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  authSecret: process.env.AUTH_SECRET || 'collabspace_fallback_jwt_secret_min32chars_key!',
  tokenExpiry: process.env.TOKEN_EXPIRY || '7d',
  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    localDir: path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR || './storage/uploads'),
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
  },
  db: {
    driver: process.env.DATABASE_URL ? 'postgres' : (process.env.DB_DRIVER || 'sqlite'),
    url: process.env.DATABASE_URL || '',
    sqlitePath: path.resolve(process.cwd(), process.env.DB_SQLITE_PATH || './data/collabspace.db'),
  },
  webrtc: {
    stunUrl: process.env.STUN_SERVER_URL || 'stun:stun.l.google.com:19302',
    turnUrl: process.env.TURN_SERVER_URL || '',
    turnUsername: process.env.TURN_USERNAME || '',
    turnCredential: process.env.TURN_CREDENTIAL || '',
  }
};

module.exports = config;
