import { Test, TestingModule } from '@nestjs/testing';
import { StravaService } from './strava.service.js';

describe('StravaService', () => {
  let service: StravaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StravaService],
    }).compile();

    service = module.get<StravaService>(StravaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
