const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const userRepository = require('../db/repositories/userRepository');

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    config.authSecret,
    { expiresIn: config.tokenExpiry }
  );
}

class AuthController {
  async register(req, res) {
    try {
      const { name, email, password, avatar } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Full name is required.' });
      }
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email address is required.' });
      }
      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }

      const existing = await userRepository.findByEmail(email);
      if (existing) {
        return res.status(409).json({ error: 'An account with this email address already exists.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = 'usr_' + uuidv4().replace(/-/g, '').slice(0, 16);

      const user = await userRepository.create({
        id: userId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        avatar: avatar || null,
        passwordHash,
      });

      const token = generateToken(user);

      return res.status(201).json({
        message: 'Account registered successfully.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          status: user.status,
        },
        token,
      });
    } catch (err) {
      console.error('Registration error:', err);
      return res.status(500).json({ error: 'Failed to create account.' });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const user = await userRepository.findByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = generateToken(user);

      return res.status(200).json({
        message: 'Login successful.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          status: user.status,
        },
        token,
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Internal server error during login.' });
    }
  }

  async me(req, res) {
    try {
      const user = await userRepository.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
      return res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          status: user.status,
        },
      });
    } catch (err) {
      console.error('Get profile error:', err);
      return res.status(500).json({ error: 'Failed to retrieve user profile.' });
    }
  }

  async updateProfile(req, res) {
    try {
      const { name, avatar, status } = req.body;
      const updated = await userRepository.updateProfile(req.user.id, { name, avatar, status });
      return res.json({
        message: 'Profile updated successfully.',
        user: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          avatar: updated.avatar,
          status: updated.status,
        },
      });
    } catch (err) {
      console.error('Update profile error:', err);
      return res.status(500).json({ error: 'Failed to update profile.' });
    }
  }

  async logout(req, res) {
    // In JWT architecture, client drops token. Here we also update presence to offline
    try {
      await userRepository.updateStatus(req.user.id, 'offline');
      return res.json({ message: 'Logged out successfully.' });
    } catch (err) {
      return res.json({ message: 'Logged out.' });
    }
  }

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email address is required.' });
      }

      const user = await userRepository.findByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'No account found with this email address.' });
      }

      // Generate a 6-digit verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes
      const resetId = 'rst_' + uuidv4().replace(/-/g, '').slice(0, 16);

      await userRepository.createResetCode(resetId, email, code, expiresAt);

      console.log(`[PASSWORD_RESET] Code generated for ${email}: ${code}`);

      return res.status(200).json({
        message: 'Password reset verification code generated.',
        code, // Provided directly for immediate in-app recovery
        expiresInMinutes: 15,
        notice: 'Enter this 6-digit verification code to set your new password.'
      });
    } catch (err) {
      console.error('Forgot password error:', err);
      return res.status(500).json({ error: 'Failed to initiate password reset.' });
    }
  }

  async resetPassword(req, res) {
    try {
      const { email, code, newPassword } = req.body;

      if (!email || !code || !newPassword) {
        return res.status(400).json({ error: 'Email, verification code, and new password are required.' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
      }

      const user = await userRepository.findByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'No account found with this email address.' });
      }

      const resetRecord = await userRepository.findValidResetCode(email, code);
      if (!resetRecord) {
        return res.status(400).json({ error: 'Invalid or expired verification code. Please request a new code.' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await userRepository.updatePassword(user.id, passwordHash);
      await userRepository.markResetCodeUsed(resetRecord.id);

      return res.status(200).json({
        message: 'Password has been reset successfully. You can now sign in with your new password.',
      });
    } catch (err) {
      console.error('Reset password error:', err);
      return res.status(500).json({ error: 'Failed to reset password.' });
    }
  }
}

module.exports = new AuthController();
