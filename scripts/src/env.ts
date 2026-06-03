import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load the repo-root .env regardless of the cwd the script is invoked from.
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../.env') });

/** Read a required env var, or fail with an actionable message. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing required env var "${name}". Copy .env.example to .env and fill it in.`,
    );
  }
  return value.trim();
}

/** Read an optional env var, falling back to a default. */
export function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value !== undefined && value.trim() !== '' ? value.trim() : fallback;
}
