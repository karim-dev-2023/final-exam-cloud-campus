const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const phase = process.argv[2] || 'before';
if (!['before', 'after', 'update'].includes(phase)) throw new Error('Invalid phase');
const directories = ['.', 'backend', 'frontend', 'gateway', 'microservices/auth-gateway', 'microservices/notifications', 'microservices/stock-management'];
const out = path.join(root, 'docs/audit-complementaire/run-2026-11-03', phase === 'update' ? 'after' : phase);
fs.mkdirSync(out, { recursive: true });
function execute(directory, command) {
  return new Promise(resolve => cp.execFile('C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', command], {
    cwd: path.join(root, 'exam1', directory), timeout: 300000, maxBuffer: 15e6,
  }, (error, stdout, stderr) => resolve({ exit: error?.code || 0, stdout, stderr })));
}
(async () => {
  if (phase === 'update') {
    for (const directory of directories) {
      const result = await execute(directory, 'npm.cmd update --ignore-scripts --no-audit --no-fund');
      fs.writeFileSync(path.join(out, `update-${directory.replaceAll('/', '-').replace('.', 'root')}.log`), result.stdout + result.stderr);
      console.log(JSON.stringify({ directory, exit: result.exit }));
      if (result.exit !== 0) process.exitCode = 1;
    }
    return;
  }
  await Promise.all(directories.map(async directory => {
    const result = await execute(directory, 'npm.cmd audit --json --ignore-scripts');
    const name = directory.replaceAll('/', '-').replace('.', 'root');
    try {
      const audit = JSON.parse(result.stdout);
      fs.writeFileSync(path.join(out, `npm-${name}.json`), JSON.stringify(audit, null, 2));
      console.log(JSON.stringify({ directory, exit: result.exit, counts: audit.metadata?.vulnerabilities, registryError: Boolean(audit.error) }));
      if (audit.error) process.exitCode = 1;
    } catch { console.log(JSON.stringify({ directory, error: 'Audit unavailable' })); process.exitCode = 1; }
  }));
})().catch(() => { console.error('Dependency operation failed'); process.exitCode = 1; });
