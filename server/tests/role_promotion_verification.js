const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { io } = require('../../client/node_modules/socket.io-client');
const routes = require('../src/routes');
const { getDatabase } = require('../src/db/database');
const { initSocketIO } = require('../src/realtime/socketHandler');

const PORT = 4009;
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

async function runTestSuite() {
  console.log('================================================================');
  console.log(' STRICT VERIFICATION: ROLE PROMOTION (MAKE ADMIN) & PERMISSIONS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Set up test server
  const app = express();
  app.use(cors());
  app.use(express.json());
  const server = http.createServer(app);
  const ioServer = new Server(server, { cors: { origin: '*' } });
  initSocketIO(ioServer);
  app.set('io', ioServer);
  app.use('/api', routes);

  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test server running on port ${PORT}\n`);

  try {
    const timestamp = Date.now();
    // 1. Create Users
    console.log('--- Step 1: Create Users ---');
    const u1Res = await apiRequest('/auth/register', 'POST', {
      name: 'Owner User',
      email: `owner_${timestamp}@test.com`,
      password: 'password123',
    });
    assert(u1Res.status === 201, 'Owner user registered successfully');
    const u1Token = u1Res.body.token;
    const u1Id = u1Res.body.user.id;

    const u2Res = await apiRequest('/auth/register', 'POST', {
      name: 'Candidate User',
      email: `candidate_${timestamp}@test.com`,
      password: 'password123',
    });
    assert(u2Res.status === 201, 'Candidate member registered successfully');
    const u2Token = u2Res.body.token;
    const u2Id = u2Res.body.user.id;

    const u3Res = await apiRequest('/auth/register', 'POST', {
      name: 'Regular Member',
      email: `regular_${timestamp}@test.com`,
      password: 'password123',
    });
    assert(u3Res.status === 201, 'Regular member registered successfully');
    const u3Token = u3Res.body.token;
    const u3Id = u3Res.body.user.id;

    // 2. Create Group with Owner
    console.log('\n--- Step 2: Create Workspace Group ---');
    const grpRes = await apiRequest(
      '/groups',
      'POST',
      { name: `Workspace ${timestamp}`, description: 'Admin test group' },
      u1Token
    );
    assert(grpRes.status === 201, 'Workspace group created by owner');
    const groupId = grpRes.body.group.id;
    const joinCode = grpRes.body.group.join_code;

    // 3. User 2 and User 3 Join Group
    console.log('\n--- Step 3: Members Join Group ---');
    const j2 = await apiRequest('/groups/join-code', 'POST', { code: joinCode }, u2Token);
    assert(j2.status === 200, 'Candidate member joined group');

    const j3 = await apiRequest('/groups/join-code', 'POST', { code: joinCode }, u3Token);
    assert(j3.status === 200, 'Regular member joined group');

    // 4. Verify initial member roles
    const listRes = await apiRequest(`/groups/${groupId}/members`, 'GET', null, u1Token);
    assert(listRes.status === 200, 'Members listed successfully');
    const initialU2 = listRes.body.members.find((m) => m.id === u2Id);
    assert(initialU2 && initialU2.role === 'member', 'Candidate initial role is regular member');

    // 5. Connect Socket.IO and listen for realtime role update
    console.log('\n--- Step 4: Socket.IO Realtime Role Synchronization ---');
    const s1 = await connectSocket(u1Token);
    const s2 = await connectSocket(u2Token);
    s1.emit('group:join', { groupId });
    s2.emit('group:join', { groupId });
    await wait(200);

    let memberUpdatedEvent = null;
    s2.on('group:member_updated', (data) => {
      memberUpdatedEvent = data;
    });

    // 6. Owner makes User 2 an Admin
    console.log('\n--- Step 5: Owner Makes Candidate an Admin ---');
    const promoteRes = await apiRequest(
      `/groups/${groupId}/members/${u2Id}/role`,
      'PUT',
      { role: 'admin' },
      u1Token
    );
    assert(promoteRes.status === 200, 'Owner successfully updated Candidate role to admin (200 OK)');
    assert(promoteRes.body.member && promoteRes.body.member.role === 'admin', 'Response returns role: admin');

    await wait(300);
    assert(
      memberUpdatedEvent &&
        memberUpdatedEvent.groupId === groupId &&
        memberUpdatedEvent.userId === u2Id &&
        memberUpdatedEvent.role === 'admin',
      'Socket.IO group:member_updated event was broadcast in realtime'
    );

    // 7. Verify Database Persistence
    console.log('\n--- Step 6: Verify Database Persistence ---');
    const db = await getDatabase();
    const dbMember = await db.get(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, u2Id]
    );
    assert(dbMember && dbMember.role === 'admin', 'Candidate role is persisted as admin in SQLite database');

    // 8. Regular Member (User 3) cannot promote anyone
    console.log('\n--- Step 7: Authorization Guards ---');
    const unauthorizedPromote = await apiRequest(
      `/groups/${groupId}/members/${u3Id}/role`,
      'PUT',
      { role: 'admin' },
      u3Token
    );
    assert(
      unauthorizedPromote.status === 403,
      'Regular member cannot promote anyone (403 Forbidden)'
    );

    // 9. Admin cannot modify the Owner role
    const adminTouchOwner = await apiRequest(
      `/groups/${groupId}/members/${u1Id}/role`,
      'PUT',
      { role: 'member' },
      u2Token
    );
    assert(
      adminTouchOwner.status === 403,
      'Admin cannot modify group owner role (403 Forbidden)'
    );

    // 10. Admin cannot demote another Admin (only owner can)
    // First, register User 4 and promote to admin
    const u4Res = await apiRequest('/auth/register', 'POST', {
      name: 'Admin Two',
      email: `admin2_${timestamp}@test.com`,
      password: 'password123',
    });
    await apiRequest('/groups/join-code', 'POST', { code: joinCode }, u4Res.body.token);
    await apiRequest(`/groups/${groupId}/members/${u4Res.body.user.id}/role`, 'PUT', { role: 'admin' }, u1Token);

    const adminDemoteAdmin = await apiRequest(
      `/groups/${groupId}/members/${u4Res.body.user.id}/role`,
      'PUT',
      { role: 'member' },
      u2Token
    );
    assert(
      adminDemoteAdmin.status === 403,
      'Admin cannot demote another admin (403 Forbidden)'
    );

    // 11. Owner demotes Candidate back to Member
    console.log('\n--- Step 8: Owner Demotes Admin back to Member ---');
    memberUpdatedEvent = null;
    const demoteRes = await apiRequest(
      `/groups/${groupId}/members/${u2Id}/role`,
      'PUT',
      { role: 'member' },
      u1Token
    );
    assert(demoteRes.status === 200, 'Owner successfully demoted Admin back to Member (200 OK)');
    assert(demoteRes.body.member && demoteRes.body.member.role === 'member', 'Response returns role: member');

    await wait(300);
    assert(
      memberUpdatedEvent &&
        memberUpdatedEvent.groupId === groupId &&
        memberUpdatedEvent.userId === u2Id &&
        memberUpdatedEvent.role === 'member',
      'Socket.IO group:member_updated broadcast received for demotion'
    );

    const dbDemoted = await db.get(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, u2Id]
    );
    assert(dbDemoted && dbDemoted.role === 'member', 'Demoted role is persisted as member in SQLite');

    // Disconnect sockets
    s1.disconnect();
    s2.disconnect();
  } catch (err) {
    console.error('Test Suite encountered an error:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
