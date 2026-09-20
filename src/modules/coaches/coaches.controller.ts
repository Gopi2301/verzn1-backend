import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, UserPayload } from '../../common/decorators/current-user.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard.js';
import { CoachesService } from './coaches.service.js';
import { CreateCoachDto } from './dto/create-coach.dto.js';

@ApiTags('Coaches')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('coaches')
export class CoachesController {
  constructor(private readonly coachesService: CoachesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user coach profile' })
  @ApiResponse({ status: 200, description: 'Coach profile retrieved successfully' })
  async getMyProfile(@CurrentUser() user: UserPayload) {
    return this.coachesService.findByUserId(user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Create or update current user coach profile' })
  @ApiResponse({ status: 200, description: 'Coach profile saved successfully' })
  async updateMyProfile(@CurrentUser() user: UserPayload, @Body() dto: CreateCoachDto) {
    return this.coachesService.createOrUpdate(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get coach profile by ID' })
  @ApiResponse({ status: 200, description: 'Coach profile retrieved successfully' })
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.coachesService.findById(id);
  }
}
