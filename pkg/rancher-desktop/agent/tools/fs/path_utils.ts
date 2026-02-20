import path from 'path';

export function resolveFsPath(inputPath: string): string {
  const raw = String(inputPath || '').trim();
  if (!raw) {
    throw new Error('Path is required');
  }

  if (path.isAbsolute(raw)) {
    return path.normalize(raw);
  }

  return path.resolve(process.cwd(), raw);
}
