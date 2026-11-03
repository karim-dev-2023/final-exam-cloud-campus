const emailPattern = /^[^\s@<>"():;,\\]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const hasControl = value => Array.from(value).some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);
const validUsername = value => typeof value === 'string' && value.trim().length >= 3 && value.trim().length <= 50 && !hasControl(value);
function validEmail(value) {
  if (typeof value !== 'string' || value.length > 254 || hasControl(value) || !emailPattern.test(value)) return false;
  const local = value.split('@')[0];
  return Buffer.byteLength(local, 'utf8') <= 64 && !local.includes('[') && !local.includes(']') && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..');
}
const validPassword = value => typeof value === 'string' && value.length >= 12 &&
  Buffer.byteLength(value, 'utf8') <= 72 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value) && !hasControl(value);

module.exports = { validUsername, validEmail, validPassword };
