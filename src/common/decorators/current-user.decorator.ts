import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export class UserPayload {
  id!: string;
  email!: string;
  fullName?: string;
  roles?: string[];
}

export const CurrentUser = createParamDecorator(
  (data: keyof UserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as UserPayload;

    return data ? user?.[data] : user;
  },
);
