import {
  BadRequestException, CallHandler, ExecutionContext, Injectable, mixin, NestInterceptor, Type,
} from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { type FileKind, matchesFileKind } from '../utils/file-signature.js';

export function ValidateUploadSignature(kinds: FileKind[], message: string): Type<NestInterceptor> {
  @Injectable()
  class ValidateUploadSignatureInterceptor implements NestInterceptor {
    async intercept(context: ExecutionContext, next: CallHandler) {
      const file = context.switchToHttp().getRequest().file;

      if (file?.path && !(await matchesFileKind(file.path, kinds))) {
        await unlink(file.path).catch(() => undefined);
        throw new BadRequestException(message);
      }

      return next.handle();
    }
  }

  return mixin(ValidateUploadSignatureInterceptor);
}