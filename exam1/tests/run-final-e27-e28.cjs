const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'docs/corrections-e27-e28/final/after');
fs.mkdirSync(out, { recursive: true });
// Preserve earlier runs (including failures) before refreshing the convenient latest logs.
if (fs.existsSync(path.join(out, 'summary.json'))) {
  const previous = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8'));
  const archive = path.join(out, 'runs', previous.executedAtUtc.replace(/[:.]/g, '-'));
  fs.mkdirSync(archive, { recursive: true });
  for (const name of fs.readdirSync(out)) {
    const file = path.join(out, name);
    if (fs.statSync(file).isFile() && /\.(log|json)$/.test(name)) fs.copyFileSync(file, path.join(archive, name));
  }
}
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'e27-final-run-'));
const env = { NODE_ENV: 'test', BABEL_ENV: 'test', CI: 'true', DEBUG: '', MONGO_URI: 'unused',
  EMAIL_USER: 'sender@example.invalid', EMAIL_APPLICATION_PASSWORD: 'synthetic-unused-password', JWT_SECRET: 'synthetic-unused-key' };
for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE']) if (process.env[key]) env[key] = process.env[key];
const results = [];
function run(name, args, options = {}) {
  const r = cp.spawnSync(process.execPath, args, { cwd: options.cwd || temporary, env, encoding: 'utf8', timeout: 120000, maxBuffer: 10e6 });
  const output = (r.stdout || '') + (r.stderr || '');
  fs.writeFileSync(path.join(out, `${name}.log`), output);
  const captures = output.split(/\r?\n/).filter(line =>
    /^(ok |not ok )/.test(line) && !line.includes('# SKIP') ||
    /^(# (tests|pass|fail|skipped|todo|duration)|Test Suites:|Tests:|PASS |FAIL |Compiled successfully|Compiled with warnings|ESLint:|Syntax:)/.test(line));
  fs.writeFileSync(path.join(out, `${name}-captures.log`), captures.join('\n') + '\n');
  const counts = Object.fromEntries(['tests', 'pass', 'fail', 'skipped', 'todo'].map(key => [key, Number(new RegExp(`^# ${key} (\\d+)$`, 'm').exec(output)?.[1] || 0)]));
  const jestLine = output.split(/\r?\n/).find(line => /^Tests:/.test(line));
  if (jestLine) {
    for (const [key, label] of [['tests', 'total'], ['pass', 'passed'], ['fail', 'failed'], ['skipped', 'skipped'], ['todo', 'todo']]) {
      counts[key] = Number(new RegExp(`(\\d+) ${label}`).exec(jestLine)?.[1] || 0);
    }
  }
  results.push({ name, exitCode: r.status, signal: r.signal, timedOut: r.error?.code === 'ETIMEDOUT', ...counts });
  console.log(`${name}: exit=${r.status}\n${captures.slice(-8).join('\n')}`);
}
try {
  run('01-notifications-P0-01-P0-02-P1-03', ['--test', '--test-reporter=tap', '--test-name-pattern=^(P0-01:|P0-02:|P1-03:|Notifications:|Gateway:)', path.join(__dirname, 'notifications.test.cjs')]);
  for (const [name, id] of [['02-prices-P1-01', 'P1-01'], ['03-stock-P1-02', 'P1-02'], ['04-nosql-P1-06', 'P1-06'], ['05-registration-P1-07', 'P1-07']]) {
    run(name, ['--test', '--test-reporter=tap', `--test-name-pattern=^${id}:`, path.join(__dirname, 'final-business.test.cjs')]);
  }
  const packages = path.join(root, 'exam1/frontend/node_modules');
  const config = { rootDir: root, testMatch: ['<rootDir>/exam1/tests/ui-notifications.test.js', '<rootDir>/exam1/tests/ui-final-e27-e28.test.js'],
    testEnvironment: path.join(packages, 'jest-environment-jsdom'),
    transform: { '^.+\\.[jt]sx?$': [path.join(packages, 'babel-jest'), { presets: [[path.join(packages, 'babel-preset-react-app'), { runtime: 'automatic' }]] }] },
    moduleNameMapper: { '^axios$': path.join(packages, 'axios/dist/node/axios.cjs') } };
  run('06-react-regression', [path.join(packages, 'jest/bin/jest.js'), '--config', JSON.stringify(config), '--runInBand', '--no-cache']);
  env.BUILD_PATH = path.join(temporary, 'react-build');
  run('07-react-build', [path.join(packages, 'react-scripts/scripts/build.js')], { cwd: path.join(root, 'exam1/frontend') });
  const files = [
    'backend/services/checkoutService.js', 'backend/validation/authValidation.js', 'backend/controllers/authController.js',
    'backend/controllers/orderController.js', 'backend/controllers/productController.js', 'backend/models/CheckoutAttempt.js',
    'backend/models/Product.js', 'backend/models/Order.js', 'backend/models/User.js', 'backend/server.js',
    'microservices/stock-management/app.js', 'microservices/stock-management/index.js', 'tests/final-business.test.cjs', 'tests/run-final-e27-e28.cjs',
  ].map(file => path.join(root, 'exam1', file));
  run('08-eslint-server', ['-e', `const {ESLint}=require(${JSON.stringify(path.join(packages, 'eslint'))});(async()=>{
    const lint=new ESLint({useEslintrc:false,overrideConfig:{env:{node:true,es2022:true},parserOptions:{ecmaVersion:2022},extends:['eslint:recommended']}});
    const results=await lint.lintFiles(${JSON.stringify(files)});
    require('node:fs').writeFileSync(${JSON.stringify(path.join(out, 'eslint-server.json'))},JSON.stringify(results.map(x=>({file:x.filePath,errors:x.errorCount,warnings:x.warningCount,messages:x.messages})),null,2));
    const errors=results.reduce((n,x)=>n+x.errorCount,0),warnings=results.reduce((n,x)=>n+x.warningCount,0);
    console.log('ESLint: '+results.length+' files, '+errors+' errors, '+warnings+' warnings');
    console.log((await lint.loadFormatter('stylish')).format(results));
    process.exitCode=errors?1:0;
  })().catch(()=>{console.error('ESLint execution failed');process.exitCode=1});`]);
  run('09-syntax', ['-e', `const cp=require('node:child_process');const files=${JSON.stringify(files)};
    const bad=files.filter(file=>cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8'}).status!==0);
    console.log('Syntax: '+files.length+' files, '+bad.length+' failures');process.exitCode=bad.length?1:0;`]);
  const evidence = [];
  for (const [id, source] of [
    ['P0-01', '01-notifications-P0-01-P0-02-P1-03'], ['P0-02', '01-notifications-P0-01-P0-02-P1-03'],
    ['P1-03', '01-notifications-P0-01-P0-02-P1-03'], ['P1-01', '02-prices-P1-01'],
    ['P1-02', '03-stock-P1-02'], ['P1-06', '04-nosql-P1-06'], ['P1-07', '05-registration-P1-07'],
  ]) {
    const lines = fs.readFileSync(path.join(out, `${source}.log`), 'utf8').split(/\r?\n/)
      .filter(line => /^(ok |not ok )/.test(line) && line.includes(`- ${id}:`));
    const sourceResult = results.find(result => result.name === source);
    const status = sourceResult.exitCode === 0 && lines.length && lines.every(line => line.startsWith('ok ')) ? 'validated' : 'not_validated';
    evidence.push({ anomaly: id, status, source: `${source}.log`, namedTests: lines });
    fs.writeFileSync(path.join(out, `${id}-after.log`), `${id}: ${status}\nSource: ${source}.log (exit=${sourceResult.exitCode})\nExtrait des tests réellement exécutés ; détails dans le log source.\n\n${lines.join('\n')}\n`);
  }
  fs.writeFileSync(path.join(out, 'anomalies.json'), JSON.stringify(evidence, null, 2));
  results.push({ name: 'seven-anomalies-evidence', exitCode: evidence.every(item => item.status === 'validated') ? 0 : 1 });
  const baseline = JSON.parse(fs.readFileSync(path.join(out, '../before/manifest.json'), 'utf8'));
  const changed = baseline.filter(entry => !fs.existsSync(path.join(root, entry.file)) ||
    crypto.createHash('sha256').update(fs.readFileSync(path.join(root, entry.file))).digest('hex') !== entry.sha256).map(entry => entry.file);
  results.push({ name: 'before-evidence-integrity', exitCode: changed.length ? 1 : 0, changedFiles: changed });
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ executedAtUtc: new Date().toISOString(), results }, null, 2));
  if (results.some(r => r.exitCode !== 0)) process.exitCode = 1;
} finally {
  // Only this private mkdtemp directory may be recursively removed.
  const resolved = path.resolve(temporary);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('e27-final-run-')) {
    console.error('Temporary cleanup path rejected.');
    process.exitCode = 1;
  } else {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
