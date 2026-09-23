const crypto = require('crypto');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const groupRepository = require('../db/repositories/groupRepository');
const invitationRepository = require('../db/repositories/invitationRepository');
const fileRepository = require('../db/repositories/fileRepository');

function generateGroupCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CLB-${suffix}`;
}

class GroupController {
  async createGroup(req, res) {
    try {
      const { name, description, avatar } = req.body;
      const ownerId = req.user.id;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Group name is required.' });
      }

      const groupId = 'grp_' + uuidv4().replace(/-/g, '').slice(0, 16);
      
      // Ensure unique human-friendly group code
      let joinCode = generateGroupCode();
      let attempts = 0;
      while (await groupRepository.findByCode(joinCode)) {
        joinCode = generateGroupCode();
        attempts++;
        if (attempts > 10) break;
      }

      const group = await groupRepository.create({
        id: groupId,
        name: name.trim(),
        description: description ? description.trim() : '',
        avatar: avatar || null,
        ownerId,
        joinCode,
      });

      // Generate unpredictable high-entropy QR invitation token
      const inviteToken = crypto.randomBytes(24).toString('hex');
      const inviteId = 'inv_' + uuidv4().replace(/-/g, '').slice(0, 16);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

      await invitationRepository.create({
        id: inviteId,
        groupId,
        token: inviteToken,
        createdBy: ownerId,
        expiresAt,
      });

      // Generate QR Code data URL containing the secure invitation token
      // Payload format: collabspace://join?token=<inviteToken>&code=<joinCode>
      const qrPayload = JSON.stringify({
        platform: 'CollabSpace',
        type: 'group_invite',
        token: inviteToken,
        code: joinCode,
      });

      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: 'H',
        margin: 2,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF'
        },
        width: 320
      });

      return res.status(201).json({
        message: 'Group created successfully.',
        group,
        invitation: {
          code: joinCode,
          token: inviteToken,
          expiresAt,
          qrDataUrl,
        }
      });
    } catch (err) {
      console.error('Create group error:', err);
      return res.status(500).json({ error: 'Failed to create group.' });
    }
  }

  async getMyGroups(req, res) {
    try {
      const groups = await groupRepository.listUserGroups(req.user.id);
      return res.json({ groups });
    } catch (err) {
      console.error('List groups error:', err);
      return res.status(500).json({ error: 'Failed to retrieve groups.' });
    }
  }

  async getGroupDetails(req, res) {
    try {
      const { groupId } = req.params;
      const group = await groupRepository.findById(groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found.' });
      }

      const members = await groupRepository.listMembers(groupId);
      const fileStats = await fileRepository.countGroupFiles(groupId);

      return res.json({
        group,
        members,
        stats: {
          memberCount: members.length,
          fileCount: fileStats.count,
          totalFileSize: fileStats.totalSize,
        },
        userRole: req.membership ? req.membership.role : 'member',
      });
    } catch (err) {
      console.error('Get group details error:', err);
      return res.status(500).json({ error: 'Failed to retrieve group details.' });
    }
  }

  async joinByCode(req, res) {
    try {
      const { code } = req.body;
      const userId = req.user.id;

      if (!code || !code.trim()) {
        return res.status(400).json({ error: 'Group code is required.' });
      }

      const formattedCode = code.toUpperCase().trim();
      const group = await groupRepository.findByCode(formattedCode);

      if (!group) {
        return res.status(404).json({ error: 'Invalid group code. No matching group found.' });
      }

      // Check if user is already a member
      const existing = await groupRepository.findMember(group.id, userId);
      if (existing) {
        return res.status(400).json({
          error: 'You are already a member of this group.',
          groupId: group.id,
        });
      }

      // Add user as regular member
      const memberId = 'gm_' + group.id + '_' + userId;
      await groupRepository.addMember({
        id: memberId,
        groupId: group.id,
        userId,
        role: 'member',
      });

      const updatedGroup = await groupRepository.findById(group.id);
      return res.json({
        message: 'Successfully joined group.',
        group: updatedGroup,
      });
    } catch (err) {
      console.error('Join by code error:', err);
      return res.status(500).json({ error: 'Failed to join group.' });
    }
  }

  async joinByQr(req, res) {
    try {
      const { token } = req.body;
      const userId = req.user.id;

      if (!token || !token.trim()) {
        return res.status(400).json({ error: 'Invitation token is required.' });
      }

      const invite = await invitationRepository.findByToken(token.trim());
      if (!invite) {
        return res.status(404).json({ error: 'Invalid or expired QR invitation.' });
      }

      if (invite.is_revoked) {
        return res.status(400).json({ error: 'This QR invitation has been revoked.' });
      }

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        return res.status(400).json({ error: 'This QR invitation has expired.' });
      }

      if (invite.max_uses > 0 && invite.uses_count >= invite.max_uses) {
        return res.status(400).json({ error: 'This QR invitation has reached its maximum uses.' });
      }

      const group = await groupRepository.findById(invite.group_id);
      if (!group) {
        return res.status(404).json({ error: 'Associated group does not exist.' });
      }

      // Check if user is already a member
      const existing = await groupRepository.findMember(group.id, userId);
      if (existing) {
        return res.status(400).json({
          error: 'You are already a member of this group.',
          groupId: group.id,
        });
      }

      // Add user as regular member
      const memberId = 'gm_' + group.id + '_' + userId;
      await groupRepository.addMember({
        id: memberId,
        groupId: group.id,
        userId,
        role: 'member',
      });

      await invitationRepository.incrementUsage(invite.id);

      const updatedGroup = await groupRepository.findById(group.id);
      return res.json({
        message: 'Successfully joined group via QR invitation.',
        group: updatedGroup,
      });
    } catch (err) {
      console.error('Join by QR error:', err);
      return res.status(500).json({ error: 'Failed to join group via QR.' });
    }
  }

  async getInvitation(req, res) {
    try {
      const { groupId } = req.params;
      const group = await groupRepository.findById(groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found.' });
      }

      let invite = await invitationRepository.findActiveByGroup(groupId);
      if (!invite) {
        // Generate a new secure invitation token
        const inviteToken = crypto.randomBytes(24).toString('hex');
        const inviteId = 'inv_' + uuidv4().replace(/-/g, '').slice(0, 16);
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        invite = await invitationRepository.create({
          id: inviteId,
          groupId,
          token: inviteToken,
          createdBy: req.user.id,
          expiresAt,
        });
      }

      const qrPayload = JSON.stringify({
        platform: 'CollabSpace',
        type: 'group_invite',
        token: invite.token,
        code: group.join_code,
      });

      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: 'H',
        margin: 2,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF'
        },
        width: 320
      });

      return res.json({
        invitation: {
          code: group.join_code,
          token: invite.token,
          expiresAt: invite.expires_at,
          qrDataUrl,
        }
      });
    } catch (err) {
      console.error('Get invitation error:', err);
      return res.status(500).json({ error: 'Failed to generate invitation details.' });
    }
  }

  async listMembers(req, res) {
    try {
      const { groupId } = req.params;
      const members = await groupRepository.listMembers(groupId);
      return res.json({ members });
    } catch (err) {
      console.error('List members error:', err);
      return res.status(500).json({ error: 'Failed to retrieve members.' });
    }
  }

  async updateMemberRole(req, res) {
    try {
      const { groupId, userId } = req.params;
      const { role } = req.body;

      if (!['admin', 'member'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be admin or member.' });
      }

      const targetMember = await groupRepository.findMember(groupId, userId);
      if (!targetMember) {
        return res.status(404).json({ error: 'Member not found in this group.' });
      }

      if (targetMember.role === 'owner') {
        return res.status(403).json({ error: 'Cannot modify the group owner role.' });
      }

      const updated = await groupRepository.updateMemberRole(groupId, userId, role);
      return res.json({ message: 'Member role updated.', member: updated });
    } catch (err) {
      console.error('Update member role error:', err);
      return res.status(500).json({ error: 'Failed to update member role.' });
    }
  }

  async removeMember(req, res) {
    try {
      const { groupId, userId } = req.params;

      const targetMember = await groupRepository.findMember(groupId, userId);
      if (!targetMember) {
        return res.status(404).json({ error: 'Member not found in this group.' });
      }

      if (targetMember.role === 'owner') {
        return res.status(403).json({ error: 'The group owner cannot be removed.' });
      }

      await groupRepository.removeMember(groupId, userId);
      return res.json({ message: 'Member removed from group successfully.' });
    } catch (err) {
      console.error('Remove member error:', err);
      return res.status(500).json({ error: 'Failed to remove member.' });
    }
  }

  async updateGroup(req, res) {
    try {
      const { groupId } = req.params;
      const { name, description, avatar } = req.body;

      if (name && !name.trim()) {
        return res.status(400).json({ error: 'Group name cannot be empty.' });
      }

      const updated = await groupRepository.updateGroup(groupId, {
        name: name ? name.trim() : undefined,
        description: description !== undefined ? description.trim() : undefined,
        avatar: avatar !== undefined ? avatar : undefined,
      });

      return res.json({ message: 'Group updated successfully.', group: updated });
    } catch (err) {
      console.error('Update group error:', err);
      return res.status(500).json({ error: 'Failed to update group.' });
    }
  }
}

module.exports = new GroupController();
