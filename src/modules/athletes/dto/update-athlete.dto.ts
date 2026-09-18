import { PartialType } from '@nestjs/swagger';
import { CreateAthleteDto } from './create-athlete.dto.js';

export class UpdateAthleteDto extends PartialType(CreateAthleteDto) {}
