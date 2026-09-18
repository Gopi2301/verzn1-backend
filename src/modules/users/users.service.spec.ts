import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, beforeEach, it, vi } from 'vitest';
import { PrismaService } from '../../database/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should create a new user if not existing', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'usr-1',
      email: 'runner@example.com',
      fullName: 'John Runner',
    });

    const result = await service.create({
      userId: 'usr-1',
      email: 'runner@example.com',
      firstName: 'John',
      lastName: 'Runner',
    });

    expect(result).toEqual({
      id: 'usr-1',
      email: 'runner@example.com',
      fullName: 'John Runner',
    });
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('should find user by id or throw NotFoundException', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
  });
});
