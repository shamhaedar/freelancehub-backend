import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, UseGuards, Query, ParseIntPipe } from '@nestjs/common';
import { ProjectService } from './project.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { projectMulterOptions } from './project.multer.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/Enums/index.js';
import { CurrentUser } from '../common/decorators/index.js';
import { currentUserDto } from '../user/dto/currentUserDto.js';
import { ProjectQueryDto } from './dto/project-query.dto.js';
import { ValidateUploadSignature } from '../common/interceptors/validate-upload-signature.interceptor.js';

@Controller('project')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @Roles(UserRole.CLIENT)
  @UseInterceptors(
    ValidateUploadSignature(['pdf', 'zip'], 'The file content is not a valid document')
  )
  create(@Body() dto: CreateProjectDto,@CurrentUser() currentUser: currentUserDto,
    @UploadedFile() file?: Express.Multer.File) 
  {
    return this.projectService.create(dto, currentUser, file);
  }

  @Get()
  @Roles(UserRole.CLIENT, UserRole.FREELANCER, UserRole.ADMIN)
  findAll(@Query() query: ProjectQueryDto) {
    return this.projectService.findAll(query);
  }

  @Get('myprojects')
  @Roles(UserRole.CLIENT)
  findMyProjects(@Query() query: ProjectQueryDto, @CurrentUser() currentUser: currentUserDto) {
    return this.projectService.findMyProjects(query, currentUser);
  }

  @Get(':id')
  @Roles(UserRole.CLIENT, UserRole.FREELANCER, UserRole.ADMIN)
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: currentUserDto) {
    return this.projectService.findOne(id, currentUser);
  }

  @Patch(':id')
  @Roles(UserRole.CLIENT)
  @UseInterceptors(
    ValidateUploadSignature(['pdf', 'zip'], 'The file content is not a valid document'),
    FileInterceptor('attachment', projectMulterOptions)
  )
  update(@Param('id', ParseIntPipe) id: number,@CurrentUser() currentUser: currentUserDto,
    @Body() dto: UpdateProjectDto,
    @UploadedFile() file?: Express.Multer.File) {
    return this.projectService.update(id, currentUser, dto, file);
  }

  @Delete(':id')
  @Roles(UserRole.CLIENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: currentUserDto,
  ) {
    return this.projectService.remove(id, currentUser);
  }
  @Patch(':id/cancel')
@Roles(UserRole.CLIENT, UserRole.FREELANCER)
cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: currentUserDto) {
  return this.projectService.cancel(id, currentUser);
}
}
