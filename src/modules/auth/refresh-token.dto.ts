import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
    @ApiProperty({
        example: 'refresh-token',
        required: true,
        description: 'Refresh token'
    })
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}   