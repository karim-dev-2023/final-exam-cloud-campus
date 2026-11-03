const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'docs/audit-complementaire/run-2026-11-03');
const manifest = JSON.parse(fs.readFileSync(path.join(out, 'history-manifest.json'), 'utf8'));
const changed = manifest.filter(entry => {
  const file = path.resolve(root, entry.file);
  return !fs.existsSync(file) || crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== entry.sha256;
}).map(entry => entry.file);
function filesIn(directory, skip = []) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (skip.includes(entry.name)) return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file, skip) : [file];
  });
}
// Only compare in memory. Never print or persist real environment values.
const dotenv = require('../backend/node_modules/dotenv');
const secrets = new Set();
for (const file of filesIn(path.join(root, 'exam1'), ['node_modules', '.git', 'build'])) {
  if (!/^\.env(?:\.|$)/.test(path.basename(file))) continue;
  const environment = dotenv.parse(fs.readFileSync(file));
  for (const [key, value] of Object.entries(environment)) {
    if (/SECRET|TOKEN|PASSWORD|MONGO_URI|EMAIL_USER/i.test(key) && value.length >= 8) secrets.add(value);
  }
}
const files = [...filesIn(out), path.join(root, 'docs/AUDIT_COMPLEMENTAIRE_FINAL.md')];
let matches = 0;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if ([...secrets].some(value => content.includes(value))) matches++;
}
const result = { checkedAtUtc: new Date().toISOString(), historicalFiles: manifest.length,
  changedHistoricalFiles: changed, secretValuesChecked: secrets.size, matchingNewFiles: matches };
fs.writeFileSync(path.join(out, 'safety.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ historicalFiles: manifest.length, changedHistoricalFiles: changed.length, matchingNewFiles: matches }));
if (changed.length || matches) process.exitCode = 1;
