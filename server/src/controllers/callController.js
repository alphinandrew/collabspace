const { v4: uuidv4 } = require('uuid');
const callRepository = require('../db/repositories/callRepository');

class CallController {
  async initiateCall(req, res) {
    try {
      const { groupId } = req.params;
      const { callType = 'video' } = req.body;
      const initiatedBy = req.user.id;

      // Check in-memory or database active call
      const { getActiveCallSummary } = require('../realtime/callSignaler');
      const summary = getActiveCallSummary(groupId);
      if (summary && summary.active) {
        return res.json({ call: summary, isExisting: true });
      }

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
      const { getActiveCallSummary } = require('../realtime/callSignaler');
      const memoryCall = getActiveCallSummary(groupId);
      if (memoryCall && memoryCall.active) {
        return res.json({ call: memoryCall });
      }

      const activeCall = await callRepository.findActiveCall(groupId);
      if (activeCall) {
        return res.json({
          call: {
            active: true,
            callId: activeCall.id,
            groupId: activeCall.group_id,
            callType: activeCall.call_type,
            initiator: {
              id: activeCall.initiated_by,
              name: activeCall.initiator_name,
              avatar: activeCall.initiator_avatar,
            },
            startedAt: activeCall.started_at,
            participantCount: 1,
            participants: [],
          },
        });
      }

      return res.json({ call: null });
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

      const { activeCalls, broadcastActiveCallState } = require('../realtime/callSignaler');
      if (activeCalls.has(groupId)) {
        activeCalls.delete(groupId);
        const io = req.app.get('io');
        if (io) {
          io.to(`group_${groupId}`).emit('call:ended', { callId, groupId });
          broadcastActiveCallState(io, groupId);
        }
      }

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
