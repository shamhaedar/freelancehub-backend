import { open } from 'node:fs/promises';

export type FileKind = 'jpeg' | 'png' | 'webp' | 'pdf' | 'zip';

const startsWith = (buffer: Buffer, bytes: number[], offset = 0) =>
  bytes.every((byte, index) => buffer[offset + index] === byte);

const detectors: Record<FileKind, (buffer: Buffer) => boolean> = {
  jpeg: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  png: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  webp: (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8),
  pdf: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]),
  zip: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06]),
};

export async function matchesFileKind(filePath: string, allowed: FileKind[]): Promise<boolean> {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buffer, 0, 12, 0);
    const head = buffer.subarray(0, bytesRead);
    return allowed.some((kind) => detectors[kind](head));
  } finally {
    await handle.close();
  }
}