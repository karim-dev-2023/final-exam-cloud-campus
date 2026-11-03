// Print paths and counts only; never print credentials or matching lines.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const sensitivePath = file => /(^|\/)(?:\.env(?:\..*)?|[^/]+\.env(?:\..*)?|credentials(?:\.json)?|service-account[^/]*\.json|id_rsa[^/]*|id_ed25519[^/]*|\.npmrc|\.netrc)$|\.(?:pem|key|p12|pfx|jks|keystore|ppk)$/i.test(file)
  && !file.endsWith('/.env.example') && file !== '.env.example';
const values = new Set();
for (const file of ['exam1/.env', 'exam1/backend/.env', 'exam1/gateway/.env', 'exam1/microservices/notifications/.env']) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || !/SECRET|TOKEN|PASSWORD|MONGO_URI|EMAIL_USER|ORDER_NOTIFICATION_EMAIL/.test(match[1])) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    if (value.length >= 8 && !value.includes('<') && !value.includes('example.invalid') && !value.startsWith('mongodb://localhost') && !value.startsWith('mongodb://127.0.0.1')) values.add(value);
  }
}
const patterns = [
  /mongodb(?:\+srv)?:\/\/[^\s/'"<>]+:[^\s/'"<>]+@/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}\b/,
];
let failures = 0;
for (const file of tracked) {
  if (sensitivePath(file)) { console.error(`Fichier sensible suivi : ${file}`); failures++; }
  const full = path.join(root, file);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
  const content = fs.readFileSync(full, 'utf8');
  if (patterns.some(pattern => pattern.test(content)) || [...values].some(value => content.includes(value))) {
    console.error(`Contenu sensible potentiel : ${file}`); failures++;
  }
}
console.log(JSON.stringify({ checkedFiles: tracked.length, localSensitiveValuesCompared: values.size, findings: failures }));
if (failures) process.exitCode = 1;
