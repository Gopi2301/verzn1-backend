import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { CoachingStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service.js";
import { SearchAthletesDto } from "./dto/search-athletes.dto.js";
import { SearchCoachesDto } from "./dto/search-coaches.dto.js";

@Injectable()
export class CoachingService {
    constructor(private readonly prisma: PrismaService) { }

    // ─────────────────────────────────────────────────────────────────────────────
    // COACH INVITES ATHLETE
    // Flow: Coach initiates → Athlete accepts/declines
    // ─────────────────────────────────────────────────────────────────────────────
    async coachInvite(coachId: string, athleteId: string) {
        // Ensure the coach profile exists
        const coach = await this.prisma.coach.findUnique({
            where: { id: coachId },
            include: { user: true },
        });
        if (!coach) {
            throw new NotFoundException('Coach profile not found');
        }

        // Ensure the athlete has an account + athlete profile
        const athlete = await this.prisma.athlete.findUnique({
            where: { id: athleteId },
            include: { user: true },
        });
        if (!athlete) {
            throw new NotFoundException(
                'Athlete not found. The athlete must have a registered account before a coaching relationship can be created.'
            );
        }

        // Prevent duplicate relationships
        const existing = await this.prisma.coachingRelationship.findUnique({
            where: { coachId_athleteId: { coachId, athleteId } },
        });
        if (existing) {
            throw new ConflictException(
                `A coaching relationship already exists with status: ${existing.status}`
            );
        }

        const relationship = await this.prisma.coachingRelationship.create({
            data: {
                coachId,
                athleteId,
                status: 'INVITED',
                invitationSentAt: new Date(),
            },
            include: {
                coach: { include: { user: true } },
                athlete: { include: { user: true } },
            },
        });
        return relationship;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ATHLETE REQUESTS A COACH
    // Flow: Athlete initiates → Coach accepts/declines
    // ─────────────────────────────────────────────────────────────────────────────
    async coachRequest(coachId: string, athleteId: string) {
        // Ensure the athlete profile exists (they must have an account)
        const athlete = await this.prisma.athlete.findUnique({
            where: { id: athleteId },
            include: { user: true },
        });
        if (!athlete) {
            throw new NotFoundException(
                'Athlete profile not found. You must complete your athlete profile before requesting a coach.'
            );
        }

        // Ensure the coach profile exists
        const coach = await this.prisma.coach.findUnique({
            where: { id: coachId },
            include: { user: true },
        });
        if (!coach) {
            throw new NotFoundException('Coach not found');
        }

        // Prevent duplicate relationships
        const existing = await this.prisma.coachingRelationship.findUnique({
            where: { coachId_athleteId: { coachId, athleteId } },
        });
        if (existing) {
            throw new ConflictException(
                `A coaching relationship already exists with status: ${existing.status}`
            );
        }

        const coachRequest = await this.prisma.coachingRelationship.create({
            data: {
                coachId,
                athleteId,
                status: 'REQUESTED',
                invitationSentAt: new Date(),
            },
            include: {
                coach: { include: { user: true } },
                athlete: { include: { user: true } },
            },
        });
        return coachRequest;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ACCEPT A COACHING RELATIONSHIP
    // Who can accept?
    //   - If status is INVITED   → the ATHLETE accepts (coach invited them)
    //   - If status is REQUESTED → the COACH accepts  (athlete requested them)
    // actorId: the User.id of the person performing the accept
    // ─────────────────────────────────────────────────────────────────────────────
    async coachAccept(coachId: string, athleteId: string, actorId: string) {
        const relationship = await this.findRelationshipOrThrow(coachId, athleteId);

        if (relationship.status === 'ACTIVE') {
            throw new BadRequestException('This coaching relationship is already active');
        }
        if (relationship.status === 'DECLINED') {
            throw new BadRequestException(
                'This invitation was declined. A new invitation must be sent to restart.'
            );
        }

        // Enforce who is allowed to accept
        if (relationship.status === 'INVITED') {
            // Coach invited the athlete → only the athlete can accept
            if (relationship.athlete.userId !== actorId) {
                throw new ForbiddenException('Only the invited athlete can accept this invitation');
            }
        } else if (relationship.status === 'REQUESTED') {
            // Athlete requested the coach → only the coach can accept
            if (relationship.coach.userId !== actorId) {
                throw new ForbiddenException('Only the coach can accept this coaching request');
            }
        }

        const updated = await this.prisma.coachingRelationship.update({
            where: { coachId_athleteId: { coachId, athleteId } },
            data: {
                status: 'ACTIVE',
                invitationAcceptedAt: new Date(),
            },
            include: {
                coach: { include: { user: true } },
                athlete: { include: { user: true } },
            },
        });
        return updated;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // DECLINE A COACHING RELATIONSHIP
    // Who can decline?
    //   - If status is INVITED   → the ATHLETE declines
    //   - If status is REQUESTED → the COACH declines
    // actorId: the User.id of the person performing the decline
    // ─────────────────────────────────────────────────────────────────────────────
    async coachDecline(coachId: string, athleteId: string, actorId: string) {
        const relationship = await this.findRelationshipOrThrow(coachId, athleteId);

        if (relationship.status === 'DECLINED') {
            throw new BadRequestException('This relationship has already been declined');
        }
        if (relationship.status === 'ACTIVE') {
            throw new BadRequestException(
                'Cannot decline an active relationship. Use coachRemove instead.'
            );
        }

        if (relationship.status === 'INVITED') {
            if (relationship.athlete.userId !== actorId) {
                throw new ForbiddenException('Only the invited athlete can decline this invitation');
            }
        } else if (relationship.status === 'REQUESTED') {
            if (relationship.coach.userId !== actorId) {
                throw new ForbiddenException('Only the coach can decline this coaching request');
            }
        }

        const updated = await this.prisma.coachingRelationship.update({
            where: { coachId_athleteId: { coachId, athleteId } },
            data: { status: 'DECLINED' },
        });
        return updated;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // REMOVE AN ACTIVE COACHING RELATIONSHIP
    // Either the coach or the athlete can end an active relationship.
    // actorId: the User.id of the person removing the relationship
    // ─────────────────────────────────────────────────────────────────────────────
    async coachRemove(coachId: string, athleteId: string, actorId: string) {
        const relationship = await this.findRelationshipOrThrow(coachId, athleteId);

        const isCoach = relationship.coach.userId === actorId;
        const isAthlete = relationship.athlete.userId === actorId;
        if (!isCoach && !isAthlete) {
            throw new ForbiddenException('You are not part of this coaching relationship');
        }

        await this.prisma.coachingRelationship.delete({
            where: { coachId_athleteId: { coachId, athleteId } },
        });

        return { message: 'Coaching relationship removed successfully' };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // FIND ATHLETES FOR A COACH
    // Returns all active athletes linked to a coach.
    // ─────────────────────────────────────────────────────────────────────────────
    async getAthletesForCoach(coachId: string) {
        const coach = await this.prisma.coach.findUnique({ where: { id: coachId } });
        if (!coach) {
            throw new NotFoundException('Coach not found');
        }

        return this.prisma.coachingRelationship.findMany({
            where: { coachId, status: 'ACTIVE' },
            include: {
                athlete: { include: { user: true } },
            },
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // FIND COACHES FOR AN ATHLETE
    // Returns all active coaches linked to an athlete.
    // ─────────────────────────────────────────────────────────────────────────────
    async getCoachesForAthlete(athleteId: string) {
        const athlete = await this.prisma.athlete.findUnique({ where: { id: athleteId } });
        if (!athlete) {
            throw new NotFoundException('Athlete not found');
        }

        return this.prisma.coachingRelationship.findMany({
            where: { athleteId, status: 'ACTIVE' },
            include: {
                coach: { include: { user: true } },
            },
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // COACH CHAT CHANNEL
    // Gets or creates a chat channel. Requires an active coaching relationship.
    // ─────────────────────────────────────────────────────────────────────────────
    async coachChat(coachId: string, athleteId: string) {
        const relationship = await this.prisma.coachingRelationship.findUnique({
            where: { coachId_athleteId: { coachId, athleteId } },
        });

        if (!relationship || relationship.status !== 'ACTIVE') {
            throw new ForbiddenException(
                'An active coaching relationship is required to start a chat channel'
            );
        }

        // Return existing channel or create a new one
        const existing = await this.prisma.chatChannel.findFirst({
            where: { coachId, athleteId },
        });
        if (existing) return existing;

        return this.prisma.chatChannel.create({
            data: { coachId, athleteId },
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // DISCOVERY: SEARCH COACHES
    // Athletes use this to find coaches they haven't connected with yet.
    // Supports optional filtering by name and specialty.
    // ─────────────────────────────────────────────────────────────────────────────
    async searchCoaches(athleteId: string, dto: SearchCoachesDto) {
        // Find coachIds already connected to this athlete (any status)
        const existingRelationships = await this.prisma.coachingRelationship.findMany({
            where: { athleteId },
            select: { coachId: true },
        });
        const excludedCoachIds = existingRelationships.map((r) => r.coachId);

        return this.prisma.coach.findMany({
            where: {
                // Exclude coaches already connected
                id: { notIn: excludedCoachIds },
                // Filter by specialty if provided
                ...(dto.specialty && {
                    specialties: { has: dto.specialty },
                }),
                // Filter by certification level if provided
                ...(dto.certificationLevel && {
                    certificationLevel: dto.certificationLevel,
                }),
                // Filter by name (search on the related User)
                ...(dto.name && {

                    user: {
                        fullName: { contains: dto.name, mode: 'insensitive' },
                    },
                }),
            },
            include: {
                user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
            },
            take: dto.limit ?? 20,
            skip: dto.offset ?? 0,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // DISCOVERY: SEARCH ATHLETES
    // Coaches use this to find athletes they haven't connected with yet.
    // Supports optional filtering by name and fitness level.
    // ─────────────────────────────────────────────────────────────────────────────
    async searchAthletes(coachId: string, dto: SearchAthletesDto) {
        // Find athleteIds already connected to this coach (any status)
        const existingRelationships = await this.prisma.coachingRelationship.findMany({
            where: { coachId },
            select: { athleteId: true },
        });
        const excludedAthleteIds = existingRelationships.map((r) => r.athleteId);

        return this.prisma.athlete.findMany({
            where: {
                // Exclude athletes already connected
                id: { notIn: excludedAthleteIds },
                // Filter by fitness level if provided
                ...(dto.fitnessLevel && {
                    fitnessLevel: dto.fitnessLevel,
                }),
                // Filter by name (search on the related User)
                ...(dto.name && {
                    user: {
                        fullName: { contains: dto.name, mode: 'insensitive' },
                    },
                }),
            },
            include: {
                user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
            },
            take: dto.limit ?? 20,
            skip: dto.offset ?? 0,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MY CONNECTIONS: GET MY ATHLETES (for a coach)
    // Returns all active athletes for the authenticated coach.
    // ─────────────────────────────────────────────────────────────────────────────
    async getMyAthletes(coachId: string, status?: CoachingStatus) {
        return this.prisma.coachingRelationship.findMany({
            where: { coachId, status: status ?? 'ACTIVE' },
            include: {
                athlete: {
                    include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MY CONNECTIONS: GET MY COACHES (for an athlete)
    // Returns all active coaches for the authenticated athlete.
    // ─────────────────────────────────────────────────────────────────────────────
    async getMyCoaches(athleteId: string, status?: CoachingStatus) {
        return this.prisma.coachingRelationship.findMany({
            where: { athleteId, status: status ?? 'ACTIVE' },
            include: {
                coach: {
                    include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PROFILE HELPERS (FOR CURRENT USER AUTH CONTEXT)
    // ─────────────────────────────────────────────────────────────────────────────
    async getCoachProfileByUserId(userId: string) {
        const coach = await this.prisma.coach.findUnique({
            where: { userId },
        });
        if (!coach) {
            throw new NotFoundException('Coach profile not found for the current user');
        }
        return coach;
    }

    async getAthleteProfileByUserId(userId: string) {
        const athlete = await this.prisma.athlete.findUnique({
            where: { userId },
        });
        if (!athlete) {
            throw new NotFoundException('Athlete profile not found for the current user');
        }
        return athlete;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPER: FIND RELATIONSHIP OR THROW
    // Centralises the repeated findUnique + NotFoundException pattern used in
    // coachAccept, coachDecline, coachRemove. DRY principle.
    // ─────────────────────────────────────────────────────────────────────────────
    private async findRelationshipOrThrow(coachId: string, athleteId: string) {
        const relationship = await this.prisma.coachingRelationship.findUnique({
            where: { coachId_athleteId: { coachId, athleteId } },
            include: {
                coach: { include: { user: true } },
                athlete: { include: { user: true } },
            },
        });
        if (!relationship) {
            throw new NotFoundException('Coaching relationship not found');
        }
        return relationship;
    }
}
