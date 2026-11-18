import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { basename, resolve } from 'path';
import { unlink } from 'fs/promises';
import { currentUserDto } from '../user/dto/currentUserDto.js';
import { ProjectStatus, ProposalStatus,TransactionType, UserRole } from '../common/Enums/index.js';
import { ProjectQueryDto } from './dto/project-query.dto.js';
import { Prisma } from '../generated/prisma/client.js';


@Injectable()
export class ProjectService {
  constructor(private readonly prisma:PrismaService){}

  async create(dto: CreateProjectDto,currentUser:currentUserDto,
    file?: Express.Multer.File) 
  {
    const attachmentUrl = this.getAttachmentUrl(file);

    try {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
        select: { id: true },
      });

      if (!category) {
        throw new BadRequestException('Category not found');
      }

      return await this.prisma.project.create({
        data: {
          title: dto.title,
          description: dto.description,
          budget: dto.budget,
          categoryId: dto.categoryId,
          ownerId: currentUser.userId,
          attachmentUrl,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }
    catch (error) {
      if (attachmentUrl) {
        await this.removeAttachment(attachmentUrl).catch(() => undefined);
      }
      throw error;
    }
  }

  async findAll(query: ProjectQueryDto) {
   
    const where = this.buildWhere(query, { status: ProjectStatus.OPEN });
    return this.findPage(where, query);
  }

  async findMyProjects(query: ProjectQueryDto, currentUser: currentUserDto) {
    const where = this.buildWhere(query, { ownerId: currentUser.userId });
    return this.findPage(where, query);
  }

  async findOne(id: number, currentUser: currentUserDto) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

   
    if (project.status !== ProjectStatus.OPEN && currentUser.role !== UserRole.ADMIN
      && project.ownerId !== currentUser.userId) {
      const acceptedProposal = await this.prisma.proposal.findFirst({
        where: {
          projectId: id,
          status: ProposalStatus.ACCEPTED,
          freelancerId: currentUser.userId,
        },
        select: { id: true },
      });

      if (!acceptedProposal) {
        throw new ForbiddenException('You are not authorized to view this project');
      }
    }

    return project;
  }

  async update(id: number,currentUser:currentUserDto,dto: UpdateProjectDto,file?: Express.Multer.File) 
  {
    const newAttachmentUrl = this.getAttachmentUrl(file);

    try {
      const existingProject = await this.prisma.project.findUnique({
        where: { id },
      });

      if (!existingProject) {
        throw new NotFoundException('Project not found');
      }

      if (existingProject.ownerId !== currentUser.userId) {
        throw new ForbiddenException('You are not authorized to update this project');
      }

      if (existingProject.status !== ProjectStatus.OPEN) {
        throw new ConflictException('Only open projects can be updated');
      }

      if (dto.categoryId !== undefined) {
        const category = await this.prisma.category.findUnique({
          where: { id: dto.categoryId },
          select: { id: true },
        });

        if (!category) {
          throw new BadRequestException('Category not found');
        }
      }

      // The status is checked again inside the query, in case the project was accepted in the meantime.
      const updated = await this.prisma.project.updateMany({
        where: { id, status: ProjectStatus.OPEN },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.budget !== undefined && { budget: dto.budget }),
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
          ...(newAttachmentUrl && { attachmentUrl: newAttachmentUrl }),
        },
      });

      if (updated.count === 0) {
        throw new ConflictException('Only open projects can be updated');
      }

      // Delete the previous attachment only after the database update succeeds.
      if (newAttachmentUrl && existingProject.attachmentUrl) {
        await this.removeAttachment(existingProject.attachmentUrl).catch((error) => {
          console.error('Failed to remove replaced project attachment', error);
        });
      }

      return await this.prisma.project.findUnique({
        where: { id },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      // If updating fails, remove the newly uploaded attachment.
      if (newAttachmentUrl) {
        await this.removeAttachment(newAttachmentUrl).catch(() => undefined);
      }

      throw error;
    }
  }

  async remove(id: number,currentUser:currentUserDto) {
    const existingProject = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      throw new NotFoundException('Project not found');
    }

    if (existingProject.ownerId !== currentUser.userId) {
      throw new ForbiddenException('You are not authorized to delete this project');
    }

    if (existingProject.status !== ProjectStatus.OPEN) {
      throw new ConflictException('Only open projects can be deleted');
    }

