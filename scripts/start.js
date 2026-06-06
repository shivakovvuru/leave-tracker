#!/usr/bin/env node
/**
 * Production entry point. Just starts the Express server.
 * The server itself serves the prebuilt React bundle from client/build/
 * (see server/server.js → "Serve client build").
 */
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { spawn } = require('child_process');
const path = require('path');

const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}
