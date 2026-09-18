import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    required: true,
    description: 'Email of the user',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: '123456',
    required: true,
    description: '6-digit OTP token received via email',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  token!: string;
}
