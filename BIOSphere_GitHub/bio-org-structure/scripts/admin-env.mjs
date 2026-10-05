import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

// Pass an absolute path: Wrangler otherwise resolves secrets relative to its
// selected config, which differs between source, build, and Docker launches.
export function adminEnvArgs(file = '.dev.vars') {
  const path = resolve(file);
  let values;
  try {
    const source = readFileSync(path, 'utf8');
    values = parseEnv(source);
    for (const [index, line] of source.split(/\r?\n/).entries()) {
      const match = line.match(/^\s*(?:export\s+)?(ADMIN_USERNAME|ADMIN_PASSWORD|ADMIN_PASSWORD_RECORD|ADMIN_SESSION_KEY)\s*=\s*(.*)$/);
      if (!match) continue;
      const quote = match[2][0];
      if ((quote === '"' || quote === "'") && !match[2].slice(1).includes(quote)) {
        throw new SyntaxError(`Unclosed quote for ${match[1]} on line ${index + 1}. Keep each admin setting on one line and close its quotes.`);
      }
    }
  } catch (error) {
    if (error instanceof SyntaxError) throw error;
    throw new Error(`Cannot read admin configuration at ${path}. Check the .dev.vars file and Docker bind mount.`);
  }
  const missing = ['ADMIN_USERNAME', 'ADMIN_SESSION_KEY']
    .filter(key => !values[key]?.trim());
  if (!values.ADMIN_PASSWORD_RECORD?.trim() && !values.ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD or ADMIN_PASSWORD_RECORD');
  if (missing.length) throw new Error(`Missing ${missing.join(', ')} in ${path}. Configure these variables and restart the server.`);
  for (const key of ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_PASSWORD_RECORD', 'ADMIN_SESSION_KEY']) {
    if (/[\r\n]/.test(values[key] ?? '')) throw new Error(`Invalid ${key}: admin settings must be on one line. Check the quotes in ${path}.`);
  }
  if (values.ADMIN_PASSWORD_RECORD?.trim()) {
    const parts = values.ADMIN_PASSWORD_RECORD.split(':');
    try {
      if (parts.length !== 2 || !atob(parts[0]).length || atob(parts[1]).length !== 32) throw new Error();
    } catch {
      throw new Error('Invalid ADMIN_PASSWORD_RECORD: expected base64(salt):base64(PBKDF2-SHA256 hash), 310000 iterations, 32-byte hash. Use ADMIN_PASSWORD for an ordinary password.');
    }
  }
  console.log(`[admin] Configuration validated: ADMIN_USERNAME, ${values.ADMIN_PASSWORD_RECORD?.trim() ? 'ADMIN_PASSWORD_RECORD' : 'ADMIN_PASSWORD'}, ADMIN_SESSION_KEY (values hidden).`);
  return ['--env-file', path];
}
