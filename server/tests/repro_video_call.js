const { io } = require('../../client/node_modules/socket.io-client');
const http = require('http');

async function apiRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: '/api' + path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTest() {
  console.log('=== STARTING REPRODUCTION SCRIPT ===');
  const timestamp = Date.now();

  // 1. Register User A
  console.log('\n[1] Registering User A...');
  const userARes = await apiRequest('/auth/register', 'POST', {
    name: 'User A',
    email: `usera_${timestamp}@example.com`,
    password: 'Password123!',
  });
  console.log('User A registration:', userARes.status, userARes.body?.user?.id);
  const tokenA = userARes.body.token;
  const userA = userARes.body.user;

  // 2. Register User B
  console.log('\n[2] Registering User B...');
  const userBRes = await apiRequest('/auth/register', 'POST', {
    name: 'User B',
    email: `userb_${timestamp}@example.com`,
    password: 'Password123!',
  });
  console.log('User B registration:', userBRes.status, userBRes.body?.user?.id);
  const tokenB = userBRes.body.token;
  const userB = userBRes.body.user;

  // 3. User A creates a group
  console.log('\n[3] User A creating a group...');
  const groupRes = await apiRequest(
    '/groups',
    'POST',
    { name: 'Video Call Test Group', description: 'Testing group video calls' },
    tokenA
  );
  console.log('Group created:', groupRes.status, groupRes.body?.group?.id, 'joinCode:', groupRes.body?.invitation?.code);
  const group = groupRes.body.group;
  const joinCode = groupRes.body.invitation.code;

  // 4. User B joins the group via joinCode
  console.log('\n[4] User B joining the group with code:', joinCode);
  const joinRes = await apiRequest('/groups/join-code', 'POST', { code: joinCode }, tokenB);
  console.log('User B join result:', joinRes.status, joinRes.body?.group?.name);

  // 5. Connect Socket A
  console.log('\n[5] Connecting User A Socket...');
  const socketA = io('http://localhost:4000', {
    auth: { token: tokenA },
    transports: ['websocket'],
  });

  await new Promise((resolve) => socketA.on('connect', resolve));
  console.log('User A socket connected:', socketA.id);

  // 6. Connect Socket B
  console.log('\n[6] Connecting User B Socket...');
  const socketB = io('http://localhost:4000', {
    auth: { token: tokenB },
    transports: ['websocket'],
  });

  await new Promise((resolve) => socketB.on('connect', resolve));
  console.log('User B socket connected:', socketB.id);

  // 7. Verify both users join group room
  console.log('\n[7] Emitting group:join for both sockets...');
  const joinRoomA = await new Promise((res) => {
    socketA.emit('group:join', { groupId: group.id }, (reply) => res(reply));
  });
  console.log('Socket A group:join ack:', joinRoomA);

  const joinRoomB = await new Promise((res) => {
    socketB.emit('group:join', { groupId: group.id }, (reply) => res(reply));
  });
  console.log('Socket B group:join ack:', joinRoomB);

  // 8. Set up listeners on User B for call events
  let receivedIncomingCall = null;
  socketB.on('call:incoming', (data) => {
    console.log('🔔 [USER B RECEIVED EVENT: call:incoming]:', data);
    receivedIncomingCall = data;
  });

  // 9. User A emits call:initiate
  console.log('\n[9] User A emitting call:initiate...');
  const initiateAck = await new Promise((res) => {
    socketA.emit('call:initiate', { groupId: group.id, callType: 'video' }, (reply) => res(reply));
  });
  console.log('User A call:initiate ack:', initiateAck);

  // Wait 1 second to see if User B received the event
  await new Promise((r) => setTimeout(r, 1000));

  console.log('\n[10] Verification of call:incoming on User B:');
  if (receivedIncomingCall) {
    console.log('✅ User B received call:incoming successfully!');
  } else {
    console.log('❌ User B DID NOT receive call:incoming!');
  }

  socketA.disconnect();
  socketB.disconnect();
  console.log('\n=== TEST COMPLETE ===');
}

runTest().catch(console.error);
