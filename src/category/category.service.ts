import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

const CATEGORIES_CACHE_KEY = 'categories:list';
const CATEGORIES_CACHE_TTL = 60 * 60 * 1000; // 1 hour

@Injectable()
export class CategoryService {
  constructor(private readonly prisma:PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ){}

  async create(dto: CreateCategoryDto) {
    try {
      const category = await this.prisma.category.create({
        data: { name: dto.name },
      });
      await this.cache.del(CATEGORIES_CACHE_KEY);
      return category;
    } catch (error) {
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException('Category name already exists');
      }
      throw error;
    }
  }

  async findAll() {
    const cached = await this.cache.get<any>(CATEGORIES_CACHE_KEY);

    if (cached !== undefined && cached !== null) {
      return cached;
    }

    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });

    await this.cache.set(CATEGORIES_CACHE_KEY, categories, CATEGORIES_CACHE_TTL);
    return categories;
  }

  async update(id: number, dto: UpdateCategoryDto) {
    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
        },
      });
      await this.cache.del(CATEGORIES_CACHE_KEY);
      return category;
    } catch (error) {
      if (this.isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Category not found');
      }
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException('Category name already exists');
      }
      throw error;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.category.delete({
        where: { id },
      });
    } catch (error) {
      if (this.isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Category not found');
      }
      if (this.isPrismaError(error, 'P2003')) {
        throw new ConflictException(
          'Cannot delete this category because it has related projects',
        );
      }
      throw error;
    }

    await this.cache.del(CATEGORIES_CACHE_KEY);
    return {
      message: 'Category deleted successfully',
    };
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
