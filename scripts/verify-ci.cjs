// Same verification on Windows and Linux, without loading real service .env files.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-ci-'));
const frontend = path.join(root, 'exam1/frontend');
const packages = path.join(frontend, 'node_modules');
const env = {
  NODE_ENV: 'test', BABEL_ENV: 'test', CI: 'true', DEBUG: '',
  MONGO_URI: 'unused', EMAIL_USER: 'sender@example.invalid',
  EMAIL_APPLICATION_PASSWORD: 'synthetic-unused-password',
  JWT_SECRET: 'synthetic-unused-key', ORDER_NOTIFICATION_EMAIL: 'orders@example.invalid',
  REACT_APP_API_URL: 'https://cloud-campus-backend-rd4h.onrender.com',
};
for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'HOME']) {
  if (process.env[key]) env[key] = process.env[key];
}
function run(name, args, options = {}) {
  console.log(`\nVerification: ${name}`);
  const result = spawnSync(process.execPath, args, {
    cwd: temporary, env, stdio: 'inherit', timeout: 180000, ...options,
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exitCode = 1;
}
try {
  for (const file of ['order-notification-email.test.cjs', 'notifications.test.cjs',
    'final-business-current.test.cjs', 'complementary.test.cjs', 'observability.test.cjs']) {
    // Same notification selection as the existing run-complementary.cjs:
    // its old backend scenario expects stock not to be reserved after checkout.
    // Current checkout behavior is covered by final-business-current instead.
    const selection = file === 'notifications.test.cjs'
      ? ['--test-name-pattern=^(P0-01:|P0-02:|P1-03:|Notifications:|Gateway:)'] : [];
    run(file, ['--test', ...selection, path.join(root, 'exam1/tests', file)]);
  }
  const config = {
    rootDir: root,
    testMatch: ['<rootDir>/exam1/tests/ui-notifications.test.js', '<rootDir>/exam1/tests/ui-final-e27-e28.test.js'],
    testEnvironment: path.join(packages, 'jest-environment-jsdom'),
    transform: { '^.+\\.[jt]sx?$': [path.join(packages, 'babel-jest'), {
      presets: [[path.join(packages, 'babel-preset-react-app'), { runtime: 'automatic' }]],
    }] },
    moduleNameMapper: { '^axios$': path.join(packages, 'axios/dist/node/axios.cjs') },
  };
  // Historical UI regressions explicitly assert the development localhost URL.
  run('React regressions', [path.join(packages, 'jest/bin/jest.js'), '--config', JSON.stringify(config), '--runInBand', '--silent'], {
    env: { ...env, REACT_APP_API_URL: 'http://localhost:5000' },
  });
  run('Frontend tests', [path.join(packages, 'react-scripts/scripts/test.js'), '--watchAll=false', '--runInBand', '--silent'], { cwd: frontend });
  // Keep the existing deployable build intact. No artifact is uploaded or deployed.
  run('Frontend build', [path.join(packages, 'react-scripts/scripts/build.js')], {
    cwd: frontend, env: { ...env, NODE_ENV: 'production', BABEL_ENV: 'production', BUILD_PATH: path.join(temporary, 'build') },
  });
} finally {
  // This directory was created above, contains only this verification's output.
  fs.rmSync(temporary, { recursive: true, force: true });
}
