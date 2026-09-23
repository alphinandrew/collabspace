const { v4: uuidv4 } = require('uuid');
const callRepository = require('../db/repositories/callRepository');

class CallController {
  async initiateCall(req, res) {
    try {
      const { groupId } = req.params;
      const { callType = 'video' } = req.body;
      const initiatedBy = req.user.id;

      // Check if there is already an active call in this group
      let activeCall = await callRepository.findActiveCall(groupId);
      if (activeCall) {
        return res.json({ call: activeCall, isExisting: true });
      }

      const callId = 'cal_' + uuidv4().replace(/-/g, '').slice(0, 16);
      const newCall = await callRepository.create({
        id: callId,
        groupId,
        initiatedBy,
        callType,
      });

      return res.status(201).json({ call: newCall, isExisting: false });
    } catch (err) {
      console.error('Initiate call error:', err);
      return res.status(500).json({ error: 'Failed to initiate call session.' });
    }
  }

  async getActiveCall(req, res) {
    try {
      const { groupId } = req.params;
      const activeCall = await callRepository.findActiveCall(groupId);
      return res.json({ call: activeCall || null });
    } catch (err) {
      console.error('Get active call error:', err);
      return res.status(500).json({ error: 'Failed to retrieve active call.' });
    }
  }

  async endCall(req, res) {
    try {
      const { groupId, callId } = req.params;
      const now = new Date().toISOString();
      const updated = await callRepository.updateStatus(callId, 'ended', now);
      return res.json({ message: 'Call ended.', call: updated });
    } catch (err) {
      console.error('End call error:', err);
      return res.status(500).json({ error: 'Failed to end call.' });
    }
  }

  async getCallHistory(req, res) {
    try {
      const { groupId } = req.params;
      const history = await callRepository.listGroupCalls(groupId);
      return res.json({ calls: history });
    } catch (err) {
      console.error('Call history error:', err);
      return res.status(500).json({ error: 'Failed to retrieve call history.' });
    }
  }
}

module.exports = new CallController();
