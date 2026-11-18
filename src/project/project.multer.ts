import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const uploadDir = resolve(process.cwd(), 'uploads', 'projects');

mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const projectMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: uploadDir,
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),

  fileFilter: (_req, file, callback) => {
    const isAllowed =
      allowedMimeTypes.includes(file.mimetype) &&
      ['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(extname(file.originalname).toLowerCase());

    if (!isAllowed) {
      return callback(
        new BadRequestException('Only JPEG, PNG, WEBP images and PDF files are allowed'),
        false,
      );
    }

    callback(null, true);
  },

  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
};
