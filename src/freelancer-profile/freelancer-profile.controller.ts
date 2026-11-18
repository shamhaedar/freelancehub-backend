import { Controller, Get, Body, Patch, Param, UseGuards, UseInterceptors, UploadedFile, ParseIntPipe } from '@nestjs/common';
import { FreelancerProfileService } from './freelancer-profile.service.js';
import { UpdateFreelancerProfileDto } from './dto/update-freelancer-profile.dto.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { freelancerProfileMulterOptions } from './freelancer-profile.multer.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/Enums/index.js';
import { CurrentUser } from '../common/decorators/index.js';
import { currentUserDto } from '../user/dto/currentUserDto.js';
import { CleanupUploadOnErrorInterceptor } from '../common/interceptors/cleanup-upload-on-error.interceptor.js';
import { ValidateUploadSignature } from '../common/interceptors/validate-upload-signature.interceptor.js';

@Controller('freelancer-profile')
export class FreelancerProfileController {
  constructor(private readonly freelancerProfileService: FreelancerProfileService) {}

  @Get(':userId')
  findOne(@Param('userId', ParseIntPipe) userId: number) {
    return this.freelancerProfileService.findOne(userId);
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FREELANCER)
  @UseInterceptors(
    FileInterceptor('image', freelancerProfileMulterOptions),
    CleanupUploadOnErrorInterceptor,
    ValidateUploadSignature(['jpeg', 'png', 'webp'], 'The file content is not a valid image'),
  )
  update(@CurrentUser() currentUser: currentUserDto,
    @Body() dto: UpdateFreelancerProfileDto,
    @UploadedFile() file?: Express.Multer.File) {
    return this.freelancerProfileService.update(currentUser, dto, file);
  }
}