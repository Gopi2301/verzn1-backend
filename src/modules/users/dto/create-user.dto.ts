import { Roles } from '../../../common/enums/user-role.enum.js';

export class CreateUserDto {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: Roles;
}
