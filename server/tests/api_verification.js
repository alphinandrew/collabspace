const fs = require('fs');
const path = require('path');
const http = require('http');

// Simple fetch/request helper for Node.js
function request(options, postData = null, isMultipart = false, multipartBoundary = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (e) {
          json = body;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
        });
      });
    });

    req.on('error', reject);

    if (postData) {
      if (Buffer.isBuffer(postData)) {
        req.write(postData);
      } else if (typeof postData === 'object' && !isMultipart) {
        req.write(JSON.stringify(postData));
      } else {
        req.write(postData);
      }
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting CollabSpace Backend Verification Test Suite...\n');

  // Start server
  const { bootstrap } = require('../src/index');
  const { server } = await bootstrap();

  const port = 4000;
  const baseUrl = `http://localhost:${port}/api`;

  try {
    // Test 1: Health Check
    console.log('1. Testing GET /api/health ...');
    const healthRes = await request({
      hostname: 'localhost',
      port,
      path: '/api/health',
      method: 'GET',
    });
    if (healthRes.status !== 200 || healthRes.data.status !== 'ok') {
      throw new Error(`Health check failed with status: ${healthRes.status}`);
    }
    console.log('   ✅ Health check passed. Status: ok');

    // Test 2: WebRTC Config Endpoint
    console.log('2. Testing GET /api/config/webrtc ...');
    const webrtcRes = await request({
      hostname: 'localhost',
      port,
      path: '/api/config/webrtc',
      method: 'GET',
    });
    if (webrtcRes.status !== 200 || !webrtcRes.data.iceServers) {
      throw new Error(`WebRTC config check failed: ${webrtcRes.status}`);
    }
    console.log(`   ✅ WebRTC ICE servers verified. Configured servers: ${webrtcRes.data.iceServers.length}`);

    // Test 3: User Registration
    console.log('3. Testing User Registration (User A - Owner) ...');
    const userAEmail = `alice_${Date.now()}@example.com`;
    const regRes = await request({
      hostname: 'localhost',
      port,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      name: 'Alice Johnson',
      email: userAEmail,
      password: 'password123',
    });
    if (regRes.status !== 201 || !regRes.data.token) {
      throw new Error(`User registration failed: ${JSON.stringify(regRes.data)}`);
    }
    const tokenA = regRes.data.token;
    const userA = regRes.data.user;
    console.log(`   ✅ User A registered successfully: ${userA.name} (${userA.email})`);

    // Test 4: User Login
    console.log('4. Testing User Login ...');
    const loginRes = await request({
      hostname: 'localhost',
      port,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      email: userAEmail,
      password: 'password123',
    });
    if (loginRes.status !== 200 || !loginRes.data.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
    }
    console.log('   ✅ User A logged in successfully. Token issued.');

    // Test 5: Register User B (Member) and User C (Non-member attacker)
    console.log('5. Registering User B (Teammate) and User C (Unauthorized outsider) ...');
    const userBRes = await request({
      hostname: 'localhost',
      port,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      name: 'Bob Miller',
      email: `bob_${Date.now()}@example.com`,
      password: 'password123',
    });
    const tokenB = userBRes.data.token;
    const userB = userBRes.data.user;

    const userCRes = await request({
      hostname: 'localhost',
      port,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      name: 'Charlie Outsider',
      email: `charlie_${Date.now()}@example.com`,
      password: 'password123',
    });
    const tokenC = userCRes.data.token;
    const userC = userCRes.data.user;
    console.log('   ✅ User B and User C accounts created.');

    // Test 6: Create Group with unique code and QR invitation
    console.log('6. Creating Group as User A ...');
    const groupRes = await request({
      hostname: 'localhost',
      port,
      path: '/api/groups',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`,
      },
    }, {
      name: 'Engineering Alpha',
      description: 'Core product engineering and architecture discussions.',
    });
    if (groupRes.status !== 201 || !groupRes.data.group.join_code) {
      throw new Error(`Create group failed: ${JSON.stringify(groupRes.data)}`);
    }
    const group = groupRes.data.group;
    const invitation = groupRes.data.invitation;
    console.log(`   ✅ Group created: "${group.name}" with Code: ${group.join_code}`);
    console.log(`   ✅ Secure QR invitation token generated: ${invitation.token.slice(0, 10)}... (QR Data URL length: ${invitation.qrDataUrl.length})`);

    // Test 7: Join Group using Group Code (User B)
    console.log('7. Testing Join Group by Code (User B) ...');
    const joinCodeRes = await request({
      hostname: 'localhost',
      port,
      path: '/api/groups/join-code',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenB}`,
      },
    }, {
      code: group.join_code,
    });
    if (joinCodeRes.status !== 200) {
      throw new Error(`Join by code failed: ${JSON.stringify(joinCodeRes.data)}`);
    }
    console.log(`   ✅ User B successfully joined "${group.name}" using code ${group.join_code}`);

    // Test 8: Prevent Duplicate Membership
    console.log('8. Testing Duplicate Join Prevention ...');
    const dupJoinRes = await request({
      hostname: 'localhost',
      port,
      path: '/api/groups/join-code',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenB}`,
      },
    }, {
      code: group.join_code,
    });
    if (dupJoinRes.status !== 400) {
      throw new Error(`Expected 400 for duplicate join, got: ${dupJoinRes.status}`);
    }
    console.log('   ✅ Duplicate join correctly rejected with 400 Bad Request.');

    // Test 9: Real-time Message Sending & Database Persistence
    console.log('9. Testing Message Sending and Persistence in SQLite ...');
    const msgRes = await request({
      hostname: 'localhost',
      port,
      path: `/api/groups/${group.id}/messages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`,
      },
    }, {
      content: 'Welcome team to CollabSpace! Ready for sprint planning.',
    });
    if (msgRes.status !== 201 || !msgRes.data.message.id) {
      throw new Error(`Send message failed: ${JSON.stringify(msgRes.data)}`);
    }
    const messageId = msgRes.data.message.id;
    console.log(`   ✅ Message created: "${msgRes.data.message.content}"`);

    // Query messages to confirm persistence
    const listMsgRes = await request({
      hostname: 'localhost',
      port,
      path: `/api/groups/${group.id}/messages`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenB}`,
      },
    });
    if (listMsgRes.status !== 200 || !listMsgRes.data.messages.some(m => m.id === messageId)) {
      throw new Error('Message not found in database retrieval.');
    }
    console.log(`   ✅ Message persistence confirmed in SQLite (Total messages in group: ${listMsgRes.data.messages.length})`);

    // Test 10: Multipart File Upload
    console.log('10. Testing Real Multipart File Upload ...');
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
    const fileContent = 'CollabSpace Architecture Specification v1.0\nAll persistence is real and server-backed.';
    const filename = 'architecture_spec.txt';

    const multipartPayload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: text/plain\r\n\r\n`),
      Buffer.from(fileContent),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploadRes = await request({
      hostname: 'localhost',
      port,
      path: `/api/groups/${group.id}/files`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': multipartPayload.length,
        'Authorization': `Bearer ${tokenA}`,
      },
    }, multipartPayload);

    if (uploadRes.status !== 201 || !uploadRes.data.file) {
      throw new Error(`File upload failed: ${JSON.stringify(uploadRes.data)}`);
    }
    const uploadedFile = uploadRes.data.file;
    console.log(`   ✅ File uploaded: "${uploadedFile.filename}" (${uploadedFile.size} bytes, Key: ${uploadedFile.storage_key})`);

    // Test 11: File Library Listing
    console.log('11. Testing File Library Retrieval & Search ...');
    const filesListRes = await request({
      hostname: 'localhost',
      port,
      path: `/api/groups/${group.id}/files?search=architecture`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenB}`,
      },
    });
    if (filesListRes.status !== 200 || filesListRes.data.files.length === 0) {
      throw new Error('File search/list failed in File Library.');
    }
    console.log(`   ✅ File Library returned ${filesListRes.data.files.length} matching file(s) for User B.`);

    // Test 12: Authenticated File Download (Authorized Member)
    console.log('12. Testing Authenticated File Download (User B - Member) ...');
    const downloadRes = await request({
      hostname: 'localhost',
      port,
      path: `/api/groups/${group.id}/files/${uploadedFile.id}/download`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenB}`,
      },
    });
    if (downloadRes.status !== 200 || !downloadRes.data.includes('CollabSpace Architecture Specification')) {
      throw new Error(`Download failed or data corrupted: status ${downloadRes.status}`);
    }
    console.log('   ✅ File content downloaded successfully by authorized member.');

    // Test 13: STRICT Server-Side Authorization Check (Unauthorized Outsider - User C)
    console.log('13. Testing Security Protection: Unauthorized File Access (User C) ...');
    const unauthDownloadRes = await request({
      hostname: 'localhost',
      port,
      path: `/api/groups/${group.id}/files/${uploadedFile.id}/download`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenC}`,
      },
    });
    if (unauthDownloadRes.status !== 403) {
      throw new Error(`Security breach! Expected 403 Forbidden for non-member, got: ${unauthDownloadRes.status}`);
    }
    console.log('   🔒 Access denied with 403 Forbidden to non-member as required by security policy.');

    // Test 14: SQL-Backed Search Query
    console.log('14. Testing Backend Search API ...');
    const searchRes = await request({
      hostname: 'localhost',
      port,
      path: `/api/groups/${group.id}/search?q=sprint`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenB}`,
      },
    });
    if (searchRes.status !== 200 || searchRes.data.messages.length === 0) {
      throw new Error('Search query returned 0 messages.');
    }
    console.log(`   ✅ SQL Search query returned ${searchRes.data.messages.length} matching message(s).`);

    console.log('\n🎉 ALL 14 BACKEND INTEGRATION TESTS PASSED OBJECTIVELY WITH ZERO FAILURES.\n');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
