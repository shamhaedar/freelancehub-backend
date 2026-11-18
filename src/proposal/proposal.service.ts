import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProposalDto } from './dto/create-proposal.dto.js';
import { UpdateProposalDto } from './dto/update-proposal.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { currentUserDto } from '../user/dto/currentUserDto.js';
import { ProjectStatus, ProposalStatus, TransactionType } from '../common/Enums/index.js';

@Injectable()
export class ProposalService {
  constructor(private readonly prisma:PrismaService){}

  async create(dto: CreateProposalDto, currentUser: currentUserDto) {
  try {
    return await this.prisma.$transaction(async (tx) => {
       const rows = await tx.$queryRaw<{ ownerId: number; status: ProjectStatus }[]>`
        SELECT "ownerId", "status"
        FROM "Project"
        WHERE "id" = ${dto.projectId}
        FOR SHARE
      `;
      const project = rows[0];

      if (!project) {
        throw new NotFoundException('Project not found');
      }
      if (project.ownerId === currentUser.userId) {
        throw new ForbiddenException('You cannot submit a proposal on your own project');
      }
      if (project.status !== ProjectStatus.OPEN) {
        throw new ConflictException('Proposals can only be submitted on open projects');
      }

      return tx.proposal.create({
        data: {
          projectId: dto.projectId,
          freelancerId: currentUser.userId,
          price: dto.price,
          durationDays: dto.durationDays,
          message: dto.message,
        },
        include: { project: { select: { id: true, title: true } } },
      });
    });
  } catch (error) {
    if (this.isPrismaError(error, 'P2002')) {
      throw new ConflictException('You have already submitted a proposal on this project');
    }
    throw error;
  }
}

  async findAllMyProposals(currentUser:currentUserDto)
  {
    return this.prisma.proposal.findMany({
      where:{freelancerId:currentUser.userId},
      orderBy: {createdAt: 'desc'},
      include: {
        project: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    })
  }

  async findByProject(projectId: number,currentUser: currentUserDto)
  {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        ownerId: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== currentUser.userId) {
      throw new ForbiddenException('You can only view proposals on your own projects');
    }

    const proposals = await this.prisma.proposal.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        freelancer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      project: {id: project.id,title: project.title},
      totalProposals: proposals.length,
      proposals,
    };
  }

  async findOne(id: number , currentUser:currentUserDto) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        freelancer: {
          select: {
            id: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            status: true,
            ownerId: true,
          },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.freelancerId !== currentUser.userId &&
      proposal.project.ownerId !== currentUser.userId)
    {
      throw new ForbiddenException('You are not authorized to view this proposal');
    }

    return proposal;
  }

  async update(id: number,dto: UpdateProposalDto,currentUser: currentUserDto) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.freelancerId !== currentUser.userId) {
      throw new ForbiddenException(
        'You can only update your own proposals',
      );
    }

    if (proposal.status !== ProposalStatus.PENDING) {
      throw new ConflictException(
        'Only pending proposals can be updated',
      );
    }

    const updated = await this.prisma.proposal.updateMany({
      where: { id, status: ProposalStatus.PENDING },
      data: {
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.durationDays !== undefined && { durationDays: dto.durationDays }),
        ...(dto.message !== undefined && { message: dto.message }),
      },
    });

    if (updated.count === 0) {
      throw new ConflictException(
        'Only pending proposals can be updated',
      );
    }

    return this.prisma.proposal.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }
async accept(id: number, currentUser: currentUserDto) {
 
  return this.prisma.$transaction(async (tx) => {
    const found = await tx.proposal.findUnique({
      where: { id },
      select: { projectId: true },
    });
    if (!found) {
      throw new NotFoundException('Proposal not found');
    }

   
    const projects = await tx.$queryRaw<{ ownerId: number; status: ProjectStatus }[]>`
      SELECT "ownerId", "status"
      FROM "Project"
      WHERE "id" = ${found.projectId}
      FOR UPDATE
    `;
    const project = projects[0];

    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.ownerId !== currentUser.userId) {
      throw new ForbiddenException('You can only accept proposals on your own projects');
    }
    if (project.status !== ProjectStatus.OPEN) {
      throw new ConflictException('This project is no longer open');
    }

   
    const proposal = await tx.proposal.findUnique({
      where: { id },
      select: {
        price: true,
        status: true,
        freelancer: { select: { isBanned: true } },
      },
    });
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }
    if (proposal.status !== ProposalStatus.PENDING) {
      throw new ConflictException('Only pending proposals can be accepted');
    }
    if (proposal.freelancer.isBanned) {
      throw new ConflictException('This freelancer is no longer active on the platform');
    }

  
    const debit = await tx.wallet.updateMany({
      where: { userId: currentUser.userId, balance: { gte: proposal.price } },
      data: { balance: { decrement: proposal.price } },
    });
    if (debit.count === 0) {
      throw new BadRequestException('Your wallet balance is not enough to accept this proposal');
    }

    const wallet = await tx.wallet.findUniqueOrThrow({
      where: { userId: currentUser.userId },
      select: { id: true },
    });

   
    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        projectId: found.projectId,
        type: TransactionType.HOLD,
        amount: proposal.price,
      },
    });

    const accepted = await tx.proposal.updateMany({
      where: { id, status: ProposalStatus.PENDING, price: proposal.price },
      data: { status: ProposalStatus.ACCEPTED },
    });
    if (accepted.count === 0) {
      throw new ConflictException('The proposal was modified. Please review it and try again');
    }

    await tx.proposal.updateMany({
      where: { projectId: found.projectId, id: { not: id } },
      data: { status: ProposalStatus.REJECTED },
    });

   
    const updatedProject = await tx.project.updateMany({
      where: { id: found.projectId, status: ProjectStatus.OPEN },
      data: { status: ProjectStatus.IN_PROGRESS, escrowAmount: proposal.price },
    });
    if (updatedProject.count === 0) {
      throw new ConflictException('This project is no longer open');
    }

    return tx.proposal.findUnique({
      where: { id },
      include: {
        freelancer: { select: { id: true, name: true } },
        project: { select: { id: true, title: true, status: true } },
      },
    });
  }, {
    isolationLevel: 'ReadCommitted',
    maxWait: 5_000,
    timeout: 10_000,
  });
}
  

  private isPrismaError(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === code
    );
  }
}
