import { execSync } from 'child_process';
try {
  const output = execSync('npx tsc --noEmit --project tsconfig.json', { cwd: '/Users/sarnav07/Veil/scripts', encoding: 'utf-8', stdio: 'pipe' });
  console.log('SUCCESS:', output);
} catch (e) {
  console.log('ERROR:', e.stdout || e.message);
}
