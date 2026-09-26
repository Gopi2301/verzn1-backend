import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UsersService } from "../users/users.service.js";
import { AuthService } from "./auth.service.js";
import { RefreshTokenDto } from "./refresh-token.dto.js";
import { SignInDto } from './sign-in.dto.js';
import { SignUpDto } from "./sign-up.dto.js";
import { VerifyOtpDto } from "./verify-otp.dto.js";

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService
    ) { }
    @Post('signup')
    @ApiOperation({
        summary: 'Register a new user',
        description: 'Creates a new user with the provided details'
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'User created successfully',
    })
    async signUp(@Body() body: SignUpDto) {
        return this.authService.signUp(body);
    }
    @Post('verify-otp')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Verify signup OTP token',
        description: 'Verifies the 6-digit email confirmation OTP code'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'OTP verified successfully and session returned',
    })
    async verifyOtp(@Body() body: VerifyOtpDto) {
        return this.authService.verifyOtp(body);
    }
    @Post('signin')
    @ApiOperation({
        summary: 'Sign in a user',
        description: 'Signs in a user with the provided credentials'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User signed in successfully',
    })
    async signIn(@Body() body: SignInDto) {
        return this.authService.signIn(body);
    }
    @Post('refresh')
    @ApiOperation({
        summary: 'Refresh the access token',
        description: 'Refreshes the access token with the provided refresh token'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Access token refreshed successfully',
    })
    async refreshToken(@Body() body: RefreshTokenDto) {
        return this.authService.refreshToken(body);
    }
    @Post('signout')
    async signOut(@Body() body: RefreshTokenDto) {
        return this.authService.signOut(body.refreshToken);
    }
}