import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { basename, resolve } from 'path';
import { unlink } from 'fs/promises';
import { currentUserDto } from '../user/dto/currentUserDto.js';
import { UpdateFreelancerProfileDto } from './dto/update-freelancer-profile.dto.js';

@Injectable()
export class FreelancerProfileService {
  constructor(private readonly prisma:PrismaService){}

  async findOne(userId: number) {
    const profile = await this.prisma.freelancerProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Freelancer profile not found');
    }

    return profile;
  }

  async update(currentUser: currentUserDto, dto: UpdateFreelancerProfileDto, file?: Express.Multer.File) {
    const newImageUrl = this.getImageUrl(file);

    try {
      const existingProfile = await this.prisma.freelancerProfile.findUnique({
        where: { userId: currentUser.userId },
      });

      if (!existingProfile) {
        throw new NotFoundException('Freelancer profile not found');
      }

      const updatedProfile = await this.prisma.freelancerProfile.update({
        where: { userId: currentUser.userId },
        data: {
          ...(dto.bio !== undefined && { bio: dto.bio }),
          ...(dto.hourlyRate !== undefined && { hourlyRate: dto.hourlyRate }),
          ...(newImageUrl && { imageUrl: newImageUrl }),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Delete the previous image only after the database update succeeds.
      if (newImageUrl && existingProfile.imageUrl) {
        await this.removeImage(existingProfile.imageUrl).catch((error) => {
          console.error('Failed to remove replaced profile image', error);
        });
      }

      return updatedProfile;
    } catch (error) {
      // If updating fails, remove the newly uploaded image.
      if (newImageUrl) {
        await this.removeImage(newImageUrl).catch(() => undefined);
      }

      throw error;
    }
  }

  private getImageUrl(file?: Express.Multer.File): string | null {
    if (!file) return null;
    return `/uploads/profiles/${file.filename}`;
  }

  private async removeImage(imageUrl?: string | null): Promise<void> {

    if (!imageUrl?.startsWith('/uploads/profiles/')) return;

    const filename = basename(imageUrl);
    if (!filename || filename === '.' || filename === '..') return;

    const imagePath = resolve(
      process.cwd(),
      'uploads',
      'profiles',
      filename,
    );

    try {
      await unlink(imagePath);
    } catch (error) {
      // The image may already have been deleted.
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
}
