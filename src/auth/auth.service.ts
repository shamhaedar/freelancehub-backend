import { ConflictException,BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAuthDto } from './dto/create-auth.dto.js';
import { LoginDto } from './dto/LoginDto.js';
import { createHash } from 'crypto';
import { UserRole } from '../common/Enums/index.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';



@Injectable()
export class AuthService {
    constructor(private readonly jwtService: JwtService,
        private readonly prisma:PrismaService) {}

    async login(loginDto:LoginDto)    
    {    
        const email = loginDto.email.trim().toLowerCase();
        const user = await this.prisma.user.findFirst({   
            where: {email}});

        if (!user)
        {
        throw new UnauthorizedException('Invalid Email or password');
        }

        const isPasswordValid = await bcrypt.compare
        (loginDto.password,user.password);
        if (!isPasswordValid)
        {     
        throw new UnauthorizedException('Invalid Email or password');
        }
        if (user.isBanned)
        {
        throw new ForbiddenException('Your account has been banned');
        }
        const session = await this.prisma.session.create({
            data:{
                userId:user.id,
                expiresAt:new Date(Date.now()+7*24*60*60*1000),
                refreshTokenHash:" "
            }
        });
        const tokens = await this.singnTokens(user,session.id);
        await this.saveRefreshHash(session.id,tokens.refresh_token);
        return tokens;
        }

    async register(createAuthDto:CreateAuthDto) {
         const email = createAuthDto.email.trim().toLowerCase();
         const existingUser = await this.prisma.user.findFirst({
            where: {
                   email
            },
        });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }


        const passwordHash = await bcrypt.hash(createAuthDto.password,10);
        const user=await this.prisma.user.create({
            data:{
                email,
                password:passwordHash,
                name:createAuthDto.name,
                role:createAuthDto.role,
                wallet:{create:{}},
                ...(createAuthDto.role === UserRole.FREELANCER && {profile:{create:{}}})
            },
            omit:{
                password:true
            }
        });

        return {message: 'User registered successfully',user};
 
    }

    async refreshToken(refreshToken:string){
        let payload: { sub: number; sid: number; type: string };
        try{
        payload=await this.jwtService.verifyAsync(refreshToken);
        } catch {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        if (payload.type !== 'refresh') {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        const session= await this.prisma.session.findUnique({
            where:{
                id:payload.sid
            }
        });
         if(!session || session.revokedAt!==null || session.expiresAt<new Date()){
            throw new UnauthorizedException();
        }
        if (session.refreshTokenHash !== this.hash(refreshToken)){
            await this.prisma.session.update({
                where:{
                    id:session.id
                },
                data:{revokedAt:new Date()}
            })
            throw new  UnauthorizedException()
        };
        const userId= Number(payload.sub)
        if (!Number.isInteger(userId) || userId <= 0) {
            throw new UnauthorizedException();
        }

        const existUser= await this.prisma.user.findUnique({
            where:{
                id:userId
            }
        })
        if (!existUser || existUser.isBanned){
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
        const tokens=await this.singnTokens(existUser,session.id);
        const rotated = await this.prisma.session.updateMany({
            where: {
                id: session.id,
                revokedAt: null,
                expiresAt: { gt: new Date() },
                refreshTokenHash: this.hash(refreshToken),
            },
            data: { refreshTokenHash: this.hash(tokens.refresh_token) },
        });
        if (rotated.count === 0) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
        return tokens;
    }

    async logout(userId:number,sid:number)
    {

        const result= await this.prisma.session.updateMany({
            where:{id:sid,userId,revokedAt:null,expiresAt:{gt:new Date()}},
            data:{
                revokedAt:  new Date()
            }
        })
        if (result.count===0)
        {
             throw new UnauthorizedException('Session is invalid or revoked');
        }
        return {
            message:'Logged out successfully'
        }
    };

    async getMyProfile(id:number)
    {
        const user=await this.prisma.user.findUnique({
            where:{
                id
            },
            omit:{
                password:true
            }
        })
        if (!user)
        {
            throw new NotFoundException("user not found")
        }
        return user;
    }

    async logoutOthers(userId:number,sid:number){
        const result=await this.prisma.session.updateMany({
            where:{
                userId, id:{not:sid},revokedAt:null
            },
            data:{
                revokedAt:new Date()
            }
        });
        return {
            message:"Other sessions logged out successfully",
            revokedSessions:result.count
        }
    }
    async changePassword(userId: number, sid: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, password: true },
    });
    if (!user) {
        throw new NotFoundException('user not found');
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) {
        throw new BadRequestException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
        throw new BadRequestException('New password must be different from the current one');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);

   
    await this.prisma.$transaction([
        this.prisma.user.update({
            where: { id: userId },
            data: { password: newHash },
        }),
        this.prisma.session.updateMany({
            where: { userId, id: { not: sid }, revokedAt: null },
            data: { revokedAt: new Date() },
        }),
    ]);

    return { message: 'Password changed successfully. Other devices were logged out' };
}


    private hash(token:string)
    {
        return createHash('sha256').update(token).digest('hex');
    }



    private async singnTokens( user:{ id: number; email: string; role: string}
        ,sid:number)
    {
        const[access_token,refresh_token]= await Promise.all([
            this.jwtService.signAsync(
                {
                  sub:user.id,
                  email:user.email,
                  role:user.role,
                  sid:sid,
                  type:'access'
                },
                {
                    expiresIn:'15m'
                }
            ),
            this.jwtService.signAsync({
                sub:user.id,
                sid:sid,
                type:'refresh'
            },
            {
                expiresIn:'7d'
            }
        )])
        return {access_token,refresh_token};
    }

    private saveRefreshHash(sid:number,token:string)
    {
    return this.prisma.session.update({
      where:{
        id:sid
      },
      data:{refreshTokenHash:this.hash(token)}
    });
    }
}