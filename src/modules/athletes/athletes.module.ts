import { Module } from '@nestjs/common';
import { AthletesController } from './athletes.controller.js';
import { AthletesService } from './athletes.service.js';

@Module({
  controllers: [AthletesController],
  providers: [AthletesService],
  exports: [AthletesService],
})
export class AthletesModule {}
