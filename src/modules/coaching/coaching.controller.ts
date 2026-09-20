import {
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CoachingStatus } from '@prisma/client';
import { CurrentUser, UserPayload } from '../../common/decorators/current-user.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard.js';
import { CoachingService } from './coaching.service.js';
import { SearchAthletesDto } from './dto/search-athletes.dto.js';
import { SearchCoachesDto } from './dto/search-coaches.dto.js';

@ApiTags('Coaching')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('coaching')
export class CoachingController {
    constructor(private readonly coachingService: CoachingService) {}

    // ─── RELATIONSHIP MANAGEMENT ─────────────────────────────────────────────────

    @Post('invite/:athleteId')
    @ApiOperation({ summary: 'Coach invites an athlete (coach initiates)' })
    @ApiResponse({ status: 201, description: 'Invitation sent' })
    async invite(
        @Param('athleteId', ParseUUIDPipe) athleteId: string,
        @CurrentUser() user: UserPayload,
    ) {
        const coach = await this.coachingService.getCoachProfileByUserId(user.id);
        return this.coachingService.coachInvite(coach.id, athleteId);
    }

    @Post('request/:coachId')
    @ApiOperation({ summary: 'Athlete requests a coach (athlete initiates)' })
    @ApiResponse({ status: 201, description: 'Coach request sent' })
    async request(
        @Param('coachId', ParseUUIDPipe) coachId: string,
        @CurrentUser() user: UserPayload,
    ) {
        const athlete = await this.coachingService.getAthleteProfileByUserId(user.id);
        return this.coachingService.coachRequest(coachId, athlete.id);
    }

    @Patch(':coachId/:athleteId/accept')
    @ApiOperation({ summary: 'Accept a pending invitation or request' })
    @ApiResponse({ status: 200, description: 'Relationship accepted and set to ACTIVE' })
    async accept(
        @Param('coachId', ParseUUIDPipe) coachId: string,
        @Param('athleteId', ParseUUIDPipe) athleteId: string,
        @CurrentUser() user: UserPayload,
    ) {
        return this.coachingService.coachAccept(coachId, athleteId, user.id);
    }

    @Patch(':coachId/:athleteId/decline')
    @ApiOperation({ summary: 'Decline a pending invitation or request' })
    @ApiResponse({ status: 200, description: 'Relationship declined' })
    async decline(
        @Param('coachId', ParseUUIDPipe) coachId: string,
        @Param('athleteId', ParseUUIDPipe) athleteId: string,
        @CurrentUser() user: UserPayload,
    ) {
        return this.coachingService.coachDecline(coachId, athleteId, user.id);
    }

    @Delete(':coachId/:athleteId')
    @ApiOperation({ summary: 'Remove an active coaching relationship' })
    @ApiResponse({ status: 200, description: 'Relationship removed' })
    async remove(
        @Param('coachId', ParseUUIDPipe) coachId: string,
        @Param('athleteId', ParseUUIDPipe) athleteId: string,
        @CurrentUser() user: UserPayload,
    ) {
        return this.coachingService.coachRemove(coachId, athleteId, user.id);
    }

    @Post(':coachId/:athleteId/chat')
    @ApiOperation({ summary: 'Get or create a chat channel for an active coaching relationship' })
    @ApiResponse({ status: 200, description: 'Chat channel returned' })
    async chat(
        @Param('coachId', ParseUUIDPipe) coachId: string,
        @Param('athleteId', ParseUUIDPipe) athleteId: string,
    ) {
        return this.coachingService.coachChat(coachId, athleteId);
    }

    // ─── MY CONNECTIONS ──────────────────────────────────────────────────────────

    @Get('my-athletes')
    @ApiOperation({ summary: 'Coach: get my athletes (optionally filter by status)' })
    @ApiQuery({ name: 'status', enum: CoachingStatus, required: false })
    async getMyAthletes(
        @CurrentUser() user: UserPayload,
        @Query('status') status?: CoachingStatus,
    ) {
        const coach = await this.coachingService.getCoachProfileByUserId(user.id);
        return this.coachingService.getMyAthletes(coach.id, status);
    }

    @Get('my-coaches')
    @ApiOperation({ summary: 'Athlete: get my coaches (optionally filter by status)' })
    @ApiQuery({ name: 'status', enum: CoachingStatus, required: false })
    async getMyCoaches(
        @CurrentUser() user: UserPayload,
        @Query('status') status?: CoachingStatus,
    ) {
        const athlete = await this.coachingService.getAthleteProfileByUserId(user.id);
        return this.coachingService.getMyCoaches(athlete.id, status);
    }

    // ─── DISCOVERY / SEARCH ───────────────────────────────────────────────────────

    @Get('search/coaches')
    @ApiOperation({ summary: 'Athlete: discover coaches not yet connected with' })
    async searchCoaches(
        @CurrentUser() user: UserPayload,
        @Query() dto: SearchCoachesDto,
    ) {
        const athlete = await this.coachingService.getAthleteProfileByUserId(user.id);
        return this.coachingService.searchCoaches(athlete.id, dto);
    }

    @Get('search/athletes')
    @ApiOperation({ summary: 'Coach: discover athletes not yet connected with' })
    async searchAthletes(
        @CurrentUser() user: UserPayload,
        @Query() dto: SearchAthletesDto,
    ) {
        const coach = await this.coachingService.getCoachProfileByUserId(user.id);
        return this.coachingService.searchAthletes(coach.id, dto);
    }
}
