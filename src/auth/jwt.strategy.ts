import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service.js';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {

    constructor(private readonly configService: ConfigService,
        private readonly prisma: PrismaService) {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
            throw new Error('JWT_SECRET is missing from .env');
        }
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: secret
        });
    }
    async validate(payload: { sub?: number; sid?: number; type?: string }) {
        if (payload.type !== 'access' || !Number.isInteger(payload.sub) || !Number.isInteger(payload.sid)) {
            throw new UnauthorizedException();
        }
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, email: true, role: true, isBanned: true }
        });
        if (!user || user.isBanned) {
            throw new UnauthorizedException('Account is banned or does not exist');
        }
        const session = await this.prisma.session.findFirst({
            where: {
                id: payload.sid,
                userId: user.id,
                revokedAt: null,
                expiresAt: { gt: new Date() },
            },
            select: { id: true },
        });
        if (!session) {
            throw new UnauthorizedException('Session is expired or revoked');
        }
        return {
            userId: user.id,
            email: user.email,
            role: user.role,
            sid: session.id
        };
    }
}
