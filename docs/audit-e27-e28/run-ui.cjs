// CLI-only Jest setup for audit tests; does not alter application configuration.
const path = require('path');
const cp = require('child_process');
const fs = require('fs');
const root = path.resolve(__dirname, '../..');
const packages = path.join(root, 'exam1/frontend/node_modules');
const config = {
  rootDir: root,
  testMatch: ['<rootDir>/docs/audit-e27-e28/ui.test.js'],
  testEnvironment: path.join(packages, 'jest-environment-jsdom'),
  transform: {
    '^.+\\.[jt]sx?$': [path.join(packages, 'babel-jest'), {
      presets: [[path.join(packages, 'babel-preset-react-app'), { runtime: 'automatic' }]],
    }],
  },
  moduleNameMapper: { '^axios$': path.join(packages, 'axios/dist/node/axios.cjs') },
};
const result = cp.spawnSync(process.execPath, [path.join(packages, 'jest/bin/jest.js'),
  '--config', JSON.stringify(config), '--runInBand', '--no-cache'], {
  cwd: root, env: { ...process.env, NODE_ENV: 'test', BABEL_ENV: 'test', CI: 'true' },
  encoding: 'utf8', timeout: 60000,
});
const output = (result.stdout || '') + (result.stderr || '');
fs.writeFileSync(path.join(__dirname, 'jest-isolated.log'), output);
console.log(output.slice(-4500));
process.exitCode = result.status === null ? 1 : result.status;
