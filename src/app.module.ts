import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UserModule } from './user/user.module.js';
import { FreelancerProfileModule } from './freelancer-profile/freelancer-profile.module.js';
import { CategoryModule } from './category/category.module.js';
import { ProjectModule } from './project/project.module.js';
import { ProposalModule } from './proposal/proposal.module.js';
import { WalletModule } from './wallet/wallet.module.js';
import { DeliveryModule } from './delivery/delivery.module.js';
import { ThrottlerModule,ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';

@Module({
  imports: [
    ConfigModule.forRoot({
    isGlobal:true,
    envFilePath: '.env',
}),
    CacheModule.registerAsync({
  isGlobal: true,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    stores: [createKeyv(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379')],
    ttl: 5 * 60 * 1000,
  }),
}),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]), 
    PrismaModule,
    UserModule,
    AuthModule,
    FreelancerProfileModule,
    CategoryModule,
    ProjectModule,
    ProposalModule,
    WalletModule,
    DeliveryModule
  ],
  controllers: [AppController],
  providers:[
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ] 
}
)

export class AppModule {}
