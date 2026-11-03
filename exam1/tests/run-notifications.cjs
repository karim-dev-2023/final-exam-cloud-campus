const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'docs/corrections-e27-e28/notifications/after');
fs.mkdirSync(out, { recursive: true });
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'e27-notification-run-'));
// Do not pass through real application secrets or load the workspace .env.
const env = { NODE_ENV: 'test', BABEL_ENV: 'test', CI: 'true', DEBUG: '',
  EMAIL_USER: 'sender@example.invalid', EMAIL_APPLICATION_PASSWORD: 'synthetic-unused-password',
  JWT_SECRET: 'synthetic-unused-jwt-key', MONGO_URI: 'unused',
};
for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE']) {
  if (process.env[key]) env[key] = process.env[key];
}
const results = [];
function run(name, args) {
  const r = cp.spawnSync(process.execPath, args, { cwd: temporary, env, encoding: 'utf8', timeout: 120000, maxBuffer: 8e6 });
  const output = (r.stdout || '') + (r.stderr || '');
  fs.writeFileSync(path.join(out, `${name}.log`), output);
  results.push({ name, exitCode: r.status, signal: r.signal, timedOut: r.error?.code === 'ETIMEDOUT' });
  console.log(`${name}: exit=${r.status}`);
  console.log(output.split(/\r?\n/).filter(line => /^(# (tests|suites|pass|fail|cancelled|skipped|todo|duration)|Test Suites:|Tests:|PASS |FAIL |not ok )/.test(line)).join('\n'));
}
try {
  run('notifications-api', ['--test', '--test-reporter=tap', path.join(__dirname, 'notifications.test.cjs')]);
  const packages = path.join(root, 'exam1/frontend/node_modules');
  const config = {
    rootDir: root, testMatch: ['<rootDir>/exam1/tests/ui-notifications.test.js'],
    testEnvironment: path.join(packages, 'jest-environment-jsdom'),
    transform: { '^.+\\.[jt]sx?$': [path.join(packages, 'babel-jest'), {
      presets: [[path.join(packages, 'babel-preset-react-app'), { runtime: 'automatic' }]],
    }] },
    moduleNameMapper: { '^axios$': path.join(packages, 'axios/dist/node/axios.cjs') },
  };
  run('frontend-regression', [path.join(packages, 'jest/bin/jest.js'), '--config', JSON.stringify(config), '--runInBand', '--no-cache']);
  const baseline = JSON.parse(fs.readFileSync(path.join(out, '../before/manifest.json'), 'utf8'));
  const changed = baseline.filter(entry => !fs.existsSync(path.join(root, entry.file)) ||
    crypto.createHash('sha256').update(fs.readFileSync(path.join(root, entry.file))).digest('hex') !== entry.sha256);
  const changedEvidence = changed.filter(entry => entry.file.startsWith('docs'));
  results.push({ name: 'before-evidence-integrity', exitCode: changedEvidence.length ? 1 : 0, changedFiles: changedEvidence.map(x => x.file) });
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ results, modifiedExistingApplicationFiles: changed.filter(x => !x.file.startsWith('docs')).map(x => x.file) }, null, 2));
  if (results.some(r => r.exitCode !== 0)) process.exitCode = 1;
} finally {
  fs.rmdirSync(temporary);
}
