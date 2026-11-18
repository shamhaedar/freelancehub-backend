import { Module } from '@nestjs/common';
import { FreelancerProfileService } from './freelancer-profile.service.js';
import { FreelancerProfileController } from './freelancer-profile.controller.js';

@Module({
  controllers: [FreelancerProfileController],
  providers: [FreelancerProfileService],
})
export class FreelancerProfileModule {}
