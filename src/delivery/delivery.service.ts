import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateDeliveryDto } from './dto/create-delivery.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { currentUserDto } from '../user/dto/currentUserDto.js';
import { ProjectStatus, ProposalStatus, TransactionType } from '../common/Enums/index.js';
import { Prisma } from '../generated/prisma/client.js';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

const FREELANCER_SHARE = '0.9';

@Injectable()
export class DeliveryService {

  constructor(private readonly prisma:PrismaService) {}

  async create(dto: CreateDeliveryDto,user: currentUserDto,file?: Express.Multer.File)
  {
    if (!file) {
      throw new BadRequestException('A PDF or ZIP file is required');
    }

    try {
      const project = await this.getProjectOrFail(dto.projectId);

      const acceptedProposal = project.proposals[0];

      if (!acceptedProposal || acceptedProposal.freelancerId !== user.userId) {
        throw new ForbiddenException(
          'Only the freelancer of this project can submit the delivery',
        );
      }

      if (project.status !== ProjectStatus.IN_PROGRESS) {
        throw new ConflictException(
          'Deliveries can only be submitted on projects in progress',
        );
      }

      const delivery = await this.prisma.delivery.create({
        data: {
          projectId: dto.projectId,
          fileUrl: path.posix.join(
            'uploads', 
            'private', 
            'deliveries', 
            file.filename),
        },
      });

      const { fileUrl: _fileUrl, ...safeDelivery } = delivery;
      return safeDelivery;

    } catch (error) {
      await this.removeUploadedFile(file);

      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException(
          'A delivery has already been submitted for this project',
        );
      }

      throw error;
    }
  }

  async findByProject(projectId: number,user: currentUserDto)
  {
    const project = await this.getProjectOrFail(projectId);

    this.checkProjectAccess(project, user);

    const delivery = await this.prisma.delivery.findUnique({
      where: { projectId },
    });

    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    const { fileUrl: _fileUrl, ...safeDelivery } = delivery;

    return safeDelivery;
  }

  async getFile(id: number, user: currentUserDto)
  {
    const delivery = await this.getDeliveryOrFail(id);

    this.checkProjectAccess(delivery.project, user);

    const fullPath = path.resolve(process.cwd(), delivery.fileUrl);

    if (
      !fullPath.startsWith(this.uploadDirectory + '\\') &&
      !fullPath.startsWith(this.uploadDirectory + '/')
    ) {
      throw new ForbiddenException('Invalid file path');
    }

    try {
      await fs.access(fullPath);
    } catch {
      throw new NotFoundException('Delivery file not found');
    }

    return {
      fullPath,
      filename: `delivery-project-${delivery.projectId}${path.extname(fullPath)}`,
    };
  }

  async approve(id: number, user: currentUserDto)
  {
    const delivery = await this.getDeliveryOrFail(id);

    if (delivery.project.ownerId !== user.userId) {
      throw new ForbiddenException(
        'Only the owner of the project can approve the delivery',
      );
    }

    const acceptedProposal = delivery.project.proposals[0];

    if (delivery.project.status !== ProjectStatus.IN_PROGRESS || !acceptedProposal) {
      throw new ConflictException('This project is not in progress');
    }

    const amount = delivery.project.escrowAmount;

    if (amount.lte(0)) {
      throw new ConflictException('There is no held amount for this project');
    }

    const payout = amount
      .mul(FREELANCER_SHARE)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
    const commission = amount.sub(payout);

     await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Project"
        WHERE "id" = ${delivery.projectId}
        FOR UPDATE
      `;

      await tx.$queryRaw`
        SELECT "id"
        FROM "Wallet"
        WHERE "userId" = ${acceptedProposal.freelancerId}
        FOR UPDATE
      `;
         const released = await tx.project.updateMany({
        where: {
          id: delivery.projectId,
          status: ProjectStatus.IN_PROGRESS,
          escrowAmount: amount,
        },
        data: {
          status: ProjectStatus.COMPLETED,
          escrowAmount: 0,
        },
      });

      if (released.count === 0) {
        throw new ConflictException('The delivery has already been approved');
      }

      
      const wallet = await tx.wallet.update({
        where: { userId: acceptedProposal.freelancerId },
        data: { balance: { increment: payout } },
        select: { id: true },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          projectId: delivery.projectId,
          type: TransactionType.PAYOUT,
          amount: payout,
        },
      });

    
      await tx.transaction.create({
        data: {
          projectId: delivery.projectId,
          type: TransactionType.COMMISSION,
          amount: commission,
        },
      });
    }, {
      isolationLevel: 'ReadCommitted',
      maxWait: 5_000,
      timeout: 10_000,
    });

    return {
      message: 'Delivery approved successfully',
      projectId: delivery.projectId,
      status: ProjectStatus.COMPLETED,
      freelancerAmount: payout.toString(),
      platformCommission: commission.toString(),
    };
  }

  private readonly uploadDirectory = path.resolve(
    process.cwd(),
    'uploads',
    'private',
    'deliveries',
  );

  private checkProjectAccess(project: {
    ownerId: number;
    proposals: { freelancerId: number }[];
  }, user: currentUserDto): void {

    if (project.ownerId === user.userId) return;

    if (project.proposals[0]?.freelancerId === user.userId) return;

    throw new ForbiddenException('You cannot access this delivery');
  }

  private async removeUploadedFile(file?: Express.Multer.File): Promise<void> {
    if (!file) return;

    try {
      await fs.unlink(file.path);
    } catch {
    }
  }

  private async getProjectOrFail(projectId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        proposals: {
          where: { status: ProposalStatus.ACCEPTED },
          select: { freelancerId: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private async getDeliveryOrFail(id: number) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            proposals: {
              where: { status: ProposalStatus.ACCEPTED },
              select: { freelancerId: true },
            },
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    return delivery;
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === code
    );
  }
  async reject(id: number, user: currentUserDto) {
  const delivery = await this.getDeliveryOrFail(id);

  if (delivery.project.ownerId !== user.userId) {
    throw new ForbiddenException('Only the owner of the project can reject the delivery');
  }

  await this.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${delivery.projectId} FOR UPDATE`;

    const removed = await tx.delivery.deleteMany({
      where: { id, project: { status: ProjectStatus.IN_PROGRESS, ownerId: user.userId } },
    });
    if (removed.count === 0) {
      throw new ConflictException('This delivery can no longer be rejected');
    }
  });

 
  const fullPath = path.resolve(process.cwd(), delivery.fileUrl);
  if (fullPath.startsWith(this.uploadDirectory + '\\') || fullPath.startsWith(this.uploadDirectory + '/')) {
    await fs.unlink(fullPath).catch(() => undefined);
  }

  return {
    message: 'Delivery rejected. The freelancer can submit a new one',
    projectId: delivery.projectId,
  };
}
}
