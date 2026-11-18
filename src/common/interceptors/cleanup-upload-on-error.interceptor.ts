import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { catchError, throwError } from 'rxjs';

@Injectable()
export class CleanupUploadOnErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(
      catchError((error) => {
        if (req.file?.path) {
          unlink(req.file.path).catch(() => undefined);
        }
        return throwError(() => error);
      }),
    );
  }
}