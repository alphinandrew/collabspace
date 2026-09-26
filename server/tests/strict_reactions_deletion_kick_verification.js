const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { io } = require('../../client/node_modules/socket.io-client');
const routes = require('../src/routes');
const { getDatabase } = require('../src/db/database');
const { initSocketIO } = require('../src/realtime/socketHandler');

const PORT = 4006;
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
  console.log(' STRICT VERIFICATION: REACTIONS, GROUP DELETION, & KICK MEMBER');
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

  // 1. Initialize Server & DB
  const app = express();
  const server = http.createServer(app);
  await getDatabase();

  app.use(cors({ origin: '*', credentials: true }));
  app.use(express.json());
  app.use('/api', routes);

  const ioServer = new Server(server, {
    cors: { origin: '*' },
  });
  app.set('io', ioServer);
  initSocketIO(ioServer);

  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[TEST-INIT] Test server running on port ${PORT}\n`);

  try {
    const timestamp = Date.now();

    // Setup 4 test accounts: Owner (Alice), Admin (Bob), Member1 (Charlie), Member2 (David)
    console.log('--- 1. Authenticating 4 Test Accounts ---');
    const uAlice = (await apiRequest('/auth/register', 'POST', {
      name: 'Alice (Owner)',
      email: `alice_${timestamp}@example.com`,
      password: 'Password123!',
    })).body;
    const uBob = (await apiRequest('/auth/register', 'POST', {
      name: 'Bob (Admin)',
      email: `bob_${timestamp}@example.com`,
      password: 'Password123!',
    })).body;
    const uCharlie = (await apiRequest('/auth/register', 'POST', {
      name: 'Charlie (Member1)',
      email: `charlie_${timestamp}@example.com`,
      password: 'Password123!',
    })).body;
    const uDavid = (await apiRequest('/auth/register', 'POST', {
      name: 'David (Member2)',
      email: `david_${timestamp}@example.com`,
      password: 'Password123!',
    })).body;

    assert(uAlice.token && uBob.token && uCharlie.token && uDavid.token, 'All 4 accounts registered with JWT tokens');

    // Create Group Omega
    console.log('\n--- 2. Setting Up Workspace: Group Omega ---');
    const gOmegaRes = await apiRequest('/groups', 'POST', {
      name: 'Omega Team',
      description: 'Group for strict testing of reactions, deletion, and kicking',
    }, uAlice.token);
    const groupOmega = gOmegaRes.body.group;
    assert(groupOmega && groupOmega.id, 'Group Omega created successfully with join code: ' + groupOmega.join_code);

    // Bob, Charlie, and David join Group Omega
    await apiRequest('/groups/join-code', 'POST', { code: groupOmega.join_code }, uBob.token);
    await apiRequest('/groups/join-code', 'POST', { code: groupOmega.join_code }, uCharlie.token);
    await apiRequest('/groups/join-code', 'POST', { code: groupOmega.join_code }, uDavid.token);

    // Promote Bob to Admin
    await apiRequest(`/groups/${groupOmega.id}/members/${uBob.user.id}/role`, 'PUT', { role: 'admin' }, uAlice.token);

    const membersRes = await apiRequest(`/groups/${groupOmega.id}/members`, 'GET', null, uAlice.token);
    assert(membersRes.body.members.length === 4, 'Group Omega has exactly 4 members: Alice(Owner), Bob(Admin), Charlie(Member), David(Member)');

    // Connect Sockets
    const sAlice = await connectSocket(uAlice.token);
    const sBob = await connectSocket(uBob.token);
    const sCharlie = await connectSocket(uCharlie.token);
    const sDavid = await connectSocket(uDavid.token);

    sAlice.emit('group:join', { groupId: groupOmega.id });
    sBob.emit('group:join', { groupId: groupOmega.id });
    sCharlie.emit('group:join', { groupId: groupOmega.id });
    sDavid.emit('group:join', { groupId: groupOmega.id });
    await wait(200);

    // -------------------------------------------------------------
    // FEATURE 1: MESSAGE REACTIONS THROUGH RIGHT-CLICK & DATA INTEGRITY
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Feature 1: Message Reactions & Unique Reaction Per User ---');
    // Alice sends a message
    const msg1Res = await apiRequest(`/groups/${groupOmega.id}/messages`, 'POST', {
      content: 'Hello Omega Team! Please react to this message.',
      messageType: 'text',
    }, uAlice.token);
    const msg1 = msg1Res.body.message;
    assert(msg1 && msg1.id, 'Alice posted a test message for reactions');

    // Socket listener for Bob
    let bobReceivedReaction = null;
    sBob.on('chat:reaction', (data) => {
      bobReceivedReaction = data;
    });

    // Test 1.1: Bob reacts with 👍
    const r1 = await apiRequest(`/groups/${groupOmega.id}/messages/${msg1.id}/reactions`, 'POST', {
      emoji: '👍',
    }, uBob.token);
    assert(r1.body.action === 'added' && r1.body.reactions[0].emoji === '👍' && r1.body.reactions[0].count === 1,
      'Bob reacted with 👍 (action: added, count: 1)');

    await wait(100);
    assert(bobReceivedReaction && bobReceivedReaction.emoji === '👍' && bobReceivedReaction.action === 'added',
      'Bob received real-time chat:reaction broadcast');

    // Test 1.2: Bob changes his reaction to ❤️ (should UPDATE, NOT create duplicate!)
    const r2 = await apiRequest(`/groups/${groupOmega.id}/messages/${msg1.id}/reactions`, 'POST', {
      emoji: '❤️',
    }, uBob.token);
    assert(r2.body.action === 'updated', 'Bob changing from 👍 to ❤️ returned action: updated');
    const hasThumbsUp = r2.body.reactions.some(r => r.emoji === '👍');
    const heartRxn = r2.body.reactions.find(r => r.emoji === '❤️');
    assert(!hasThumbsUp && heartRxn && heartRxn.count === 1,
      'Unique reaction enforced: 👍 removed, ❤️ count is 1 (no duplicate reactions for same user)');

    // Test 1.3: Charlie also reacts with ❤️ (multi-user reactions)
    const r3 = await apiRequest(`/groups/${groupOmega.id}/messages/${msg1.id}/reactions`, 'POST', {
      emoji: '❤️',
    }, uCharlie.token);
    const multiHeart = r3.body.reactions.find(r => r.emoji === '❤️');
    assert(multiHeart && multiHeart.count === 2 && multiHeart.userIds.includes(uBob.user.id) && multiHeart.userIds.includes(uCharlie.user.id),
      'Charlie reacted with ❤️: total ❤️ count is 2 (Bob and Charlie)');

    // Test 1.4: Bob clicks ❤️ again -> should TOGGLE OFF (remove)
    const r4 = await apiRequest(`/groups/${groupOmega.id}/messages/${msg1.id}/reactions`, 'POST', {
      emoji: '❤️',
    }, uBob.token);
    assert(r4.body.action === 'removed', 'Bob clicked same emoji ❤️ again -> returned action: removed');
    const remainingHeart = r4.body.reactions.find(r => r.emoji === '❤️');
    assert(remainingHeart && remainingHeart.count === 1,
      '❤️ count decremented to 1 (only Charlie remains)');

    // Test 1.5: Persistence across page refresh (DB query check)
    const getMsgsRes = await apiRequest(`/groups/${groupOmega.id}/messages`, 'GET', null, uDavid.token);
    const fetchedMsg1 = getMsgsRes.body.messages.find(m => m.id === msg1.id);
    assert(fetchedMsg1 && fetchedMsg1.reactions && fetchedMsg1.reactions.length === 1 && fetchedMsg1.reactions[0].emoji === '❤️',
      'Reactions correctly persisted in database and retrieved on message load');

    // -------------------------------------------------------------
    // FEATURE 3: KICK-MEMBER FUNCTIONALITY & PERMISSIONS
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Feature 3: Kick-Member Functionality & Permission Rules ---');

    // Test 3.1: Ordinary member (Charlie) attempts to kick David -> MUST BE REJECTED 403
    const kickByMember = await apiRequest(`/groups/${groupOmega.id}/members/${uDavid.user.id}`, 'DELETE', null, uCharlie.token);
    assert(kickByMember.status === 403, 'Ordinary member cannot kick another member (403 Forbidden)');

    // Test 3.2: Admin (Bob) attempts to kick Owner (Alice) -> MUST BE REJECTED 403
    const kickOwnerByAdmin = await apiRequest(`/groups/${groupOmega.id}/members/${uAlice.user.id}`, 'DELETE', null, uBob.token);
    assert(kickOwnerByAdmin.status === 403, 'Admin cannot kick the group owner (403 Forbidden)');

    // Test 3.3: User attempts to kick themselves -> MUST BE REJECTED 400
    const selfKick = await apiRequest(`/groups/${groupOmega.id}/members/${uAlice.user.id}`, 'DELETE', null, uAlice.token);
    assert(selfKick.status === 403 || selfKick.status === 400, 'User cannot kick themselves using admin kick action (rejected)');

    // Test 3.4: Realtime event setup for David getting kicked
    let davidReceivedKickedEvent = null;
    sDavid.on('group:member_removed', (data) => {
      davidReceivedKickedEvent = data;
    });

    // Test 3.5: Owner (Alice) kicks David
    const kickDavidRes = await apiRequest(`/groups/${groupOmega.id}/members/${uDavid.user.id}`, 'DELETE', null, uAlice.token);
    assert(kickDavidRes.status === 200, 'Owner successfully kicked David from Group Omega (status 200)');

    await wait(100);
    assert(davidReceivedKickedEvent && davidReceivedKickedEvent.isSelf === true && davidReceivedKickedEvent.groupId === groupOmega.id,
      'David received realtime group:member_removed socket event');

    // Test 3.6: Verify David is gone from members list and database
    const postKickMembers = await apiRequest(`/groups/${groupOmega.id}/members`, 'GET', null, uAlice.token);
    const isDavidInGroup = postKickMembers.body.members.some(m => m.id === uDavid.user.id);
    assert(!isDavidInGroup, 'David was removed from group members list in the database');

    // Test 3.7: David attempts to send message to group -> MUST BE REJECTED 403
    const davidPostKickMsg = await apiRequest(`/groups/${groupOmega.id}/messages`, 'POST', {
      content: 'Can I still talk here?',
    }, uDavid.token);
    assert(davidPostKickMsg.status === 403, 'Kicked user cannot send messages to the group (403 Forbidden)');

    // Test 3.8: David attempts to react to a message in the group -> MUST BE REJECTED 403
    const davidPostKickRxn = await apiRequest(`/groups/${groupOmega.id}/messages/${msg1.id}/reactions`, 'POST', {
      emoji: '👍',
    }, uDavid.token);
    assert(davidPostKickRxn.status === 403, 'Kicked user cannot react to messages in the group (403 Forbidden)');

    // -------------------------------------------------------------
    // FEATURE 2: GROUP DELETION WITH CONFIRMATION
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Feature 2: Group Deletion With Simple Confirmation ---');

    // Test 2.1: Ordinary member (Charlie) attempts to delete group -> MUST BE REJECTED 403
    const deleteByMember = await apiRequest(`/groups/${groupOmega.id}`, 'DELETE', null, uCharlie.token);
    assert(deleteByMember.status === 403, 'Ordinary member cannot delete group (403 Forbidden)');

    // Test 2.2: Setup socket listener for group deletion
    let charlieReceivedDeleteEvent = null;
    sCharlie.on('group:deleted', (data) => {
      charlieReceivedDeleteEvent = data;
    });

    // Test 2.3: Owner (Alice) deletes Group Omega (Simple confirmation, no name required)
    const deleteRes = await apiRequest(`/groups/${groupOmega.id}`, 'DELETE', {}, uAlice.token);
    assert(deleteRes.status === 200, 'Owner deleted group successfully without requiring typed confirmation (status 200)');

    await wait(100);
    assert(charlieReceivedDeleteEvent && charlieReceivedDeleteEvent.groupId === groupOmega.id,
      'Group members received realtime group:deleted broadcast');

    // Test 2.4: Group no longer appears in user groups list
    const aliceGroupsRes = await apiRequest('/groups', 'GET', null, uAlice.token);
    const isGroupOmegaActive = aliceGroupsRes.body.groups.some(g => g.id === groupOmega.id);
    assert(!isGroupOmegaActive, 'Deleted group is marked is_deleted=1 and no longer returned in getMyGroups');

    // -------------------------------------------------------------
    // REGRESSION TESTS
    // -------------------------------------------------------------
    console.log('\n--- 6. Regression Testing ---');

    // Create a new fresh group
    const freshGroupRes = await apiRequest('/groups', 'POST', {
      name: 'Fresh Alpha',
    }, uAlice.token);
    const freshGroup = freshGroupRes.body.group;
    assert(freshGroup && freshGroup.id, 'Fresh group created cleanly for regression check');

    // Text messaging regression
    const textMsgRes = await apiRequest(`/groups/${freshGroup.id}/messages`, 'POST', {
      content: 'Normal regression message test',
      messageType: 'text',
    }, uAlice.token);
    assert(textMsgRes.status === 201 && textMsgRes.body.message.content === 'Normal regression message test',
      'Normal text messaging working properly');

    // Emoji-only messaging regression (chat input emoji)
    const emojiMsgRes = await apiRequest(`/groups/${freshGroup.id}/messages`, 'POST', {
      content: '🎉🚀✨',
      messageType: 'text',
    }, uAlice.token);
    assert(emojiMsgRes.status === 201 && emojiMsgRes.body.message.content === '🎉🚀✨',
      'Emoji chat messages working properly without interference from reactions');

    // Cleanup sockets and server
    sAlice.disconnect();
    sBob.disconnect();
    sCharlie.disconnect();
    sDavid.disconnect();

  } catch (err) {
    console.error('Unexpected test error:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`RESULT: ${failed === 0 ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
