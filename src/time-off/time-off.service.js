const {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject
} = require('@nestjs/common');
const { InjectRepository } = require('@nestjs/typeorm');
const { TimeOffRequest } = require('../entities/time-off-request.entity');
const { BalanceService } = require('../balance/balance.service');
const { EmployeeService } = require('../employee/employee.service');

class TimeOffService {
  constructor(requestRepo, balanceService, employeeService) {
    this.requestRepo = requestRepo;
    this.balanceService = balanceService;
    this.employeeService = employeeService;
  }

  async findAll() {
    return this.requestRepo.find();
  }

  async findById(id) {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException(`TimeOffRequest ${id} not found`);
    return request;
  }

  async findByEmployee(employeeId) {
    return this.requestRepo.find({ where: { employeeId } });
  }

  // Employee submits a new time-off request
  async createRequest(employeeId, { leaveType, startDate, endDate, days, reason }) {
    // 1. Ensure employee exists
    await this.employeeService.findById(employeeId);

    // 2. Validate balance is sufficient (local check — no HCM yet)
    await this.balanceService.validateSufficientBalance(employeeId, leaveType, days);

    // 3. Check for overlapping pending/approved requests
    const overlap = await this.requestRepo
      .createQueryBuilder('r')
      .where('r.employeeId = :employeeId', { employeeId })
      .andWhere('r.status IN (:...statuses)', { statuses: ['pending', 'approved'] })
      .andWhere('r.startDate <= :endDate', { endDate })
      .andWhere('r.endDate >= :startDate', { startDate })
      .getOne();

    if (overlap) {
      throw new BadRequestException(
        `Request overlaps with an existing ${overlap.status} request (ID: ${overlap.id})`,
      );
    }

    // 4. Save the request
    const request = this.requestRepo.create({
      employeeId,
      leaveType,
      startDate,
      endDate,
      days,
      reason,
      status: 'pending',
    });

    return this.requestRepo.save(request);
  }

  // Manager approves a request
  async approveRequest(requestId, managerId) {
    const request = await this.findById(requestId);

    if (request.status !== 'pending') {
      throw new BadRequestException(`Only pending requests can be approved`);
    }

    if (!managerId) {
      throw new BadRequestException('Manager id is required');
    }

    // Deduct balance at approval time
    await this.balanceService.deductBalance(
      request.employeeId,
      request.leaveType,
      request.days,
    );

    await this.requestRepo.update(requestId, {
      status: 'approved',
      reviewedBy: managerId,
      reviewedAt: new Date(),
    });

    return this.findById(requestId);
  }

  // Manager rejects a request
  async rejectRequest(requestId, managerId, rejectionNote) {
    const request = await this.findById(requestId);

    if (request.status !== 'pending') {
      throw new BadRequestException(`Only pending requests can be rejected`);
    }

    if (!managerId) {
      throw new BadRequestException('Manager id is required');
    }

    await this.requestRepo.update(requestId, {
      status: 'rejected',
      reviewedBy: managerId,
      reviewedAt: new Date(),
      rejectionNote,
    });

    return this.findById(requestId);
  }

  // Employee cancels their own request
  async cancelRequest(requestId, employeeId) {
    const request = await this.findById(requestId);

    if (request.employeeId !== employeeId) {
      throw new ForbiddenException(`You can only cancel your own requests`);
    }

    if (!['pending', 'approved'].includes(request.status)) {
      throw new BadRequestException(`Only pending or approved requests can be cancelled`);
    }

    // Restore balance if request was already approved
    if (request.status === 'approved') {
      await this.balanceService.restoreBalance(
        request.employeeId,
        request.leaveType,
        request.days,
      );
    }

    await this.requestRepo.update(requestId, { status: 'cancelled' });

    return this.findById(requestId);
  }
}

Injectable()(TimeOffService);

InjectRepository(TimeOffRequest)(TimeOffService, undefined, 0);
Inject(BalanceService)(TimeOffService, undefined, 1);
Inject(EmployeeService)(TimeOffService, undefined, 2);

module.exports = { TimeOffService };
