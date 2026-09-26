import { Module } from '@nestjs/common';
import { StravaService } from './strava.service.js';
import { StravaController } from './strava.controller.js';

@Module({
  controllers: [StravaController],
  providers: [StravaService],
  exports: [StravaService],
})
export class StravaModule {}
