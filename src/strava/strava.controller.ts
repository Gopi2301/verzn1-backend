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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import type { Response } from 'express';
import { StravaService } from './strava.service.js';
import type { StravaWebhookEvent } from './strava.service.js';

@ApiTags('Strava')
@Controller('strava')
export class StravaController {
  constructor(private readonly stravaService: StravaService) {}

  @Get('auth-url')
  @ApiOperation({ summary: 'Get the Strava authorization URL as JSON (for Frontend apps)' })
  @ApiQuery({ name: 'userId', required: true, description: 'The UUID of the authenticated user' })
  @ApiQuery({ name: 'redirectUri', required: false, description: 'Custom redirect URI' })
  async getAuthUrl(
    @Query('userId') userId: string,
    @Query('redirectUri') redirectUri?: string,
  ) {
    const url = this.stravaService.getAuthorizationUrl(userId, redirectUri);
    return { url };
  }

  @Get('connect')
  @ApiOperation({ summary: 'Initiate Strava OAuth flow and redirect user directly to Strava' })
  @ApiQuery({ name: 'userId', required: true, description: 'The UUID of the authenticated user' })
  @ApiQuery({ name: 'redirectUri', required: false, description: 'Custom redirect URI' })
  async connect(
    @Query('userId') userId: string,
    @Query('redirectUri') redirectUri: string,
    @Res() res: Response,
  ) {
    const url = this.stravaService.getAuthorizationUrl(userId, redirectUri);
    return res.redirect(HttpStatus.FOUND, url);
  }

  @Get('callback')
  @ApiOperation({ summary: 'Strava OAuth redirect callback endpoint' })
  @ApiQuery({ name: 'code', required: true, description: 'Authorization code from Strava' })
  @ApiQuery({ name: 'state', required: true, description: 'User ID passed in state' })
  @ApiQuery({ name: 'scope', required: false, description: 'Granted scopes' })
  async callback(
    @Query('code') code: string,
    @Query('state') userId: string,
    @Query('scope') scope: string,
  ) {
    return await this.stravaService.exchangeAuthorizationCode(code, userId, scope);
  }

  @Get('status/:userId')
  @ApiOperation({ summary: 'Get Strava integration status for a user' })
  @ApiParam({ name: 'userId', description: 'The UUID of the user' })
  async getStatus(@Param('userId') userId: string) {
    return await this.stravaService.getStatus(userId);
  }

  @Post('sync/:userId')
  @ApiOperation({ summary: 'Manually trigger Strava activity sync for an athlete' })
  @ApiParam({ name: 'userId', description: 'The UUID of the user to sync' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'perPage', required: false, description: 'Items per page (default: 30)' })
  async syncActivities(
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return await this.stravaService.syncAthleteActivities(userId, {
      page: page ? parseInt(page, 10) : 1,
      perPage: perPage ? parseInt(perPage, 10) : 30,
    });
  }

  @Get('activities/:userId')
  @ApiOperation({ summary: 'Get synced activities for a user with pagination' })
  @ApiParam({ name: 'userId', description: 'The UUID of the user' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of activities (default: 20)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset (default: 0)' })
  async getActivities(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return await this.stravaService.getUserActivities(
      userId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Post('disconnect/:userId')
  @ApiOperation({ summary: 'Disconnect and deauthorize Strava account' })
  @ApiParam({ name: 'userId', description: 'The UUID of the user' })
  async disconnect(@Param('userId') userId: string) {
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
