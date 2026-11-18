import { Controller, Body, Get, Patch, Param, UseGuards, ParseIntPipe, Query } from '@nestjs/common';
import { UserService } from './user.service.js';
import { UserRole } from '../common/Enums/index.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { BanUserDto } from './dto/ban-user.dto.js';
import { AdminUserQueryDto } from './dto/admin-user-query.dto.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Roles(UserRole.ADMIN)
  @Patch(':id/ban')
  banUser(@Param('id',ParseIntPipe) id: number, @Body() dto: BanUserDto) {
    return this.userService.banUser(id, dto);
  }


  @Roles(UserRole.ADMIN)
  @Get('admin')
  findAllForAdmin(@Query() query: AdminUserQueryDto) {
    return this.userService.findAllForAdmin(query);
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/overview')
  getAdminOverview() {
    return this.userService.getAdminOverview();
  }
}