    const deleted = await this.prisma.project.deleteMany({
      where: { id, status: ProjectStatus.OPEN },
    });

    if (deleted.count === 0) {
      throw new ConflictException('Only open projects can be deleted');
    }

    // Only remove the attachment after the database deletion succeeds.
    await this.removeAttachment(existingProject.attachmentUrl);
    return {
      message: 'Project deleted successfully',
    };
  }

  private buildWhere(query: ProjectQueryDto, base: Prisma.ProjectWhereInput): Prisma.ProjectWhereInput {
    const normalizedSearch = query.search?.trim() ?? '';

    return {
      ...base,
      ...(query.categoryId !== undefined && { categoryId: query.categoryId }),
      ...(normalizedSearch && {
        title: { contains: normalizedSearch, mode: 'insensitive' as const },
      }),
    };
  }

  private async findPage(where: Prisma.ProjectWhereInput, query: ProjectQueryDto) {
    const {page,limit,sortBy,sortOrder} = query;
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({where,skip,take: limit,orderBy: {[sortBy]: sortOrder},
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.project.count({ where }),
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

  private getAttachmentUrl(file?: Express.Multer.File): string | null {
    if (!file) return null;
    return `/uploads/projects/${file.filename}`;
  }

  private async removeAttachment(attachmentUrl?: string | null): Promise<void> {

    if (!attachmentUrl?.startsWith('/uploads/projects/')) return;

    const filename = basename(attachmentUrl);
    if (!filename || filename === '.' || filename === '..') return;

    const attachmentPath = resolve(
      process.cwd(),
      'uploads',
      'projects',
      filename,
    );

    try {
      await unlink(attachmentPath);
    } catch (error) {
      // The attachment may already have been deleted.
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return;
      }

      throw error;
    }
  }
  async cancel(id: number, currentUser: currentUserDto) {
  return this.prisma.$transaction(async (tx) => {
    
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${id} FOR UPDATE`;

    const project = await tx.project.findUnique({
      where: { id },
      include: {
        delivery: { select: { id: true } },
        proposals: {
          where: { status: ProposalStatus.ACCEPTED },
          select: {
            freelancerId: true,
            durationDays: true,
            freelancer: { select: { isBanned: true } },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const accepted = project.proposals[0];
    const isOwner = project.ownerId === currentUser.userId;
    const isFreelancer = accepted?.freelancerId === currentUser.userId;

    if (!isOwner && !isFreelancer) {
      throw new ForbiddenException('You are not authorized to cancel this project');
    }
    if (project.status !== ProjectStatus.IN_PROGRESS || !accepted) {
      throw new ConflictException('Only projects in progress can be cancelled');
    }
    if (project.delivery) {
      throw new ConflictException(
        'A delivery was already submitted. The owner must approve or reject it',
      );
    }

    if (isOwner) {
      const hold = await tx.transaction.findFirst({
        where: { projectId: id, type: TransactionType.HOLD },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      const deadline = hold
        ? new Date(hold.createdAt.getTime() + accepted.durationDays * 24 * 60 * 60 * 1000)
        : null;
      const overdue = deadline !== null && deadline < new Date();

      if (!accepted.freelancer.isBanned && !overdue) {
        throw new ConflictException(
          'You can cancel only after the freelancer deadline has passed, or if the freelancer is banned',
        );
      }
    }

    const amount = project.escrowAmount;
    if (amount.lte(0)) {
      throw new ConflictException('There is no held amount for this project');
    }

   
    const released = await tx.project.updateMany({
      where: { id, status: ProjectStatus.IN_PROGRESS, escrowAmount: amount },
      data: { status: ProjectStatus.CANCELLED, escrowAmount: 0 },
    });
    if (released.count === 0) {
      throw new ConflictException('The project state has changed. Please try again');
    }

    const wallet = await tx.wallet.update({
      where: { userId: project.ownerId },
      data: { balance: { increment: amount } },
      select: { id: true },
    });

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        projectId: id,
        type: TransactionType.REFUND,
        amount,
      },
    });

    return {
      message: 'Project cancelled and the held amount was refunded',
      projectId: id,
      status: ProjectStatus.CANCELLED,
      refundedAmount: amount.toString(),
    };
  }, {
    isolationLevel: 'ReadCommitted',
    maxWait: 5_000,
    timeout: 10_000,
  });
}
}
