import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, UserPayload } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ClubAccessGuard } from '../../common/guards/club-access.guard.js';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard.js';
import { ClubsService } from './clubs.service.js';
import { CreateClubDto } from './dto/create-club.dto.js';
import { JoinClubDto } from './dto/join-club.dto.js';
import { UpdateClubDto } from './dto/update-club.dto.js';

@ApiTags('Clubs')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new running club' })
  @ApiResponse({ status: 201, description: 'Running club created successfully' })
  async createClub(@CurrentUser() user: UserPayload, @Body() dto: CreateClubDto) {
    return this.clubsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all running clubs' })
  @ApiResponse({ status: 200, description: 'Clubs retrieved successfully' })
  async getAllClubs() {
    return this.clubsService.findAll();
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get club details by URL slug' })
  @ApiResponse({ status: 200, description: 'Club retrieved successfully' })
  async getBySlug(@Param('slug') slug: string) {
    return this.clubsService.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get club details by ID' })
  @ApiResponse({ status: 200, description: 'Club retrieved successfully' })
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.clubsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(ClubAccessGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update club details (Requires OWNER or ADMIN role in club)' })
  @ApiResponse({ status: 200, description: 'Club updated successfully' })
  async updateClub(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClubDto,
  ) {
    return this.clubsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(ClubAccessGuard)
  @Roles('OWNER')
  @ApiOperation({ summary: 'Delete a running club (Requires OWNER role in club)' })
  @ApiResponse({ status: 200, description: 'Club deleted successfully' })
  async deleteClub(@Param('id', ParseUUIDPipe) id: string) {
    return this.clubsService.delete(id);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a running club' })
  @ApiResponse({ status: 200, description: 'Joined club successfully' })
  async joinClub(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserPayload,
    @Body() dto: JoinClubDto,
  ) {
    return this.clubsService.joinClub(id, user.id, dto);
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave a running club' })
  @ApiResponse({ status: 200, description: 'Left club successfully' })
  async leaveClub(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.clubsService.leaveClub(id, user.id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get members of a running club' })
  @ApiResponse({ status: 200, description: 'Club members retrieved successfully' })
  async getMembers(@Param('id', ParseUUIDPipe) id: string) {
    return this.clubsService.getMembers(id);
  }
}
