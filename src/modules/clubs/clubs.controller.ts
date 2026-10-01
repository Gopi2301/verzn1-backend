import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, UserPayload } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ClubAccessGuard } from '../../common/guards/club-access.guard.js';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard.js';
import { ClubsService } from './clubs.service.js';
import { CreateClubDto } from './dto/create-club.dto.js';
import { CreateClubGroupDto } from './dto/create-group.dto.js';
import { JoinClubDto } from './dto/join-club.dto.js';
import { UpdateClubDto } from './dto/update-club.dto.js';
import { UpdateClubGroupDto } from './dto/update-group.dto.js';

@ApiTags('Clubs & Subgroups')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) { }

  // ---------------------------------------------------------------------------
  // STATIC ROUTES (Placed before parameterized :id routes)
  // ---------------------------------------------------------------------------

  @Get('my-clubs')
  @ApiOperation({ summary: 'Get all clubs the authenticated user is a member of' })
  @ApiResponse({ status: 200, description: 'User clubs retrieved successfully' })
  async getMyClubs(@CurrentUser() user: UserPayload) {
    return this.clubsService.myClubs(user.id);
  }

  @Get('my-groups')
  @ApiOperation({ summary: 'Get all active subgroups the authenticated user belongs to' })
  @ApiResponse({ status: 200, description: 'User subgroups retrieved successfully' })
  async getMyGroups(@CurrentUser() user: UserPayload) {
    return this.clubsService.getMyGroups(user.id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get club details by URL slug' })
  @ApiResponse({ status: 200, description: 'Club retrieved successfully' })
  async getBySlug(@Param('slug') slug: string) {
    return this.clubsService.findBySlug(slug);
  }

  // ---------------------------------------------------------------------------
  // CLUB ENDPOINTS
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // SUBGROUP ENDPOINTS
  // ---------------------------------------------------------------------------

  @Post(':id/groups')
  @UseGuards(ClubAccessGuard)
  @Roles('OWNER')
  @ApiOperation({ summary: 'Create a new sub-training group in a club (Requires OWNER role in club)' })
  @ApiResponse({ status: 201, description: 'Subgroup created successfully' })
  async createGroup(
    @Param('id', ParseUUIDPipe) clubId: string,
    @CurrentUser() user: UserPayload,
    @Body() dto: CreateClubGroupDto,
  ) {
    return this.clubsService.createGroup(clubId, user.id, dto);
  }

  @Get(':id/groups')
  @ApiOperation({ summary: 'List all sub-training groups of a club' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Club groups retrieved successfully' })
  async getClubGroups(
    @Param('id', ParseUUIDPipe) clubId: string,
    @Query('includeArchived', new ParseBoolPipe({ optional: true })) includeArchived?: boolean,
  ) {
    return this.clubsService.getClubGroups(clubId, includeArchived ?? false);
  }

  @Get('groups/:groupId')
  @ApiOperation({ summary: 'Get subgroup details by group ID' })
  @ApiResponse({ status: 200, description: 'Group retrieved successfully' })
  async getGroupById(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.clubsService.getGroupById(groupId);
  }

  @Patch('groups/:groupId')
  @UseGuards(ClubAccessGuard)
  @Roles('OWNER', 'ADMIN', 'COACH')
  @ApiOperation({ summary: 'Update subgroup details (Requires OWNER, ADMIN, or COACH)' })
  @ApiResponse({ status: 200, description: 'Group updated successfully' })
  async updateGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateClubGroupDto,
  ) {
    return this.clubsService.updateGroup(groupId, dto);
  }

  @Patch('groups/:groupId/archive')
  @UseGuards(ClubAccessGuard)
  @Roles('OWNER', 'ADMIN', 'COACH')
  @ApiOperation({ summary: 'Archive a subgroup (Requires OWNER, ADMIN, or COACH)' })
  @ApiResponse({ status: 200, description: 'Group archived successfully' })
  async archiveGroup(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.clubsService.archiveGroup(groupId);
  }

  @Delete('groups/:groupId')
  @UseGuards(ClubAccessGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Delete a subgroup (Requires OWNER or ADMIN in the parent club)' })
  @ApiResponse({ status: 200, description: 'Group deleted successfully' })
  async deleteGroup(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.clubsService.deleteGroup(groupId);
  }

  @Post('groups/:groupId/join')
  @ApiOperation({ summary: 'Join a subgroup (User can belong to multiple subgroups simultaneously)' })
  @ApiResponse({ status: 200, description: 'Joined subgroup successfully' })
  async joinGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.clubsService.joinGroup(groupId, user.id);
  }

  @Post('groups/:groupId/leave')
  @ApiOperation({ summary: 'Leave a subgroup' })
  @ApiResponse({ status: 200, description: 'Left subgroup successfully' })
  async leaveGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.clubsService.leaveGroup(groupId, user.id);
  }

  @Get('groups/:groupId/members')
  @ApiOperation({ summary: 'Get active members of a subgroup' })
  @ApiResponse({ status: 200, description: 'Subgroup members retrieved successfully' })
  async getGroupMembers(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.clubsService.getGroupMembers(groupId);
  }
}
