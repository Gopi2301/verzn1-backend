import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor.js';
import { validate } from './config/env.validation.js';
import supabaseConfig from './config/supabase.config.js';
import { PrismaModule } from './database/prisma.module.js';
import { AthletesModule } from './modules/athletes/athletes.module.js';
import { ClubsModule } from './modules/clubs/clubs.module.js';
import { CoachesModule } from './modules/coaches/coaches.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      load: [supabaseConfig],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AthletesModule,
    CoachesModule,
    ClubsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
  ],
})
export class AppModule { }
