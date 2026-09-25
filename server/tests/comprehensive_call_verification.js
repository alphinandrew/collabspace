const { io } = require('../../client/node_modules/socket.io-client');
const http = require('http');

async function apiRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: '/api' + path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runExhaustiveTests() {
  console.log('====================================================');
  console.log('   COLLABSPACE VIDEO CALL EXHAUSTIVE VERIFICATION    ');
  console.log('====================================================\n');

  const ts = Date.now();

  // Step 1: Register User A, User B, User C (unauthorized outsider)
  console.log('--- STEP 1: Creating Users ---');
  const userARes = await apiRequest('/auth/register', 'POST', {
    name: 'Alice Caller',
    email: `alice_${ts}@example.com`,
    password: 'Password123!',
  });
  const tokenA = userARes.body.token;
  const userA = userARes.body.user;
  console.log('✅ User A (Alice):', userA.id, userA.name);

  const userBRes = await apiRequest('/auth/register', 'POST', {
    name: 'Bob Callee',
    email: `bob_${ts}@example.com`,
    password: 'Password123!',
  });
  const tokenB = userBRes.body.token;
  const userB = userBRes.body.user;
  console.log('✅ User B (Bob):', userB.id, userB.name);

  const userCRes = await apiRequest('/auth/register', 'POST', {
    name: 'Charlie Outsider',
    email: `charlie_${ts}@example.com`,
    password: 'Password123!',
  });
  const tokenC = userCRes.body.token;
  const userC = userCRes.body.user;
  console.log('✅ User C (Charlie - Outsider):', userC.id, userC.name);

  // Step 2: User A creates a group, User B joins it
  console.log('\n--- STEP 2: Setting Up Group Membership ---');
  const groupRes = await apiRequest(
    '/groups',
    'POST',
    { name: 'Engineering Sync', description: 'Daily video engineering sync' },
    tokenA
  );
  const group = groupRes.body.group;
  const joinCode = groupRes.body.invitation.code;
  console.log('✅ Group Created by Alice:', group.id, `"${group.name}"`, 'JoinCode:', joinCode);

  const joinRes = await apiRequest('/groups/join-code', 'POST', { code: joinCode }, tokenB);
  console.log('✅ Bob Joined Group:', joinRes.status, `Member count: ${joinRes.body.group.member_count}`);

  // Step 3: Sockets Connect
  console.log('\n--- STEP 3: Connecting Sockets & Verifying Room Placement ---');
  const socketA = io('http://localhost:4000', { auth: { token: tokenA }, transports: ['websocket'] });
  await new Promise((r) => socketA.on('connect', r));
  console.log('✅ Alice Socket Connected:', socketA.id);

  const socketB = io('http://localhost:4000', { auth: { token: tokenB }, transports: ['websocket'] });
  await new Promise((r) => socketB.on('connect', r));
  console.log('✅ Bob Socket Connected:', socketB.id);

  const socketC = io('http://localhost:4000', { auth: { token: tokenC }, transports: ['websocket'] });
  await new Promise((r) => socketC.on('connect', r));
  console.log('✅ Charlie (Outsider) Socket Connected:', socketC.id);

  await wait(500);

  // Step 4: Test 1 - First Video Call Initiation & Realtime Delivery
  console.log('\n--- STEP 4: TEST 1 - Video Call Initiation & Incoming Routing ---');
  let bobReceivedCall = null;
  let charlieReceivedCall = null;

  socketB.on('call:incoming', (data) => {
    bobReceivedCall = data;
    console.log('🔔 [BOB RECEIVED call:incoming]:', data.callId, 'from', data.initiator.name, 'in', data.groupName);
  });

  socketC.on('call:incoming', (data) => {
    charlieReceivedCall = data;
    console.error('🚨 [SECURITY BREACH]: Charlie (outsider) received call:incoming!');
  });

  const initAck = await new Promise((res) => {
    socketA.emit('call:initiate', { groupId: group.id, callType: 'video' }, res);
  });
  console.log('✅ Alice call:initiate ack:', initAck);

  await wait(600);

  if (!bobReceivedCall) {
    throw new Error('FAILED: Bob did not receive call:incoming event!');
  }
  if (charlieReceivedCall) {
    throw new Error('SECURITY FAILURE: Unauthorized outsider received call:incoming!');
  }
  console.log('✅ TEST 1 PASSED: Bob received call:incoming event in realtime. Unauthorized outsider did NOT receive it.');

  // Step 5: Test 2 - Call Acceptance & WebRTC Signaling Handshake
  console.log('\n--- STEP 5: TEST 2 - Call Acceptance & SDP / ICE Relay ---');
  let aliceReceivedPeerJoined = null;
  socketA.on('call:peer-joined', (data) => {
    aliceReceivedPeerJoined = data;
    console.log('👥 [ALICE RECEIVED call:peer-joined]:', data.user.name, `(${data.socketId})`);
  });

  // Bob accepts call
  const joinAck = await new Promise((res) => {
    socketB.emit('call:join', { groupId: group.id, isMuted: false, isCameraOff: false }, res);
  });
  console.log('✅ Bob call:join ack:', joinAck.success, 'callId:', joinAck.callId, 'Existing peers:', joinAck.participants.length);

  await wait(300);
  if (!aliceReceivedPeerJoined || aliceReceivedPeerJoined.user.id !== userB.id) {
    throw new Error('FAILED: Alice did not receive call:peer-joined for Bob!');
  }
  console.log('✅ Bob joined call. Alice received peer-joined event.');

  // Bob sends SDP Offer to Alice
  let aliceReceivedOffer = null;
  socketA.on('call:offer', (data) => {
    aliceReceivedOffer = data;
    console.log('📨 [ALICE RECEIVED call:offer] from:', data.callerSocketId);
  });

  const dummyOffer = { type: 'offer', sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' };
  socketB.emit('call:offer', { targetSocketId: socketA.id, offer: dummyOffer });

  await wait(300);
  if (!aliceReceivedOffer || aliceReceivedOffer.offer.sdp !== dummyOffer.sdp) {
    throw new Error('FAILED: Alice did not receive SDP offer from Bob!');
  }
  console.log('✅ Alice received SDP offer relay.');

  // Alice sends SDP Answer to Bob
  let bobReceivedAnswer = null;
  socketB.on('call:answer', (data) => {
    bobReceivedAnswer = data;
    console.log('📨 [BOB RECEIVED call:answer] from:', data.responderSocketId);
  });

  const dummyAnswer = { type: 'answer', sdp: 'v=0\r\no=- 54321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' };
  socketA.emit('call:answer', { targetSocketId: socketB.id, answer: dummyAnswer });

  await wait(300);
  if (!bobReceivedAnswer || bobReceivedAnswer.answer.sdp !== dummyAnswer.sdp) {
    throw new Error('FAILED: Bob did not receive SDP answer from Alice!');
  }
  console.log('✅ Bob received SDP answer relay.');

  // ICE Candidate exchange
  let bobReceivedIce = null;
  socketB.on('call:ice-candidate', (data) => {
    bobReceivedIce = data;
    console.log('🧊 [BOB RECEIVED call:ice-candidate] from:', data.senderSocketId);
  });

  const dummyIce = { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host', sdpMid: '0', sdpMLineIndex: 0 };
  socketA.emit('call:ice-candidate', { targetSocketId: socketB.id, candidate: dummyIce });

  await wait(300);
  if (!bobReceivedIce || !bobReceivedIce.candidate) {
    throw new Error('FAILED: ICE candidate exchange failed!');
  }
  console.log('✅ ICE candidate exchanged successfully.');

  // Media toggle test
  let bobReceivedMediaToggle = null;
  socketB.on('call:peer-media-toggled', (data) => {
    bobReceivedMediaToggle = data;
    console.log('🎤 [BOB RECEIVED call:peer-media-toggled]: isMuted =', data.isMuted);
  });

  socketA.emit('call:toggle-media', { groupId: group.id, isMuted: true, isCameraOff: false, isScreenSharing: false });
  await wait(300);
  if (!bobReceivedMediaToggle || bobReceivedMediaToggle.isMuted !== true) {
    throw new Error('FAILED: Media toggle event was not relayed!');
  }
  console.log('✅ Media state toggle relayed successfully.');

  // Step 6: End Call & Verify Cleanup
  console.log('\n--- STEP 6: Ending Call & Verifying Cleanup ---');
  let bobReceivedEnded = false;
  socketB.on('call:ended', (data) => {
    bobReceivedEnded = true;
    console.log('🔴 [BOB RECEIVED call:ended]: Call', data.callId);
  });

  socketA.emit('call:leave', { groupId: group.id });
  socketB.emit('call:leave', { groupId: group.id });

  await wait(500);
  if (!bobReceivedEnded) {
    throw new Error('FAILED: call:ended event not broadcast after all participants left!');
  }
  console.log('✅ Call 1 ended and cleaned up cleanly.');

  // Step 7: Test 3 - Second Call with Call Decline Flow
  console.log('\n--- STEP 7: TEST 3 - Second Call & Decline Flow ---');
  let bobSecondCall = null;
  socketB.on('call:incoming', (data) => {
    bobSecondCall = data;
    console.log('🔔 [BOB RECEIVED 2ND call:incoming]:', data.callId);
  });

  let aliceReceivedDeclined = null;
  socketA.on('call:declined', (data) => {
    aliceReceivedDeclined = data;
    console.log('✋ [ALICE RECEIVED call:declined]: by', data.userName);
  });

  const init2Ack = await new Promise((res) => {
    socketA.emit('call:initiate', { groupId: group.id, callType: 'video' }, res);
  });
  console.log('✅ Second call initiated:', init2Ack.callId);

  await wait(500);
  if (!bobSecondCall || bobSecondCall.callId !== init2Ack.callId) {
    throw new Error('FAILED: Bob did not receive 2nd call:incoming!');
  }
  console.log('✅ Bob received 2nd call notification.');

  // Bob declines
  socketB.emit('call:decline', { groupId: group.id, callId: init2Ack.callId });
  await wait(400);

  if (!aliceReceivedDeclined || aliceReceivedDeclined.userId !== userB.id) {
    throw new Error('FAILED: Alice did not receive call:declined event!');
  }
  console.log('✅ Alice received call:declined event cleanly.');

  socketA.emit('call:leave', { groupId: group.id });
  await wait(300);

  // Step 8: Test 4 - Call Delivery After Bob Reconnects (New Socket ID)
  console.log('\n--- STEP 8: TEST 4 - Delivery After Reconnect (New Socket ID) ---');
  socketB.disconnect();
  console.log('Disconnected Bob socket.');
  await wait(300);

  // Bob reconnects as if page refreshed
  const socketB2 = io('http://localhost:4000', { auth: { token: tokenB }, transports: ['websocket'] });
  await new Promise((r) => socketB2.on('connect', r));
  console.log('✅ Bob reconnected with new socket:', socketB2.id);

  let bobReconnectedCall = null;
  socketB2.on('call:incoming', (data) => {
    bobReconnectedCall = data;
    console.log('🔔 [BOB NEW SOCKET RECEIVED call:incoming]:', data.callId);
  });

  // Wait for server to auto-join rooms
  await wait(400);

  const init3Ack = await new Promise((res) => {
    socketA.emit('call:initiate', { groupId: group.id, callType: 'video' }, res);
  });
  console.log('✅ Third call initiated:', init3Ack.callId);

  await wait(600);
  if (!bobReconnectedCall || bobReconnectedCall.callId !== init3Ack.callId) {
    throw new Error('FAILED: Bob did not receive call on reconnected socket!');
  }
  console.log('✅ TEST 4 PASSED: Reconnected socket automatically received call:incoming without manual join.');

  // Step 9: Test 5 - Unauthorized Caller Protection
  console.log('\n--- STEP 9: TEST 5 - Unauthorized Caller Rejection ---');
  const unauthorizedAck = await new Promise((res) => {
    socketC.emit('call:initiate', { groupId: group.id, callType: 'video' }, res);
  });
  console.log('Unauthorized initiation ack:', unauthorizedAck);
  if (unauthorizedAck.success !== false || !unauthorizedAck.error) {
    throw new Error('SECURITY FAILURE: Unauthorized outsider was allowed to initiate call in group!');
  }
  console.log('✅ TEST 5 PASSED: Server successfully rejected unauthorized call initiation.');

  // Clean up
  socketA.emit('call:leave', { groupId: group.id });
  socketA.disconnect();
  socketB2.disconnect();
  socketC.disconnect();

  console.log('\n====================================================');
  console.log('   ALL 5 TESTS PASSED WITH 100% SUCCESSFUL PROOF!   ');
  console.log('====================================================');
}

runExhaustiveTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
