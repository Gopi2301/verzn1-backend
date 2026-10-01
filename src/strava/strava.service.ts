import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service.js';
import { SportType } from '@prisma/client';

interface StravaTokenResponse {
  token_type: string;
  expires_at: number; // Unix epoch in seconds
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete?: {
    id: number;
    username?: string;
    firstname?: string;
    lastname?: string;
    profile?: string;
  };
}

export interface StravaRawActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain?: number;
  type: string;
  sport_type: string;
  start_date: string;
  average_speed?: number;
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  calories?: number;
  manual?: boolean;
  map?: {
    summary_polyline?: string;
  };
}

export interface StravaWebhookEvent {
  aspect_type: 'create' | 'update' | 'delete';
  event_time: number;
  object_id: number; // activity id or athlete id
  object_type: 'activity' | 'athlete';
  owner_id: number; // athlete id
  subscription_id: number;
  updates?: Record<string, any>;
}

@Injectable()
export class StravaService {
  private readonly logger = new Logger(StravaService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly appBaseUrl: string;
  private readonly webhookVerifyToken: string;
  private readonly webhookSubscriptionId: string;
  private readonly tokenEncryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.clientId = String(
      this.configService.get('STRAVA_CLIENT_ID') || process.env.STRAVA_CLIENT_ID || '',
    );
    this.clientSecret = String(
      this.configService.get('STRAVA_CLIENT_SECRET') ||
        this.configService.get('STRAVA_SECRET') ||
        process.env.STRAVA_CLIENT_SECRET ||
        process.env.STRAVA_SECRET ||
        '',
    );
    this.appBaseUrl = String(
      this.configService.get('APP_BASE_URL') || process.env.APP_BASE_URL || 'http://localhost:3000',
    );
    this.webhookVerifyToken = String(
      this.configService.get('STRAVA_WEBHOOK_VERIFY_TOKEN') ||
        process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ||
        'sportz_strava_webhook_token',
    );
    this.webhookSubscriptionId = String(
      this.configService.get('STRAVA_WEBHOOK_SUBSCRIPTION_ID') ||
        process.env.STRAVA_WEBHOOK_SUBSCRIPTION_ID ||
        '',
    );
    const encryptionKeySource = String(
      this.configService.get('STRAVA_TOKEN_ENCRYPTION_KEY') ||
        process.env.STRAVA_TOKEN_ENCRYPTION_KEY ||
        this.clientSecret ||
        'sportz_strava_token_encryption_key_default',
    );
    this.tokenEncryptionKey = crypto.createHash('sha256').update(encryptionKeySource).digest();
  }

