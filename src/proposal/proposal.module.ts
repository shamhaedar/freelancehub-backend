import { Module } from '@nestjs/common';
import { ProposalService } from './proposal.service.js';
import { ProposalController } from './proposal.controller.js';

@Module({
  controllers: [ProposalController],
  providers: [ProposalService],
})
export class ProposalModule {}
