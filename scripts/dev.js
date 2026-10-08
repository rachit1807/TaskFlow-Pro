import { spawn } from 'node:child_process';

const processes = [
  spawn(process.execPath, ['src/server.js'], { cwd: 'apps/api', stdio: 'inherit' }),
  spawn(process.execPath, ['../../node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], { cwd: 'apps/web', stdio: 'inherit' }),
];

function stopAll(signal = 'SIGTERM') {
  for (const child of processes) if (!child.killed) child.kill(signal);
}

process.on('SIGINT', () => stopAll('SIGINT'));
process.on('SIGTERM', () => stopAll('SIGTERM'));
for (const child of processes) child.on('error', (error) => console.error('Could not start a TaskFlow development service:', error.message));
