import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service.js';
import { DepositDto } from './dto/deposit.dto.js';
import { TransactionQueryDto } from './dto/transaction-query.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/Enums/index.js';
import { CurrentUser } from '../common/decorators/index.js';
import { currentUserDto } from '../user/dto/currentUserDto.js';
import { AdminTransactionQueryDto } from './dto/admin-transaction-query.dto.js';

@Controller('wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @Roles(UserRole.CLIENT, UserRole.FREELANCER, UserRole.ADMIN)
  getMyWallet(@CurrentUser() currentUser: currentUserDto) {
    return this.walletService.getMyWallet(currentUser);
  }

  @Get('transactions')
  @Roles(UserRole.CLIENT, UserRole.FREELANCER, UserRole.ADMIN)
  findMyTransactions(@Query() query: TransactionQueryDto, @CurrentUser() currentUser: currentUserDto) {
    return this.walletService.findMyTransactions(query, currentUser);
  }

  @Post('deposit')
  @Roles(UserRole.CLIENT)
  deposit(@Body() dto: DepositDto, @CurrentUser() currentUser: currentUserDto) {
    return this.walletService.deposit(dto, currentUser);
  }

  @Get('admin/transactions')
  @Roles(UserRole.ADMIN)
  findAllTransactions(@Query() query: AdminTransactionQueryDto) {
    return this.walletService.findAllTransactions(query);
  }

  @Get('admin/dashboard')
  @Roles(UserRole.ADMIN)
  getAdminDashboard() {
    return this.walletService.getAdminDashboard();
  }
}
