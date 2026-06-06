#!/usr/bin/env node
/**
 * Cross-platform dev runner.
 *
 * - Installs client + server deps if they're missing.
 * - Starts the Express API on :5000 and the React dev server on :3000
 *   concurrently with colorized, prefixed output.
 * - Spawns a TUI that streams both processes' stdout and forwards Ctrl+C
 *   to both children for a clean shutdown.
 *
 * Works on macOS, Linux, and Windows (PowerShell or cmd).
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

// ---------- one-time dependency check ----------
const needClient = !exists(path.join(root, 'client', 'node_modules'));
const needServer = !exists(path.join(root, 'server', 'node_modules'));
if (needClient || needServer) {
  console.log('→ installing dependencies (first run only)…');
  const install = spawn(npmCmd, ['run', 'install:all'], {
    stdio: 'inherit',
    cwd: root,
    shell: isWin,
  });
  install.on('exit', (code) => {
    if (code !== 0) {
      console.error('npm install failed — aborting dev start.');
      process.exit(code || 1);
    }
    start();
  });
} else {
  start();
}

function start() {
  // Use `concurrently` if it's available, otherwise fall back to manual piping.
  const localConcurrently = path.join(root, 'node_modules', '.bin', isWin ? 'concurrently.cmd' : 'concurrently');
  if (exists(localConcurrently)) {
    const child = spawn(localConcurrently, [
      '--names', 'server,client',
      '--prefix-colors', 'cyan,magenta',
      '-k', 'SIGINT',
      'npm run server:dev',
      'npm run client',
    ], { stdio: 'inherit', cwd: root, shell: isWin });
    child.on('exit', (code) => process.exit(code ?? 0));
    return;
  }
  // Fallback: spawn the two processes and pipe their output with prefixes.
  pipePair();
}

function pipePair() {
  const server = spawn(npmCmd, ['run', 'server:dev'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: isWin,
  });
  const client = spawn(npmCmd, ['run', 'client'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: isWin,
  });

  const tag = (name, color) => (chunk) => {
    const text = chunk.toString();
    process.stdout.write(`\x1b[${color}m[${name}]\x1b[0m ${text}`);
  };
  server.stdout.on('data', tag('server', 36));   // cyan
  server.stderr.on('data', tag('server', 31));  // red
  client.stdout.on('data', tag('client', 35));  // magenta
  client.stderr.on('data', tag('client', 31));

  const shutdown = (sig) => { server.kill(sig); client.kill(sig); };
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  Promise.all([
    new Promise((r) => server.on('exit', r)),
    new Promise((r) => client.on('exit', r)),
  ]).then(([sc, cc]) => process.exit(sc || cc || 0));
}
