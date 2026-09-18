import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, UserPayload } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard.js';
import { AthletesService } from './athletes.service.js';
import { CreateAthleteDto } from './dto/create-athlete.dto.js';

@ApiTags('Athletes')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('athletes')
export class AthletesController {
  constructor(private readonly athletesService: AthletesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user athlete profile' })
  @ApiResponse({ status: 200, description: 'Athlete profile retrieved successfully' })
  async getMyProfile(@CurrentUser() user: UserPayload) {
    return this.athletesService.findByUserId(user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Create or update current user athlete profile' })
  @ApiResponse({ status: 200, description: 'Athlete profile saved successfully' })
  async updateMyProfile(@CurrentUser() user: UserPayload, @Body() dto: CreateAthleteDto) {
    return this.athletesService.createOrUpdate(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get athlete profile by ID' })
  @ApiResponse({ status: 200, description: 'Athlete profile retrieved successfully' })
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.athletesService.findById(id);
  }
}
