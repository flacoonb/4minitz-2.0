import process from 'node:process';

const baseUrl = String(
  process.env.SECURITY_TEST_BASE_URL || process.env.APP_URL || 'http://localhost:3000'
).replace(/\/+$/, '');

const failures = [];
const infos = [];

function logInfo(message) {
  infos.push(message);
  console.log(`INFO: ${message}`);
}

function fail(message) {
  failures.push(message);
  console.error(`FAIL: ${message}`);
}

async function request(path, init = {}) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    redirect: 'manual',
    ...init,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { url, response, text, json };
}

function expectStatus(actual, allowed, context) {
  if (!allowed.includes(actual)) {
    fail(`${context}: expected status ${allowed.join(' or ')}, got ${actual}`);
    return false;
  }
  return true;
}

async function testUnauthorizedRead(path) {
  const { response } = await request(path);
  expectStatus(response.status, [401], `Unauthorized access check ${path}`);
}

async function testCsrfBlockedByMismatchedOrigin() {
  const payload = {
    email: `security-test-${Date.now()}@example.invalid`,
    password: 'invalid-password',
  };
  const { response, json, text } = await request('/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://attacker.example',
    },
    body: JSON.stringify(payload),
  });

  if (!expectStatus(response.status, [403], 'CSRF mismatch origin')) return;

  const errorMessage = String(json?.error || text || '');
  if (!/csrf|origin/i.test(errorMessage)) {
    fail(`CSRF mismatch origin: expected CSRF/origin error text, got "${errorMessage}"`);
  }
}

async function testCsrfBlockedByInvalidOrigin() {
  const payload = {
    email: `security-test-${Date.now()}@example.invalid`,
    password: 'invalid-password',
  };
  const { response } = await request('/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'not-a-url',
    },
    body: JSON.stringify(payload),
  });
  expectStatus(response.status, [403], 'CSRF invalid origin format');
}

async function testRsvpRedirectTarget() {
  const { response } = await request('/api/meeting-events/rsvp?token=test-token&response=accepted', {
    method: 'GET',
    headers: {
      accept: 'text/html',
    },
  });

  if (!expectStatus(response.status, [307, 302], 'RSVP link redirect')) return;

  const location = String(response.headers.get('location') || '');
  if (!location.startsWith(`${baseUrl}/rsvp`)) {
    fail(`RSVP link redirect: expected target under ${baseUrl}/rsvp, got "${location}"`);
  } else {
    logInfo(`RSVP redirect target looks correct: ${location}`);
  }
}

async function testProtectedPageRedirectsToLogin() {
  const paths = ['/admin', '/dashboard', '/profile'];
  for (const path of paths) {
    const { response } = await request(path);
    if (!expectStatus(response.status, [302, 307, 308], `Protected page ${path} without session`)) {
      continue;
    }
    const location = String(response.headers.get('location') || '');
    if (!/\/auth\/login/i.test(location)) {
      fail(
        `Protected page ${path}: expected redirect to /auth/login, got Location "${location}"`
      );
    } else {
      logInfo(`Protected page redirect OK: ${path} -> ${location}`);
    }
  }
}

async function testLoginRateLimit() {
  const email = `rate-limit-${Date.now()}@example.invalid`;
  const payload = { email, password: 'wrong-password' };
  const origin = new URL(baseUrl).origin;
  const statuses = [];

  for (let i = 0; i < 8; i += 1) {
    const { response } = await request('/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin,
      },
      body: JSON.stringify(payload),
    });
    statuses.push(response.status);
  }

  const has429 = statuses.includes(429);
  if (!has429) {
    fail(`Login rate-limit: expected at least one 429 within 8 attempts, got [${statuses.join(', ')}]`);
  } else {
    logInfo(`Login rate-limit triggered as expected: [${statuses.join(', ')}]`);
  }
}

async function run() {
  console.log(`Running security smoke tests against: ${baseUrl}`);

  await testUnauthorizedRead('/api/dashboard');
  await testUnauthorizedRead('/api/admin/settings');
  await testCsrfBlockedByMismatchedOrigin();
  await testCsrfBlockedByInvalidOrigin();
  await testRsvpRedirectTarget();
  await testProtectedPageRedirectsToLogin();
  await testLoginRateLimit();

  if (failures.length > 0) {
    console.error('\nSecurity smoke tests failed:');
    failures.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
  }

  console.log('\nSecurity smoke tests passed.');
}

run().catch((error) => {
  console.error('Security smoke tests crashed:', error);
  process.exit(1);
});
