import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetIdempKey = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    // Use a standard header name
    return request.headers['idempotency-key'] as string;
  },
);
