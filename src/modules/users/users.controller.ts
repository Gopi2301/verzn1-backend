import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, UserPayload } from '../../common/decorators/current-user.decorator.js';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get profile of current authenticated user' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  async getProfile(@CurrentUser() user: UserPayload) {
    return this.usersService.findOrCreate(user.id, user.email, user.fullName);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update profile of current authenticated user' })
  @ApiResponse({ status: 200, description: 'User profile updated successfully' })
  async updateProfile(@CurrentUser() user: UserPayload, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.id, dto);
  }
}
