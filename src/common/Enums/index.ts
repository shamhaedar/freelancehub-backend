export enum UserRole {
    ADMIN = 'ADMIN',
    CLIENT = 'CLIENT',
    FREELANCER = 'FREELANCER'
}

export enum ProjectStatus {
    OPEN = 'OPEN',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED'
}

export enum ProposalStatus {
    PENDING = 'PENDING',
    ACCEPTED = 'ACCEPTED',
    REJECTED = 'REJECTED'
}

export enum TransactionType {
    DEPOSIT = 'DEPOSIT',
    HOLD = 'HOLD',
    PAYOUT = 'PAYOUT',
    COMMISSION = 'COMMISSION',
    REFUND = 'REFUND'
}
