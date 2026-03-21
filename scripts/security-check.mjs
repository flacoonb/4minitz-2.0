import { execSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const failures = [];
const projectRoot = process.cwd();

function addFailure(message) {
  failures.push(message);
}

async function readText(relativePath) {
  const fullPath = path.join(projectRoot, relativePath);
  try {
    return await readFile(fullPath, 'utf8');
  } catch {
    addFailure(`Missing required file: ${relativePath}`);
    return '';
  }
}

function mustContain(content, expected, message) {
  if (!content.includes(expected)) {
    addFailure(message);
  }
}

function mustNotContain(content, blocked, message) {
  if (content.includes(blocked)) {
    addFailure(message);
  }
}

function listFilesViaRipgrep() {
  try {
    const output = execSync('rg --files --hidden -g "!.git"', {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function collectCodeFiles(relativeDir, out) {
  const fullDir = path.join(projectRoot, relativeDir);
  let entries = [];

  try {
    entries = await readdir(fullDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);

    if (entry.isDirectory()) {
      await collectCodeFiles(relativePath, out);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(relativePath);
    }
  }
}

async function checkGlobalErrorGuards() {
  const file = 'app/global-error.tsx';
  const content = await readText(file);
  if (!content) return;

  mustNotContain(
    content,
    'ingest-client-error',
    `${file}: debug endpoint usage detected (ingest-client-error)`
  );
  mustNotContain(
    content,
    'http://localhost:3000',
    `${file}: hardcoded localhost URL detected`
  );
}

async function checkCryptoGuards() {
  const file = 'lib/crypto.ts';
  const content = await readText(file);
  if (!content) return;

  mustContain(content, "const ALGORITHM = 'aes-256-gcm'", `${file}: missing AES-GCM primary algorithm`);
  mustContain(content, "const CURRENT_VERSION = 'v2'", `${file}: missing v2 encryption version marker`);
  mustContain(content, 'cipher.getAuthTag()', `${file}: missing authentication tag handling`);
}

async function checkRateLimitGuards() {
  const file = 'lib/rate-limit.ts';
  const content = await readText(file);
  if (!content) return;

  mustContain(content, 'TRUST_PROXY_HEADERS', `${file}: missing TRUST_PROXY_HEADERS gate`);
  mustContain(content, 'getAnonymousFingerprint', `${file}: missing anonymous fallback fingerprint`);
}

async function checkUsersRouteGuards() {
  const file = 'app/api/users/route.ts';
  const content = await readText(file);
  if (!content) return;

  mustContain(content, "hasPermission(authResult.user!, 'canCreateMeetings')", `${file}: missing canCreateMeetings permission check`);
  mustContain(content, 'filter._id = authResult.user!._id;', `${file}: missing self-only fallback filter`);
}

async function checkCspGuards() {
  const proxyFile = 'proxy.ts';
  const proxyContent = await readText(proxyFile);
  if (proxyContent) {
    mustContain(proxyContent, 'Content-Security-Policy', `${proxyFile}: missing CSP header`);
    mustContain(proxyContent, 'x-nonce', `${proxyFile}: missing x-nonce forwarding`);
    mustContain(proxyContent, 'verifyJwtHs256Edge', `${proxyFile}: missing Edge JWT gate for protected paths`);
  }

  const cspFile = 'lib/csp-build.ts';
  const cspContent = await readText(cspFile);
  if (cspContent) {
    mustContain(cspContent, "'strict-dynamic'", `${cspFile}: missing strict-dynamic (nonce CSP)`);
  }

  const nextFile = 'next.config.ts';
  const nextContent = await readText(nextFile);
  if (nextContent) {
    // HTML CSP = proxy.ts only. Static CSP for robots/sitemap is allowed (ZAP / SEO files).
    mustContain(
      nextContent,
      'STATIC_TEXT_CSP',
      `${nextFile}: missing STATIC_TEXT_CSP for robots.txt / sitemap.xml`
    );
  }
}

async function checkAbsoluteLocalhostFetches() {
  const files = [];
  await collectCodeFiles('app', files);
  await collectCodeFiles('components', files);

  const localFetchPattern = /fetch\(\s*['"`]https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?\//;

  for (const file of files) {
    const content = await readText(file);
    if (!content) continue;

    if (localFetchPattern.test(content)) {
      addFailure(`${file}: hardcoded absolute localhost fetch detected`);
    }
  }
}

function checkTrackedSensitiveFiles() {
  let trackedFiles = [];
  try {
    const output = execSync('git ls-files', {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    trackedFiles = output.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch {
    // Some environments cannot run git commands (e.g. safe.directory restrictions).
    // Fallback to ripgrep file listing so the security check remains usable.
    trackedFiles = listFilesViaRipgrep();
    if (trackedFiles.length === 0) {
      addFailure('Could not list project files via git ls-files or rg --files');
      return;
    }
  }

  const sensitiveMatches = [];

  for (const file of trackedFiles) {
    if (file === '.env.example') {
      continue;
    }

    if (/(^|\/)\.env(\..+)?$/i.test(file)) {
      sensitiveMatches.push(file);
      continue;
    }

    if (/\.(pem|key|p12|pfx)$/i.test(file)) {
      sensitiveMatches.push(file);
    }
  }

  if (sensitiveMatches.length > 0) {
    addFailure(`Potentially sensitive files are tracked: ${sensitiveMatches.join(', ')}`);
  }
}

async function run() {
  await checkGlobalErrorGuards();
  await checkCryptoGuards();
  await checkRateLimitGuards();
  await checkUsersRouteGuards();
  await checkCspGuards();
  await checkAbsoluteLocalhostFetches();
  checkTrackedSensitiveFiles();

  if (failures.length > 0) {
    console.error('Security checks failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Security checks passed.');
}

run().catch((error) => {
  console.error('Security check execution failed:', error);
  process.exit(1);
});
