const groupRepository = require('../db/repositories/groupRepository');

async function requireGroupMember(req, res, next) {
  try {
    const groupId = req.params.groupId || req.body.groupId || req.query.groupId;
    if (!groupId) {
      return res.status(400).json({ error: 'Group identifier is required.' });
    }

    const membership = await groupRepository.findMember(groupId, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    req.membership = membership;
    next();
  } catch (err) {
    console.error('Permission check error:', err);
    return res.status(500).json({ error: 'Failed to verify group membership permissions.' });
  }
}

async function requireGroupAdmin(req, res, next) {
  try {
    const groupId = req.params.groupId || req.body.groupId || req.query.groupId;
    if (!groupId) {
      return res.status(400).json({ error: 'Group identifier is required.' });
    }

    const membership = await groupRepository.findMember(groupId, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }

    req.membership = membership;
    next();
  } catch (err) {
    console.error('Admin permission check error:', err);
    return res.status(500).json({ error: 'Failed to verify administrator privileges.' });
  }
}

async function requireGroupOwner(req, res, next) {
  try {
    const groupId = req.params.groupId || req.body.groupId || req.query.groupId;
    if (!groupId) {
      return res.status(400).json({ error: 'Group identifier is required.' });
    }

    const group = await groupRepository.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    if (group.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Only the group owner can perform this action.' });
    }

    next();
  } catch (err) {
    console.error('Owner permission check error:', err);
    return res.status(500).json({ error: 'Failed to verify group ownership.' });
  }
}

module.exports = {
  requireGroupMember,
  requireGroupAdmin,
  requireGroupOwner,
};
