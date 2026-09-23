const jwt = require('jsonwebtoken');
const config = require('../config');
const userRepository = require('../db/repositories/userRepository');

async function requireAuth(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query && req.query.token) {
      // Support for authenticated media streams (e.g. file preview in <iframe> or <img>)
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }

    const decoded = jwt.verify(token, config.authSecret);
    const user = await userRepository.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User session invalid or user no longer exists.' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      status: user.status,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
}

module.exports = {
  requireAuth,
};
