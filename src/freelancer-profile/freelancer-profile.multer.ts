import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const uploadDir = resolve(process.cwd(), 'uploads', 'profiles');

mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const freelancerProfileMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: uploadDir,
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),

  fileFilter: (_req, file, callback) => {
    const isImage =
      allowedMimeTypes.includes(file.mimetype) &&
      ['.jpg', '.jpeg', '.png', '.webp'].includes(extname(file.originalname).toLowerCase());

    if (!isImage) {
      return callback(
        new BadRequestException('Only JPEG, PNG and WEBP images are allowed'),
        false,
      );
    }

    callback(null, true);
  },

  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
    files: 1,
  },
};
