import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { diskStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const uploadPath = join(
  process.cwd(),
  'uploads',
  'private',
  'deliveries',
);

mkdirSync(uploadPath, { recursive: true });

const allowedMimeTypes = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
];

export const deliveryMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: uploadPath,
    filename: (_req, file, callback) => {
      callback(
        null,
        `${randomUUID()}${extname(file.originalname).toLowerCase()}`,
      );
    },
  }),

  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB
    files: 1,
  },

  fileFilter: (_req, file, callback) => {
    const isAllowed =
      allowedMimeTypes.includes(file.mimetype) &&
      ['.pdf', '.zip'].includes(extname(file.originalname).toLowerCase());

    if (!isAllowed) {
      return callback(
        new BadRequestException('Only PDF and ZIP files are allowed'),
        false,
      );
    }

    callback(null, true);
  },
};
