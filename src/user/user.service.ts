import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TransactionType, UserRole } from '../common/Enums/index.js';
import { BanUserDto } from './dto/ban-user.dto.js';
import { AdminUserQueryDto } from './dto/admin-user-query.dto.js';

@Injectable()
export class UserService {
  
  constructor(private readonly prisma: PrismaService) {}

  async findAllForAdmin(query: AdminUserQueryDto) {
  const where = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.isBanned !== undefined ? { isBanned: query.isBanned } : {}),
  };

  const users = await this.prisma.user.findMany({
    where,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    take: query.limit + 1,
    orderBy: { id: 'asc' },
    omit: { password: true },
  });

  const hasNextPage = users.length > query.limit;
  const data = hasNextPage ? users.slice(0, query.limit) : users;

  return {
    data,
    meta: {
      limit: query.limit,
      nextCursor: hasNextPage ? data[data.length - 1]?.id ?? null : null,
      hasNextPage,
    },
  };
}
  async banUser(id: number, dto: BanUserDto)
  {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user)
    {
      throw new NotFoundException('user not found')
    }

    if (user.role === UserRole.ADMIN)
    {
      throw new ForbiddenException('Admins cannot be banned');
    }

    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { isBanned: dto.isBanned },
        omit: { password: true },
      }),
     
      this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return updatedUser;
  }
 

  async getAdminOverview() {
    const [usersByRole, bannedUsers, projects, transactions] =
      await this.prisma.$transaction([
        this.prisma.user.groupBy({
          by: ['role'],
          _count: { _all: true },
        }),
        this.prisma.user.count({ where: { isBanned: true } }),
        this.prisma.project.count(),
        this.prisma.transaction.groupBy({
          by: ['type'],
          _count: { _all: true },
          _sum: { amount: true },
        }),
      ]);

    return {
      users: {
        byRole: usersByRole,
        banned: bannedUsers,
      },
      projects,
      transactions,
      revenue:
        transactions.find((transaction) => transaction.type === TransactionType.COMMISSION)?._sum.amount ?? 0,
    };
  }
}
