import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config"
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { UsersService } from "../users/users.service.js";
import { RefreshTokenDto } from "./refresh-token.dto.js";
import { SignInDto } from "./sign-in.dto.js";
import { SignUpDto } from "./sign-up.dto.js";
import { VerifyOtpDto } from "./verify-otp.dto.js";

@Injectable()
export class AuthService {
    private supabase: SupabaseClient;

    constructor(
        private readonly config: ConfigService,
        private readonly userService: UsersService
    ) {
        this.supabase = createClient(
            this.config.get<string>('SUPABASE_URL')!,
            this.config.get<string>('SUPABASE_SECRET')!
        );
    }

    async signUp(body: SignUpDto) {
        const { email, password, firstName, lastName, phone, role } = body;
        const {
            data: { user },
            error,
        } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
                data: { first_name: firstName, last_name: lastName, phone, role },
            },
        });

        if (error) throw new BadRequestException(error.message);

        if (user && user.identities && user.identities.length === 0) {
            throw new BadRequestException('User with this email already exists');
        }

        if (user) {
            await this.userService.create({
                email,
                firstName,
                lastName,
                phone,
                role,
                userId: user.id,
            });
        }

        return { message: 'User signed up successfully. Verification email/OTP sent.' };
    }

    async signIn(body: SignInDto) {
        const { email, password } = body;
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw new UnauthorizedException(error.message);
        return data;
    }

    async verifyOtp(body: VerifyOtpDto) {
        const { email, token } = body;
        const { data, error } = await this.supabase.auth.verifyOtp({
            email,
            token,
            type: 'signup',
        });

        if (error || !data.session) {
            throw new BadRequestException(error?.message || 'Invalid or expired OTP token');
        }

        return data;
    }
    async refreshToken(body: RefreshTokenDto) {
        const { refreshToken } = body;
        const { data, error } = await this.supabase.auth.refreshSession({
            refresh_token: refreshToken,
        });
        if (error) throw new UnauthorizedException(error.message);
        return data;
    }

    async signOut(accessToken: string) {
        const { error } = await this.supabase.auth.admin.signOut(accessToken);
        if (error) {
            await this.supabase.auth.signOut();
        }
        return {
            message: 'Loggedout successfully'
        }
    }
}