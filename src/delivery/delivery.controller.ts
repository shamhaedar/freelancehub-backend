import { Controller, Get, Post, Body, Patch, Param, UseGuards, UseInterceptors, UploadedFile, ParseIntPipe, Res } from '@nestjs/common';
import { DeliveryService } from './delivery.service.js';
import { CreateDeliveryDto } from './dto/create-delivery.dto.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/Enums/index.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { deliveryMulterOptions } from './delivery.multer.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/index.js';
import { currentUserDto } from '../user/dto/currentUserDto.js';
import { CleanupUploadOnErrorInterceptor } from '../common/interceptors/cleanup-upload-on-error.interceptor.js';
import express from 'express';
import { ValidateUploadSignature } from '../common/interceptors/validate-upload-signature.interceptor.js';

@Controller('delivery')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Roles(UserRole.FREELANCER)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', deliveryMulterOptions),
    CleanupUploadOnErrorInterceptor,
    ValidateUploadSignature(['pdf', 'zip'], 'The file content is not a valid document')
  )
  create(@Body() dto: CreateDeliveryDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: currentUserDto,
  ) {
    return this.deliveryService.create(dto, user, file);
  }

  @Roles(UserRole.CLIENT, UserRole.FREELANCER)
  @Get('project/:projectId')
  findByProject(@Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: currentUserDto) {
    return this.deliveryService.findByProject(projectId, user);
  }

  @Roles(UserRole.CLIENT, UserRole.FREELANCER)
  @Get(':id/file')
  async downloadFile(@Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: currentUserDto, @Res() response: express.Response) {
    const file = await this.deliveryService.getFile(id, user);
    return response.download(file.fullPath, file.filename);
  }

  @Roles(UserRole.CLIENT)
  @Patch(':id/approve')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: currentUserDto,
  ) {
    return this.deliveryService.approve(id, user);
  }
  @Roles(UserRole.CLIENT)
@Patch(':id/reject')
reject(
  @Param('id', ParseIntPipe) id: number,
  @CurrentUser() user: currentUserDto,
) {
  return this.deliveryService.reject(id, user);
}
}