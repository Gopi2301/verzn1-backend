import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Request, Response } from "express";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface ResponseEnvelope<T> {
    statusCode: number;
    message: string;
    data: T;
    timestamp: string;
    path: string;
    method: string;
}

@Injectable()
export class ResponseTransformInterceptor<T>
    implements NestInterceptor<T, ResponseEnvelope<T>> {
    intercept(
        context: ExecutionContext,
        next: CallHandler<T>,
    ): Observable<ResponseEnvelope<T>> {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        return next.handle().pipe(
            map((data: T): ResponseEnvelope<T> => ({
                statusCode: response.statusCode,
                message: 'Success',
                data: data ?? (null as unknown as T),
                timestamp: new Date().toISOString(),
                path: request.url,
                method: request.method,
            })),
        );
    }
}
