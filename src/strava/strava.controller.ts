import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  Res,
  HttpStatus,
  HttpCode,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBody, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { StravaService } from './strava.service.js';
import type { StravaWebhookEvent } from './strava.service.js';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard.js';
import { CurrentUser, UserPayload } from '../common/decorators/current-user.decorator.js';

@ApiTags('Strava')
@Controller('strava')
export class StravaController {
  constructor(private readonly stravaService: StravaService) {}

  @Get('auth-url')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Get the Strava authorization URL as JSON (for Frontend apps)' })
  @ApiQuery({ name: 'userId', required: false, description: 'The UUID of the authenticated user (must match token)' })
  @ApiQuery({ name: 'redirectUri', required: false, description: 'Custom redirect URI' })
  @ApiResponse({ status: 200, description: 'Authorization URL generated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden if requesting for another user' })
  async getAuthUrl(
    @CurrentUser() user: UserPayload,
    @Query('userId') userId?: string,
    @Query('redirectUri') redirectUri?: string,
  ) {
    if (userId && userId !== user.id) {
      throw new ForbiddenException('Cannot request Strava authorization URL for another user');
    }
    const url = this.stravaService.getAuthorizationUrl(user.id, redirectUri);
    return { url };
  }

  @Get('connect')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Initiate Strava OAuth flow and redirect user directly to Strava' })
  @ApiQuery({ name: 'userId', required: false, description: 'The UUID of the authenticated user (must match token)' })
  @ApiQuery({ name: 'redirectUri', required: false, description: 'Custom redirect URI' })
  @ApiResponse({ status: 302, description: 'Redirect to Strava OAuth consent screen' })
  @ApiResponse({ status: 403, description: 'Forbidden if requesting for another user' })
  async connect(
    @CurrentUser() user: UserPayload,
    @Res() res: Response,
    @Query('userId') userId?: string,
    @Query('redirectUri') redirectUri?: string,
  ) {
    if (userId && userId !== user.id) {
      throw new ForbiddenException('Cannot initiate Strava connection for another user');
    }
    const url = this.stravaService.getAuthorizationUrl(user.id, redirectUri);
    return res.redirect(HttpStatus.FOUND, url);
  }

  @Get('callback')
  @ApiOperation({ summary: 'Strava OAuth redirect callback endpoint' })
  @ApiQuery({ name: 'code', required: true, description: 'Authorization code from Strava' })
  @ApiQuery({ name: 'state', required: true, description: 'Cryptographically signed state token' })
  @ApiQuery({ name: 'scope', required: false, description: 'Granted scopes' })
  @ApiResponse({ status: 200, description: 'Strava integration connected successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired state / code' })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('scope') scope: string,
  ) {
    return await this.stravaService.exchangeAuthorizationCode(code, state, scope);
  }

  @Get('status/:userId')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Get Strava integration status for a user' })
  @ApiParam({ name: 'userId', description: 'The UUID of the user' })
  @ApiResponse({ status: 200, description: 'Strava status retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden if requesting status for another user' })
  async getStatus(
    @Param('userId') userId: string,
    @CurrentUser() user: UserPayload,
  ) {
    if (userId !== user.id) {
      throw new ForbiddenException('Cannot view Strava status for another user');
    }
    return await this.stravaService.getStatus(userId);
  }

  @Post('sync/:userId')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Manually trigger Strava activity sync for an athlete' })
  @ApiParam({ name: 'userId', description: 'The UUID of the user to sync' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'perPage', required: false, description: 'Items per page (default: 30)' })
  @ApiResponse({ status: 200, description: 'Activities synced successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden if syncing for another user' })
  async syncActivities(
    @Param('userId') userId: string,
    @CurrentUser() user: UserPayload,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    if (userId !== user.id) {
      throw new ForbiddenException('Cannot sync Strava activities for another user');
    }
    return await this.stravaService.syncAthleteActivities(userId, {
      page: page ? parseInt(page, 10) : 1,
      perPage: perPage ? parseInt(perPage, 10) : 30,
    });
  }

  @Get('activities/:userId')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Get synced activities for a user with pagination' })
  @ApiParam({ name: 'userId', description: 'The UUID of the user' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of activities (default: 20)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset (default: 0)' })
  @ApiResponse({ status: 200, description: 'Activities retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden if accessing another user activities' })
  async getActivities(
    @Param('userId') userId: string,
    @CurrentUser() user: UserPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (userId !== user.id) {
      throw new ForbiddenException('Cannot access Strava activities for another user');
    }
    return await this.stravaService.getUserActivities(
      userId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Post('disconnect/:userId')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Disconnect and deauthorize Strava account' })
  @ApiParam({ name: 'userId', description: 'The UUID of the user' })
  @ApiResponse({ status: 200, description: 'Strava account disconnected successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden if disconnecting another user account' })
  async disconnect(
    @Param('userId') userId: string,
    @CurrentUser() user: UserPayload,
  ) {
    if (userId !== user.id) {
      throw new ForbiddenException('Cannot disconnect Strava for another user');
    }
    return await this.stravaService.disconnect(userId);
  }

  @Get('webhook')
  @ApiOperation({ summary: 'Strava Webhook subscription challenge verification' })
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    return this.stravaService.validateWebhookChallenge(mode, token, challenge);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Strava Webhook event receiver' })
  async handleWebhook(@Body() event: StravaWebhookEvent) {
    return await this.stravaService.handleWebhookEvent(event);
  }
}
