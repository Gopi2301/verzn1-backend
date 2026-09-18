import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const delay = Date.now() - now;
          const statusCode = response.statusCode;
          this.logger.log(`[${method}] ${url} ${statusCode} +${delay}ms`);
        },
        error: (error) => {
          const delay = Date.now() - now;
          const status = error.status || error.statusCode || 500;
          this.logger.error(
            `[${method}] ${url} ${status} +${delay}ms - ${error.message}`,
          );
        },
      }),
    );
  }
}