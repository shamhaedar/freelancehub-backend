import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { currentUserDto } from '../user/dto/currentUserDto.js';
import { DepositDto } from './dto/deposit.dto.js';
import { TransactionQueryDto } from './dto/transaction-query.dto.js';
import { TransactionType } from '../common/Enums/index.js';
import { AdminTransactionQueryDto } from './dto/admin-transaction-query.dto.js';

@Injectable()
export class WalletService {
  constructor(private readonly prisma:PrismaService){}

  async getMyWallet(currentUser: currentUserDto) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: currentUser.userId },
      select: {
        id: true,
        balance: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  async findMyTransactions(query: TransactionQueryDto, currentUser: currentUserDto) {
    const {page,limit} = query;
    const skip = (page - 1) * limit;

    const wallet = await this.getMyWallet(currentUser);
    const where = { walletId: wallet.id };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({where,skip,take: limit,orderBy: {createdAt: 'desc'}}),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async deposit(dto: DepositDto, currentUser: currentUserDto) {
    return this.prisma.$transaction(async (tx) => {
      const lockedWallet = await tx.$queryRaw<{ id: number }[]>`
        SELECT "id"
        FROM "Wallet"
        WHERE "userId" = ${currentUser.userId}
        FOR UPDATE
      `;
      const wallet = lockedWallet[0];
      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: dto.amount } },
        select: {
          id: true,
          balance: true,
        },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: TransactionType.DEPOSIT,
          amount: dto.amount,
        },
      });

      return updatedWallet;
    }, {
      isolationLevel: 'ReadCommitted',
      maxWait: 5_000,
      timeout: 10_000,
    });
  }

  async findAllTransactions(query: AdminTransactionQueryDto) {
    const where = query.type ? { type: query.type } : {};
    const transactions = await this.prisma.transaction.findMany({
      where,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        walletId: true,
        projectId: true,
        type: true,
        amount: true,
        createdAt: true,
        wallet: {
          select: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    const hasNextPage = transactions.length > query.limit;
    const data = hasNextPage ? transactions.slice(0, query.limit) : transactions;

    return {
      data,
      meta: {
        limit: query.limit,
        nextCursor: hasNextPage ? data[data.length - 1]?.id ?? null : null,
        hasNextPage,
      },
    };
  }

  async getAdminDashboard() {
    const [balances, transactions] = await this.prisma.$transaction([
      this.prisma.wallet.aggregate({ _sum: { balance: true } }),
      this.prisma.transaction.groupBy({
        by: ['type'],
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalWalletBalance: balances._sum.balance ?? 0,
      transactions,
      revenue:
        transactions.find((transaction) => transaction.type === TransactionType.COMMISSION)?._sum.amount ?? 0,
    };
  }
}
