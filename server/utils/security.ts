import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import type { Request, Response, NextFunction } from 'express';

// Secure random session token generated on server initialization
export const SERVER_SESSION_TOKEN = crypto.randomUUID();

/**
 * Validate that incoming requests come exclusively from local origin/host
 */
export function enforceLocalOrigin(req: Request, res: Response, next: NextFunction) {
  const host = req.headers.host || '';
  const origin = req.headers.origin || '';

  const isLocalHost =
    host.startsWith('localhost:') ||
    host.startsWith('127.0.0.1:') ||
    host === 'localhost' ||
    host === '127.0.0.1';

  if (!isLocalHost) {
    return res.status(403).json({ error: 'Access forbidden: only local access is permitted.' });
  }

  if (origin) {
    const isLocalOrigin =
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:');
    if (!isLocalOrigin) {
      return res.status(403).json({ error: 'Access forbidden: untrusted origin.' });
    }
  }

  next();
}

/**
 * Require session token for state-mutating requests (POST / DELETE)
 */
export function requireSessionToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-session-token'];
  if (!token || token !== SERVER_SESSION_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing session token.' });
  }
  next();
}

/**
 * Validates a file path exists and is a regular file
 */
export function validateSourceFilePath(rawPath: string): { valid: boolean; normalizedPath: string; error?: string } {
  if (!rawPath || typeof rawPath !== 'string') {
    return { valid: false, normalizedPath: '', error: 'Source file path must be a non-empty string.' };
  }

  const normalized = path.normalize(path.resolve(rawPath));

  try {
    if (!fs.existsSync(normalized)) {
      return { valid: false, normalizedPath: normalized, error: 'Source file does not exist on disk.' };
    }
    const stat = fs.statSync(normalized);
    if (!stat.isFile()) {
      return { valid: false, normalizedPath: normalized, error: 'Source path is a directory, not a video file.' };
    }
    if (stat.size === 0) {
      return { valid: false, normalizedPath: normalized, error: 'Source file is empty (0 bytes).' };
    }
    return { valid: true, normalizedPath: normalized };
  } catch (err: any) {
    return { valid: false, normalizedPath: normalized, error: `Cannot read source path: ${err.message}` };
  }
}

/**
 * Validates destination directory and safe output file path
 */
export function validateDestinationPath(sourcePath: string, rawDestPath: string): {
  valid: boolean;
  normalizedPath: string;
  error?: string;
  alreadyExists?: boolean;
} {
  if (!rawDestPath || typeof rawDestPath !== 'string') {
    return { valid: false, normalizedPath: '', error: 'Destination path must be specified.' };
  }

  const normalizedSource = path.normalize(path.resolve(sourcePath));
  const normalizedDest = path.normalize(path.resolve(rawDestPath));

  // Critical rule: output must NEVER be the same as the source
  if (normalizedSource.toLowerCase() === normalizedDest.toLowerCase()) {
    return {
      valid: false,
      normalizedPath: normalizedDest,
      error: 'CRITICAL SAFETY VIOLATION: Destination path cannot be identical to the source video file.',
    };
  }

  const destDir = path.dirname(normalizedDest);
  try {
    if (!fs.existsSync(destDir)) {
      return {
        valid: false,
        normalizedPath: normalizedDest,
        error: `Destination directory does not exist: ${destDir}`,
      };
    }
  } catch (err: any) {
    return {
      valid: false,
      normalizedPath: normalizedDest,
      error: `Failed to access destination directory: ${err.message}`,
    };
  }

  const alreadyExists = fs.existsSync(normalizedDest);

  return {
    valid: true,
    normalizedPath: normalizedDest,
    alreadyExists,
  };
}

/**
 * Creates a safe default output filename in the target or source folder
 */
export function generateDefaultOutputPath(sourcePath: string, targetDir?: string): string {
  const parsed = path.parse(sourcePath);
  const dir = targetDir && fs.existsSync(targetDir) ? targetDir : parsed.dir;
  const baseName = parsed.name;
  let candidate = path.join(dir, `${baseName}-compressed.mp4`);

  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${baseName}-compressed-${counter}.mp4`);
    counter++;
  }

  return candidate;
}