  /**
   * Encrypts sensitive OAuth tokens at rest using AES-256-GCM.
   */
  encryptToken(plainText: string): string {
    if (!plainText) return plainText;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.tokenEncryptionKey, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts tokens encrypted with encryptToken.
   * Handles backward-compatibility for unencrypted legacy tokens.
   */
  decryptToken(cipherText: string): string {
    if (!cipherText || !cipherText.startsWith('enc:')) {
      return cipherText;
    }
    const parts = cipherText.split(':');
    if (parts.length !== 4) {
      throw new InternalServerErrorException('Malformed encrypted token format');
    }
    const [, ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.tokenEncryptionKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Generates a cryptographically secure, unpredictable OAuth state token tied to the user.
   */
  generateOAuthState(userId: string): string {
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');
    const payload = `${userId}:${timestamp}:${nonce}`;
    const secret = this.clientSecret || 'sportz_strava_state_secret';
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return Buffer.from(`${payload}:${signature}`).toString('base64url');
  }

  /**
   * Verifies and extracts the userId from an OAuth state token.
   * Ensures the state is valid, not expired, and has not been tampered with.
   */
  verifyOAuthState(state: string): string {
    if (!state) {
      throw new BadRequestException('OAuth state parameter is missing');
    }

    let decoded: string;
    try {
      decoded = Buffer.from(state, 'base64url').toString('utf8');
    } catch {
      throw new BadRequestException('Invalid OAuth state format');
    }

    const parts = decoded.split(':');
    if (parts.length !== 4) {
      throw new BadRequestException('Invalid OAuth state format');
    }

    const [userId, timestampStr, nonce, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      throw new BadRequestException('Invalid OAuth state timestamp');
    }

    const maxAge = 15 * 60 * 1000; // 15 minutes
    const now = Date.now();
    if (now - timestamp > maxAge || timestamp > now + 60000) {
      throw new BadRequestException('OAuth state has expired');
    }

    const payload = `${userId}:${timestampStr}:${nonce}`;
    const secret = this.clientSecret || 'sportz_strava_state_secret';
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedSigBuffer = Buffer.from(expectedSignature, 'hex');

    if (
      sigBuffer.length !== expectedSigBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
    ) {
      throw new BadRequestException('Invalid OAuth state signature');
    }

    return userId;
  }

  /**
   * Generates the Strava OAuth authorization URL to redirect the user.
   */
  getAuthorizationUrl(userId: string, customRedirectUri?: string): string {
    if (!this.clientId) {
      throw new InternalServerErrorException('STRAVA_CLIENT_ID is not configured in .env');
    }

    const redirectUri = customRedirectUri || `${this.appBaseUrl}/api/v1/strava/callback`;
    const scope = 'read,activity:read_all';
    const state = this.generateOAuthState(userId);
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      approval_prompt: 'auto',
      scope,
      state,
    });

    return `https://www.strava.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchanges the temporary authorization code from Strava for access & refresh tokens
   * and saves the integration in the database.
   */
  async exchangeAuthorizationCode(code: string, state: string, scope?: string) {
    if (!this.clientId || !this.clientSecret) {
      throw new InternalServerErrorException('Strava credentials are not properly configured');
    }

    if (!code) {
      throw new BadRequestException('Authorization code is required');
    }

    if (!state) {
      throw new BadRequestException('OAuth state parameter is missing from the callback');
    }

    const userId = this.verifyOAuthState(state);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    try {
      const response = await fetch('https://www.strava.com/api/v3/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          grant_type: 'authorization_code',
        }),
      });

      const data = (await response.json()) as StravaTokenResponse & { message?: string };

      if (!response.ok) {
        this.logger.error(`Strava token exchange failed: ${JSON.stringify(data)}`);
        throw new BadRequestException(data.message || 'Failed to exchange code with Strava');
      }

      const athleteId = data.athlete?.id;
      if (!athleteId) {
        throw new BadRequestException('Athlete profile missing from Strava response');
      }

      const integration = await this.prisma.stravaIntegration.upsert({
        where: { userId },
        create: {
          userId,
          stravaAthleteId: BigInt(athleteId),
          accessToken: this.encryptToken(data.access_token),
          refreshToken: this.encryptToken(data.refresh_token),
          expiresAt: new Date(data.expires_at * 1000),
          scope: scope || 'read,activity:read_all',
          status: 'SYNCED',
          lastSyncTime: new Date(),
          lastSyncStatus: 'SYNCED',
        },
        update: {
          stravaAthleteId: BigInt(athleteId),
          accessToken: this.encryptToken(data.access_token),
          refreshToken: this.encryptToken(data.refresh_token),
          expiresAt: new Date(data.expires_at * 1000),
          scope: scope || 'read,activity:read_all',
          status: 'SYNCED',
          lastSyncTime: new Date(),
          lastSyncStatus: 'SYNCED',
        },
      });

      return {
        success: true,
        message: 'Strava connected successfully',
        athleteId: athleteId.toString(),
        athlete: data.athlete,
        status: integration.status,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Unexpected error during Strava OAuth exchange:`, error);
      throw new InternalServerErrorException('Failed to complete Strava authentication');
    }
  }

  /**
   * Retrieves an active, non-expired access token for the user.
   * If the current token is expired (or close to expiring), automatically refreshes it.
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const integration = await this.prisma.stravaIntegration.findUnique({
      where: { userId },
    });

    if (!integration) {
      throw new NotFoundException(`No Strava integration found for user ${userId}`);
    }

    if (integration.status === 'DISCONNECTED') {
      throw new BadRequestException('Strava account is disconnected');
    }

    const fiveMinutes = 5 * 60 * 1000;
    const isExpiredOrExpiring =
      new Date(integration.expiresAt).getTime() - Date.now() < fiveMinutes;

    if (!isExpiredOrExpiring) {
      return this.decryptToken(integration.accessToken);
    }

    this.logger.log(`Refreshing Strava token for user ${userId}`);
    try {
      const response = await fetch('https://www.strava.com/api/v3/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: this.decryptToken(integration.refreshToken),
        }),
      });

      const data = (await response.json()) as StravaTokenResponse & { message?: string };

      if (!response.ok) {
        this.logger.error(`Failed to refresh Strava token: ${JSON.stringify(data)}`);
        await this.prisma.stravaIntegration.update({
          where: { userId },
          data: { status: 'ERROR', lastSyncStatus: 'REFRESH_FAILED' },
        });
        throw new BadRequestException('Failed to refresh Strava access token');
      }

      await this.prisma.stravaIntegration.update({
        where: { userId },
        data: {
          accessToken: this.encryptToken(data.access_token),
          refreshToken: this.encryptToken(data.refresh_token),
          expiresAt: new Date(data.expires_at * 1000),
          status: 'SYNCED',
        },
      });

      return data.access_token;
    } catch (error) {
      this.logger.error(`Token refresh error:`, error);
      throw error;
    }
  }

  /**
   * Syncs athlete activities from Strava API into the database.
   * Supports pagination and filtering.
   */
  async syncAthleteActivities(
    userId: string,
    options?: { page?: number; perPage?: number; after?: number; before?: number },
  ) {
    const accessToken = await this.getValidAccessToken(userId);
    const page = options?.page || 1;
    const perPage = options?.perPage || 30;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });

    if (options?.after) {
      queryParams.append('after', options.after.toString());
    }
    if (options?.before) {
      queryParams.append('before', options.before.toString());
    }

    this.logger.log(`Fetching Strava activities for user ${userId}: page=${page}, per_page=${perPage}`);

    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      this.logger.error(`Failed to fetch activities from Strava: ${JSON.stringify(errorData)}`);
      throw new BadRequestException('Failed to fetch activities from Strava');
    }

    const rawActivities = (await response.json()) as StravaRawActivity[];
    let syncedCount = 0;
    const savedActivities = [];

    for (const raw of rawActivities) {
      const sportType = this.mapSportType(raw.sport_type || raw.type);
      
      // Calculate average pace in seconds per kilometer
      const distanceKm = raw.distance / 1000;
      const avgPaceSecKm =
        distanceKm > 0 && raw.moving_time > 0
          ? Math.round(raw.moving_time / distanceKm)
          : null;

      const activity = await this.prisma.activity.upsert({
        where: { stravaActivityId: BigInt(raw.id) },
        create: {
          userId,
          stravaActivityId: BigInt(raw.id),
          title: raw.name,
          sportType,
          distanceMeters: raw.distance,
          movingTimeSec: raw.moving_time,
          elapsedTimeSec: raw.elapsed_time,
          totalElevationGain: raw.total_elevation_gain ?? null,
          avgPaceSecKm,
          avgHeartRate: raw.average_heartrate ? Math.round(raw.average_heartrate) : null,
          maxHeartRate: raw.max_heartrate ? Math.round(raw.max_heartrate) : null,
          cadence: raw.average_cadence ?? null,
          calories: raw.calories ?? null,
          startedAt: new Date(raw.start_date),
          isManual: Boolean(raw.manual),
          polyline: raw.map?.summary_polyline ?? null,
        },
        update: {
          title: raw.name,
          sportType,
          distanceMeters: raw.distance,
          movingTimeSec: raw.moving_time,
          elapsedTimeSec: raw.elapsed_time,
          totalElevationGain: raw.total_elevation_gain ?? null,
          avgPaceSecKm,
          avgHeartRate: raw.average_heartrate ? Math.round(raw.average_heartrate) : null,
          maxHeartRate: raw.max_heartrate ? Math.round(raw.max_heartrate) : null,
          cadence: raw.average_cadence ?? null,
          calories: raw.calories ?? null,
          startedAt: new Date(raw.start_date),
          isManual: Boolean(raw.manual),
          polyline: raw.map?.summary_polyline ?? null,
        },
      });

      syncedCount++;
      savedActivities.push({
        id: activity.id,
        stravaActivityId: raw.id.toString(),
        title: activity.title,
        sportType: activity.sportType,
        distanceMeters: activity.distanceMeters,
        distanceKm: Number((activity.distanceMeters / 1000).toFixed(2)),
        movingTimeSec: activity.movingTimeSec,
        avgPaceSecKm: activity.avgPaceSecKm,
        startedAt: activity.startedAt,
      });
    }

    // Update last sync time
    await this.prisma.stravaIntegration.update({
      where: { userId },
      data: {
        lastSyncTime: new Date(),
        lastSyncStatus: 'SYNCED',
        status: 'SYNCED',
      },
    });

    return {
      success: true,
      syncedCount,
      page,
      activities: savedActivities,
    };
  }

  /**
   * Retrieves stored activities for a user with pagination.
   */
  async getUserActivities(userId: string, limit = 20, offset = 0) {
    const [total, activities] = await Promise.all([
      this.prisma.activity.count({ where: { userId } }),
      this.prisma.activity.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    const formatted = activities.map((act) => ({
      ...act,
      stravaActivityId: act.stravaActivityId.toString(),
      distanceKm: Number((act.distanceMeters / 1000).toFixed(2)),
      paceFormatted: this.formatPace(act.avgPaceSecKm),
    }));

    return {
      total,
      limit,
      offset,
      data: formatted,
    };
  }

  /**
   * Deauthorizes and disconnects the Strava account.
   */
  async disconnect(userId: string) {
    const integration = await this.prisma.stravaIntegration.findUnique({
      where: { userId },
    });

    if (!integration) {
      throw new NotFoundException(`No Strava connection found for user ${userId}`);
    }

    try {
      await fetch('https://www.strava.com/oauth/deauthorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: this.decryptToken(integration.accessToken),
        }),
      });
    } catch (e) {
      this.logger.warn(`Strava deauthorize endpoint call failed: ${e}`);
    }

    await this.prisma.stravaIntegration.update({
      where: { userId },
      data: {
        status: 'DISCONNECTED',
        lastSyncStatus: 'DISCONNECTED',
      },
    });

    return { success: true, message: 'Strava account disconnected' };
  }

  /**
   * Retrieves current connection status for a user.
   */
  async getStatus(userId: string) {
    const integration = await this.prisma.stravaIntegration.findUnique({
      where: { userId },
    });

    if (!integration) {
      return {
        connected: false,
        status: 'DISCONNECTED',
      };
    }

    const activityCount = await this.prisma.activity.count({
      where: { userId },
    });

    return {
      connected: integration.status !== 'DISCONNECTED',
      status: integration.status,
      stravaAthleteId: integration.stravaAthleteId.toString(),
      activityCount,
      lastSyncTime: integration.lastSyncTime,
      lastSyncStatus: integration.lastSyncStatus,
    };
  }

  /**
   * Handles incoming Strava Webhook events (real-time sync).
   */
  async handleWebhookEvent(event: StravaWebhookEvent) {
    this.logger.log(`Strava Webhook received: ${event.object_type}:${event.aspect_type} for owner ${event.owner_id}`);

    // Verify subscription ID if configured
    if (this.webhookSubscriptionId && String(event.subscription_id) !== this.webhookSubscriptionId) {
      this.logger.warn(`Rejected webhook with invalid subscription_id: ${event.subscription_id}`);
      return { received: false, error: 'Invalid subscription ID' };
    }

    const integration = await this.prisma.stravaIntegration.findUnique({
      where: { stravaAthleteId: BigInt(event.owner_id) },
    });

    if (!integration) {
      this.logger.warn(`Webhook received for unregistered athlete ID ${event.owner_id}`);
      return { received: true, ignored: true };
    }

    if (event.object_type === 'athlete' && event.aspect_type === 'update') {
      if (event.updates?.authorized === 'false') {
        // Prevent stale or replayed events from reversing recent reconnects
        const eventTimeMs = event.event_time ? event.event_time * 1000 : 0;
        const integrationUpdatedMs = integration.updatedAt ? new Date(integration.updatedAt).getTime() : 0;
        if (eventTimeMs && integrationUpdatedMs && eventTimeMs < integrationUpdatedMs - 60000) {
          this.logger.warn(
            `Ignored stale athlete deauthorization event for owner ${event.owner_id} (event: ${eventTimeMs}, updatedAt: ${integrationUpdatedMs})`,
          );
          return { received: true, ignored: true };
        }
        await this.disconnect(integration.userId);
      }
      return { received: true };
    }

    if (event.object_type === 'activity') {
      if (event.aspect_type === 'delete') {
        // Owner-scoped deletion predicate: only delete activities belonging to the verified owner integration
        await this.prisma.activity.deleteMany({
          where: {
            stravaActivityId: BigInt(event.object_id),
            userId: integration.userId,
          },
        });
        this.logger.log(`Deleted activity ${event.object_id} for user ${integration.userId} via webhook`);
      } else if (event.aspect_type === 'create' || event.aspect_type === 'update') {
        // Fetch specific activity details
        await this.syncSingleActivity(integration.userId, event.object_id);
      }
    }

    return { received: true };
  }

  /**
   * Fetches and saves a single activity by Strava ID.
   */
  async syncSingleActivity(userId: string, stravaActivityId: number) {
    const accessToken = await this.getValidAccessToken(userId);

    const response = await fetch(`https://www.strava.com/api/v3/activities/${stravaActivityId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      this.logger.error(`Failed to fetch single activity ${stravaActivityId} from Strava`);
      return null;
    }

    const raw = (await response.json()) as StravaRawActivity;
    const sportType = this.mapSportType(raw.sport_type || raw.type);
    const distanceKm = raw.distance / 1000;
    const avgPaceSecKm =
      distanceKm > 0 && raw.moving_time > 0 ? Math.round(raw.moving_time / distanceKm) : null;

    return await this.prisma.activity.upsert({
      where: { stravaActivityId: BigInt(raw.id) },
      create: {
        userId,
        stravaActivityId: BigInt(raw.id),
        title: raw.name,
        sportType,
        distanceMeters: raw.distance,
        movingTimeSec: raw.moving_time,
        elapsedTimeSec: raw.elapsed_time,
        totalElevationGain: raw.total_elevation_gain ?? null,
        avgPaceSecKm,
        avgHeartRate: raw.average_heartrate ? Math.round(raw.average_heartrate) : null,
        maxHeartRate: raw.max_heartrate ? Math.round(raw.max_heartrate) : null,
        cadence: raw.average_cadence ?? null,
        calories: raw.calories ?? null,
        startedAt: new Date(raw.start_date),
        isManual: Boolean(raw.manual),
        polyline: raw.map?.summary_polyline ?? null,
      },
      update: {
        title: raw.name,
        sportType,
        distanceMeters: raw.distance,
        movingTimeSec: raw.moving_time,
        elapsedTimeSec: raw.elapsed_time,
        totalElevationGain: raw.total_elevation_gain ?? null,
        avgPaceSecKm,
        avgHeartRate: raw.average_heartrate ? Math.round(raw.average_heartrate) : null,
        maxHeartRate: raw.max_heartrate ? Math.round(raw.max_heartrate) : null,
        cadence: raw.average_cadence ?? null,
        calories: raw.calories ?? null,
        startedAt: new Date(raw.start_date),
        isManual: Boolean(raw.manual),
        polyline: raw.map?.summary_polyline ?? null,
      },
    });
  }

  /**
   * Validates webhook subscription challenge from Strava.
   */
  validateWebhookChallenge(mode: string, token: string, challenge: string) {
    if (mode === 'subscribe' && token === this.webhookVerifyToken) {
      return { 'hub.challenge': challenge };
    }
    throw new BadRequestException('Invalid webhook verification token');
  }

  private mapSportType(type: string): SportType {
    const cleanType = (type || '').toLowerCase();
    if (cleanType.includes('trail')) return SportType.TRAIL_RUN;
    if (cleanType.includes('treadmill')) return SportType.TREADMILL_RUN;
    if (cleanType.includes('run')) return SportType.RUN;
    if (cleanType.includes('walk')) return SportType.WALK;
    if (cleanType.includes('hike')) return SportType.HIKE;
    return SportType.OTHER;
  }

  private formatPace(paceSecKm: number | null): string | null {
    if (!paceSecKm || paceSecKm <= 0) return null;
    const mins = Math.floor(paceSecKm / 60);
    const secs = Math.floor(paceSecKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')} /km`;
  }
}
