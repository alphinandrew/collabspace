const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { io } = require('../../client/node_modules/socket.io-client');
const routes = require('../src/routes');
const { getDatabase } = require('../src/db/database');
const { initSocketIO } = require('../src/realtime/socketHandler');

const PORT = 4005;
const BASE_URL = `http://localhost:${PORT}/api`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiRequest(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, body: data };
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const s = io(`http://localhost:${PORT}`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    s.on('connect', () => resolve(s));
    s.on('connect_error', (err) => reject(err));
  });
}

async function runVerificationSuite() {
  console.log('================================================================');
  console.log(' COLLABSPACE FEATURE EXPANSION COMPREHENSIVE RUNTIME VERIFICATION');
  console.log('================================================================\n');

  // 1. Initialize Server & DB
  const app = express();
  const server = http.createServer(app);
  await getDatabase();

  app.use(cors({ origin: '*', credentials: true }));
  app.use(express.json());
  const socketServer = new Server(server, { cors: { origin: '*' } });
  app.set('io', socketServer);
  initSocketIO(socketServer);
  app.use('/api', routes);

  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[TEST-INIT] Test server running on port ${PORT}`);

  const testResults = [];
  const recordResult = (name, passed, details) => {
    testResults.push({ name, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${name}]: ${details}`);
  };

  try {
    const ts = Date.now();

    // STEP 1: AUTHENTICATION & MULTI-USER REGISTRATION
    console.log('\n--- 1. Authenticating 3 Genuine User Accounts ---');
    const uARes = await apiRequest('/auth/register', 'POST', {
      name: 'Alice (Owner)',
      email: `alice_${ts}@test.com`,
      password: 'Password123!',
    });
    const tokenA = uARes.body.token;
    const userA = uARes.body.user;

    const uBRes = await apiRequest('/auth/register', 'POST', {
      name: 'Bob (Admin)',
      email: `bob_${ts}@test.com`,
      password: 'Password123!',
    });
    const tokenB = uBRes.body.token;
    const userB = uBRes.body.user;

    const uCRes = await apiRequest('/auth/register', 'POST', {
      name: 'Charlie (Member)',
      email: `charlie_${ts}@test.com`,
      password: 'Password123!',
    });
    const tokenC = uCRes.body.token;
    const userC = uCRes.body.user;

    recordResult('User Registration', tokenA && tokenB && tokenC, 'Alice, Bob, and Charlie registered with JWTs');

    // STEP 2: GROUP CREATION & JOINING (MULTI-GROUP)
    console.log('\n--- 2. Workspace Setup: Group Alpha & Group Beta ---');
    const grpAlphaRes = await apiRequest('/groups', 'POST', { name: 'Alpha Project' }, tokenA);
    const grpAlpha = grpAlphaRes.body.group;
    const joinCodeAlpha = grpAlpha.join_code;

    // Bob & Charlie join Group Alpha by code
    await apiRequest('/groups/join-code', 'POST', { code: joinCodeAlpha }, tokenB);
    await apiRequest('/groups/join-code', 'POST', { code: joinCodeAlpha }, tokenC);

    // Promote Bob to Admin in Group Alpha
    await apiRequest(`/groups/${grpAlpha.id}/members/${userB.id}/role`, 'PUT', { role: 'admin' }, tokenA);

    // Alice creates Group Beta, Bob joins Group Beta (Charlie is NOT in Group Beta)
    const grpBetaRes = await apiRequest('/groups', 'POST', { name: 'Beta Launch' }, tokenA);
    const grpBeta = grpBetaRes.body.group;
    await apiRequest('/groups/join-code', 'POST', { code: grpBeta.join_code }, tokenB);

    recordResult(
      'Workspaces Setup',
      grpAlpha && grpBeta,
      'Group Alpha (Alice=Owner, Bob=Admin, Charlie=Member) and Group Beta created'
    );

    // STEP 3: CONNECT AUTHENTICATED REALTIME SOCKETS
    console.log('\n--- 3. Connecting Socket.IO Clients for Alice, Bob, Charlie ---');
    const socketA = await connectSocket(tokenA);
    const socketB = await connectSocket(tokenB);
    const socketC = await connectSocket(tokenC);

    // Join group rooms
    socketA.emit('group:join', { groupId: grpAlpha.id });
    socketB.emit('group:join', { groupId: grpAlpha.id });
    socketC.emit('group:join', { groupId: grpAlpha.id });
    socketA.emit('group:join', { groupId: grpBeta.id });
    socketB.emit('group:join', { groupId: grpBeta.id });
    await wait(300);

    recordResult('Realtime Socket Connections', socketA.connected && socketB.connected && socketC.connected, '3 independent authenticated sockets connected');

    // FEATURE 6: MESSAGE REACTIONS (TEST J)
    console.log('\n--- 4. Feature 6: Realtime Message Reactions ---');
    // Alice sends a message
    const msgRes = await apiRequest(`/groups/${grpAlpha.id}/messages`, 'POST', { content: 'Please review specifications' }, tokenA);
    const msgId = msgRes.body.message.id;

    // Setup reaction event listener on Alice's socket
    let receivedReactionEvent = null;
    socketA.on('chat:reaction', (evt) => {
      receivedReactionEvent = evt;
    });

    // Bob reacts with 👍
    const reactB = await apiRequest(`/groups/${grpAlpha.id}/messages/${msgId}/reactions`, 'POST', { emoji: '👍' }, tokenB);
    await wait(200);

    const hasReactionB = reactB.body.success && reactB.body.action === 'added';
    const rxnEventMatch = receivedReactionEvent && receivedReactionEvent.emoji === '👍' && receivedReactionEvent.userId === userB.id;
    recordResult('Reaction Add & Realtime Broadcast', hasReactionB && rxnEventMatch, 'Bob reacted 👍, Alice received realtime chat:reaction event');

    // Charlie also reacts with 👍 and ❤️
    await apiRequest(`/groups/${grpAlpha.id}/messages/${msgId}/reactions`, 'POST', { emoji: '👍' }, tokenC);
    await apiRequest(`/groups/${grpAlpha.id}/messages/${msgId}/reactions`, 'POST', { emoji: '❤️' }, tokenC);

    // Verify aggregated counts
    let msgsAfterRxn = await apiRequest(`/groups/${grpAlpha.id}/messages`, 'GET', null, tokenA);
    let targetMsg = msgsAfterRxn.body.messages.find((m) => m.id === msgId);
    let thumbsUpRxn = targetMsg.reactions.find((r) => r.emoji === '👍');
    let heartRxn = targetMsg.reactions.find((r) => r.emoji === '❤️');

    recordResult(
      'Reaction Count Aggregation',
      thumbsUpRxn?.count === 2 && heartRxn?.count === 1,
      `👍 count: ${thumbsUpRxn?.count} (expected 2), ❤️ count: ${heartRxn?.count} (expected 1)`
    );

    // Toggle off: Bob reacts with 👍 again to remove
    const removeReactB = await apiRequest(`/groups/${grpAlpha.id}/messages/${msgId}/reactions`, 'POST', { emoji: '👍' }, tokenB);
    msgsAfterRxn = await apiRequest(`/groups/${grpAlpha.id}/messages`, 'GET', null, tokenA);
    targetMsg = msgsAfterRxn.body.messages.find((m) => m.id === msgId);
    thumbsUpRxn = targetMsg.reactions.find((r) => r.emoji === '👍');

    recordResult(
      'Reaction Toggle Removal & Persistence',
      removeReactB.body.action === 'removed' && thumbsUpRxn?.count === 1,
      `Bob toggled 👍 off, count updated to ${thumbsUpRxn?.count} (expected 1)`
    );

    // FEATURE 7: SEND EMOJIS IN MESSAGES (TEST K)
    console.log('\n--- 5. Feature 7: Emojis in Messages & Unicode Persistence ---');
    const emojiOnlyRes = await apiRequest(`/groups/${grpAlpha.id}/messages`, 'POST', { content: '🎉🔥🚀' }, tokenB);
    const emojiTextRes = await apiRequest(`/groups/${grpAlpha.id}/messages`, 'POST', { content: 'Great job team! 👏💯' }, tokenC);

    const historyRes = await apiRequest(`/groups/${grpAlpha.id}/messages`, 'GET', null, tokenA);
    const hasEmojiOnly = historyRes.body.messages.some((m) => m.content === '🎉🔥🚀');
    const hasEmojiText = historyRes.body.messages.some((m) => m.content === 'Great job team! 👏💯');

    recordResult('Emoji Messages Persistence', hasEmojiOnly && hasEmojiText, 'Emoji-only and combined text+emoji messages persisted and retrieved accurately');

    // FEATURE 3: MESSAGE FORWARDING (TEST E & F)
    console.log('\n--- 6. Feature 3: Forward Message Between Groups ---');
    // Alice sends message in Group Alpha to be forwarded
    const sourceMsgRes = await apiRequest(
      `/groups/${grpAlpha.id}/messages`,
      'POST',
      { content: 'Urgent: Roadmap updated for Q4 launch' },
      tokenA
    );
    const sourceMsgId = sourceMsgRes.body.message.id;

    // Bob listens on Group Beta
    let receivedForwardedBeta = null;
    socketB.on('chat:message', (msg) => {
      if (msg.group_id === grpBeta.id) receivedForwardedBeta = msg;
    });

    // Alice forwards message from Group Alpha to Group Beta
    const fwdRes = await apiRequest(
      `/groups/${grpAlpha.id}/messages/${sourceMsgId}/forward`,
      'POST',
      { destinationGroupId: grpBeta.id },
      tokenA
    );
    await wait(200);

    const fwdMsg = fwdRes.body.message;
    const fwdVerified =
      fwdRes.status === 201 &&
      fwdMsg.content === 'Urgent: Roadmap updated for Q4 launch' &&
      fwdMsg.forwarded_from_group_id === grpAlpha.id &&
      fwdMsg.forwarded_from_sender_name === 'Alice (Owner)';

    recordResult(
      'Forward Message Operation',
      fwdVerified && receivedForwardedBeta?.id === fwdMsg.id,
      `Message forwarded to Group Beta with metadata (sender: ${fwdMsg.forwarded_from_sender_name}, sourceGroup: ${fwdMsg.forwarded_from_group_id})`
    );

    // Forward Permission Security Test: Charlie (not in Group Beta) attempts to forward to Group Beta
    const charlieFwdRes = await apiRequest(
      `/groups/${grpAlpha.id}/messages/${sourceMsgId}/forward`,
      'POST',
      { destinationGroupId: grpBeta.id },
      tokenC
    );
    recordResult(
      'Forwarding Security Authorization',
      charlieFwdRes.status === 403,
      `Non-member Charlie rejected with status ${charlieFwdRes.status} (403 Forbidden expected)`
    );

    // FEATURE 1 & 2: IN-CALL CHAT & ACTIVE CALL LATE JOIN (TEST A, B, C, D)
    console.log('\n--- 7. Feature 1 & 2: Video Call, In-Call Chat, Concurrency & Late Join ---');
    let callIncomingEvent = null;
    socketB.on('call:incoming', (data) => {
      callIncomingEvent = data;
    });

    let activeCallEventAlpha = null;
    socketB.on('call:active', (data) => {
      activeCallEventAlpha = data;
    });
    socketC.on('call:active', (data) => {
      activeCallEventAlpha = data;
    });

    // Alice initiates video call in Group Alpha
    const callInitiatePromise = new Promise((resolve) => {
      socketA.emit('call:initiate', { groupId: grpAlpha.id, callType: 'video' }, resolve);
    });
    const initiateRes = await callInitiatePromise;
    await wait(200);

    recordResult(
      'Call Initiation & Routing',
      initiateRes.success && callIncomingEvent?.callId === initiateRes.callId,
      `Alice initiated call ${initiateRes.callId}, Bob received call:incoming event`
    );

    // Bob joins call
    let aliceReceivedPeerJoined = null;
    socketA.on('call:peer-joined', (peer) => {
      aliceReceivedPeerJoined = peer;
    });

    const bobJoinPromise = new Promise((resolve) => {
      socketB.emit('call:join', { groupId: grpAlpha.id }, resolve);
    });
    const bobJoinRes = await bobJoinPromise;
    await wait(200);

    recordResult(
      'Participant Join & Sync',
      bobJoinRes.success && aliceReceivedPeerJoined?.user.id === userB.id,
      `Bob joined call, Alice received call:peer-joined with Bob's details`
    );

    // FEATURE 1: IN-CALL CHAT TEST
    // While call is active, Alice sends chat message in Group Alpha
    let bobReceivedInCallChat = null;
    socketB.on('chat:message', (m) => {
      if (m.content === 'Checking the document while in call') bobReceivedInCallChat = m;
    });

    const inCallChatRes = await apiRequest(
      `/groups/${grpAlpha.id}/messages`,
      'POST',
      { content: 'Checking the document while in call' },
      tokenA
    );
    await wait(200);

    recordResult(
      'Feature 1: In-Call Group Chat Persistence',
      inCallChatRes.status === 201 && bobReceivedInCallChat !== null,
      'Alice sent chat message during call; Bob received via realtime chat:message; saved in group DB'
    );

    // Group Call Concurrency: Bob clicks Start Call while call is active
    const bobConflictPromise = new Promise((resolve) => {
      socketB.emit('call:initiate', { groupId: grpAlpha.id, callType: 'video' }, resolve);
    });
    const bobConflictRes = await bobConflictPromise;
    recordResult(
      'Call Concurrency Prevention',
      bobConflictRes.success && bobConflictRes.callId === initiateRes.callId,
      'Initiating while active joins the existing session without creating a conflict'
    );

    // FEATURE 2: LATE JOINER TEST (Charlie joins late)
    // Charlie queries server for active call in Group Alpha
    const activeCallSummary = await apiRequest(`/groups/${grpAlpha.id}/calls/active`, 'GET', null, tokenC);
    const activeCallReported = activeCallSummary.body.call;

    recordResult(
      'Server-Aware Active Call State',
      activeCallReported?.active === true && activeCallReported?.participantCount === 2,
      `Charlie sees Active Video Call with ${activeCallReported?.participantCount} participants`
    );

    // Charlie presses Join Call
    let aliceSawCharlie = null;
    let bobSawCharlie = null;
    socketA.on('call:peer-joined', (p) => {
      if (p.user.id === userC.id) aliceSawCharlie = p;
    });
    socketB.on('call:peer-joined', (p) => {
      if (p.user.id === userC.id) bobSawCharlie = p;
    });

    const charlieJoinPromise = new Promise((resolve) => {
      socketC.emit('call:join', { groupId: grpAlpha.id }, resolve);
    });
    const charlieJoinRes = await charlieJoinPromise;
    await wait(200);

    // Charlie receives existing participants [Alice, Bob]
    const charlieReceivedPeers = charlieJoinRes.participants.map((p) => p.user.id);
    const hasAliceAndBob = charlieReceivedPeers.includes(userA.id) && charlieReceivedPeers.includes(userB.id);

    recordResult(
      'Feature 2: Late Joiner Media Negotiation',
      charlieJoinRes.success && hasAliceAndBob && aliceSawCharlie !== null && bobSawCharlie !== null,
      `Charlie joined existing call: received peers [${charlieReceivedPeers.join(', ')}], Alice and Bob received Charlie`
    );

    // WebRTC Signaling Relay between Charlie and Alice
    let aliceReceivedOffer = null;
    socketA.on('call:offer', (evt) => {
      aliceReceivedOffer = evt;
    });

    socketC.emit('call:offer', { targetSocketId: socketA.id, offer: { type: 'offer', sdp: 'fake-sdp-test' } });
    await wait(150);

    recordResult(
      'WebRTC Offer Relay to Late Joiner',
      aliceReceivedOffer !== null && aliceReceivedOffer.offer.sdp === 'fake-sdp-test',
      'WebRTC offer successfully routed between Charlie and Alice'
    );

    // Charlie leaves call
    let aliceSawCharlieLeave = null;
    socketA.on('call:peer-left', (p) => {
      if (p.userId === userC.id) aliceSawCharlieLeave = p;
    });
    socketC.emit('call:leave', { groupId: grpAlpha.id });
    await wait(200);

    recordResult(
      'Dynamic Participant Leave',
      aliceSawCharlieLeave !== null,
      'Charlie left call; Alice received call:peer-left; remaining participants updated'
    );

    // FEATURE 4: MEMBER REMOVAL & AUTHORIZATION (TEST G & H)
    console.log('\n--- 8. Feature 4: Member Removal & Server-side Authorization ---');
    // Admin Bob attempts to remove Owner Alice -> must fail (Owner protection)
    const bobRemoveOwner = await apiRequest(`/groups/${grpAlpha.id}/members/${userA.id}`, 'DELETE', null, tokenB);
    recordResult(
      'Owner Protection (Admin cannot remove Owner)',
      bobRemoveOwner.status === 403,
      `Rejected with status ${bobRemoveOwner.status} (403 Forbidden expected)`
    );

    // Charlie (normal member) attempts to remove Bob -> must fail
    const charlieRemoveBob = await apiRequest(`/groups/${grpAlpha.id}/members/${userB.id}`, 'DELETE', null, tokenC);
    recordResult(
      'Member Denial (Normal member cannot remove anyone)',
      charlieRemoveBob.status === 403,
      `Rejected with status ${charlieRemoveBob.status} (403 Forbidden expected)`
    );

    // Owner Alice removes Charlie from Group Alpha
    let charlieReceivedEviction = false;
    socketC.on('group:member_removed', (evt) => {
      if (evt.userId === userC.id) charlieReceivedEviction = true;
    });

    const removeCharlieRes = await apiRequest(`/groups/${grpAlpha.id}/members/${userC.id}`, 'DELETE', null, tokenA);
    await wait(200);

    // Verify Charlie can no longer access Group Alpha messages
    const charlieAccessDenied = await apiRequest(`/groups/${grpAlpha.id}/messages`, 'GET', null, tokenC);

    recordResult(
      'Member Removal & Realtime Revocation',
      removeCharlieRes.status === 200 && charlieReceivedEviction && charlieAccessDenied.status === 403,
      'Alice removed Charlie; Charlie socket received group:member_removed; subsequent API access denied (403)'
    );

    // FEATURE 5: GROUP DELETION (TEST I)
    console.log('\n--- 9. Feature 5: Group Deletion with Confirmation ---');
    // Normal member / non-admin attempts deletion -> must fail
    const unauthDelete = await apiRequest(`/groups/${grpAlpha.id}`, 'DELETE', null, tokenC);
    recordResult(
      'Group Deletion Authorization Check',
      unauthDelete.status === 403,
      `Unauthorized deletion rejected with status ${unauthDelete.status} (403 Forbidden expected)`
    );

    // Wrong confirmation name -> must fail
    const wrongNameDelete = await apiRequest(
      `/groups/${grpAlpha.id}`,
      'DELETE',
      { confirmationName: 'Wrong Workspace Name' },
      tokenA
    );
    recordResult(
      'Group Deletion Confirmation Name Enforcement',
      wrongNameDelete.status === 400,
      `Wrong confirmation name rejected with status ${wrongNameDelete.status}`
    );

    // Call is active before deletion (Alice and Bob are still connected)
    let callEndedReceived = false;
    let groupDeletedReceived = false;
    socketB.on('call:ended', () => {
      callEndedReceived = true;
    });
    socketB.on('group:deleted', (evt) => {
      if (evt.groupId === grpAlpha.id) groupDeletedReceived = true;
    });

    // Alice confirms deletion with exact group name
    const deleteGroupRes = await apiRequest(
      `/groups/${grpAlpha.id}`,
      'DELETE',
      { confirmationName: 'Alpha Project' },
      tokenA
    );
    await wait(300);

    // Verify group disappeared from Bob's and Alice's group lists
    const bobGroups = await apiRequest('/groups', 'GET', null, tokenB);
    const isAlphaGone = !bobGroups.body.groups.some((g) => g.id === grpAlpha.id);

    // Verify active call was terminated
    const callAfterDelete = await apiRequest(`/groups/${grpAlpha.id}/calls/active`, 'GET', null, tokenA);

    recordResult(
      'Feature 5: Group Deletion, Call Termination & Data Lifecycle',
      deleteGroupRes.status === 200 &&
        callEndedReceived &&
        groupDeletedReceived &&
        isAlphaGone &&
        (callAfterDelete.status === 403 || !callAfterDelete.body.call),
      'Group soft-deleted; active call terminated; sockets notified & evicted; group removed from member list'
    );

    // STEP 10: CORE REGRESSION TESTS
    console.log('\n--- 10. Regression Tests on Existing Features ---');
    const qrInviteRes = await apiRequest(`/groups/${grpBeta.id}/invitation`, 'GET', null, tokenA);
    const hasQr = qrInviteRes.body?.invitation?.qrDataUrl?.startsWith('data:image/png;base64');
    recordResult('QR Invitation Generation', hasQr, 'QR code data URL generated and valid');

    const meRes = await apiRequest('/auth/me', 'GET', null, tokenA);
    recordResult('User Session Identity (/auth/me)', meRes.status === 200 && meRes.body.user.id === userA.id, 'Session token verified');

    const logoutRes = await apiRequest('/auth/logout', 'POST', null, tokenA);
    recordResult('Logout Endpoint', logoutRes.status === 200, 'User logged out cleanly');

  } catch (err) {
    console.error('Test execution error:', err);
    recordResult('Suite Execution Exception', false, err.message);
  } finally {
    socketServer.close();
    server.close();
  }

  console.log('\n================================================================');
  console.log('                 FINAL TEST SUITE SUMMARY                        ');
  console.log('================================================================');
  const allPassed = testResults.every((t) => t.passed);
  console.log(`TOTAL TESTS: ${testResults.length} | PASSED: ${testResults.filter((t) => t.passed).length} | FAILED: ${testResults.filter((t) => !t.passed).length}`);
  console.log(`OVERALL RESULT: ${allPassed ? 'ALL FEATURES VERIFIED' : 'FAILURES DETECTED'}\n`);

  process.exit(allPassed ? 0 : 1);
}

runVerificationSuite();
