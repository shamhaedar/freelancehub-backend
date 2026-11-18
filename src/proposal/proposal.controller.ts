import { Controller, Get, Post, Body, Patch, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ProposalService } from './proposal.service.js';
import { CreateProposalDto } from './dto/create-proposal.dto.js';
import { UpdateProposalDto } from './dto/update-proposal.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/Enums/index.js';
import { CurrentUser } from '../common/decorators/index.js';
import { currentUserDto } from '../user/dto/currentUserDto.js';

@Controller('proposal')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProposalController {
  constructor(private readonly proposalService: ProposalService) {}

  @Post()
  @Roles(UserRole.FREELANCER)
  create(
    @Body() dto: CreateProposalDto,
    @CurrentUser() currentUser: currentUserDto,
  ) {
    return this.proposalService.create(dto, currentUser);
  }

  @Get('myproposals')
  @Roles(UserRole.FREELANCER)
  findMyProposals(@CurrentUser() currentUser: currentUserDto)
  {
    return this.proposalService.findAllMyProposals(currentUser);
  }

  @Get('project/:projectId')
  @Roles(UserRole.CLIENT)
  findByProject(@Param('projectId', ParseIntPipe) projectId: number,@CurrentUser() currentUser: currentUserDto) 
  {
    return this.proposalService.findByProject(projectId,currentUser);
  }

  @Get(':id')
  @Roles(UserRole.CLIENT, UserRole.FREELANCER)
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: currentUserDto,
  ) {
    return this.proposalService.findOne(id, currentUser);
  }

  @Patch(':id')
  @Roles(UserRole.FREELANCER)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProposalDto,
    @CurrentUser() currentUser: currentUserDto,
  ) {
    return this.proposalService.update(id, dto, currentUser);
  }

  @Patch(':id/accept')
  @Roles(UserRole.CLIENT)
  accept(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: currentUserDto,
  ) {
    return this.proposalService.accept(id, currentUser);
  }
}
