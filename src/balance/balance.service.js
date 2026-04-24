const { Injectable, NotFoundException, BadRequestException } = require('@nestjs/common');
const { InjectRepository } = require('@nestjs/typeorm');
const { Balance } = require('../entities/balance.entity');

class BalanceService {
  constructor(balanceRepo) {
    this.balanceRepo = balanceRepo;
  }

  async findByEmployee(employeeId) {
    return this.balanceRepo.find({ where: { employeeId } });
  }

  async findByEmployeeAndLeaveType(employeeId, leaveType) {
    const balance = await this.balanceRepo.findOne({
      where: { employeeId, leaveType },
    });
    if (!balance) {
      throw new NotFoundException(
        `No balance found for employee ${employeeId} with leave type "${leaveType}"`,
      );
    }
    return balance;
  }

  async create(data) {
    const balance = this.balanceRepo.create(data);
    return this.balanceRepo.save(balance);
  }

  async update(id, data) {
    const balance = await this.balanceRepo.findOne({ where: { id } });
    if (!balance) throw new NotFoundException(`Balance ${id} not found`);
    await this.balanceRepo.update(id, data);
    return this.balanceRepo.findOne({ where: { id } });
  }

  // Core validation: does the employee have enough days available?
  async validateSufficientBalance(employeeId, leaveType, requestedDays) {
    const balance = await this.findByEmployeeAndLeaveType(employeeId, leaveType);

    if (balance.available < requestedDays) {
      throw new BadRequestException(
        `Insufficient balance. Requested: ${requestedDays} day(s), Available: ${balance.available} day(s)`,
      );
    }

    return balance;
  }

  // Deduct days when a request is approved
  async deductBalance(employeeId, leaveType, days) {
    const balance = await this.findByEmployeeAndLeaveType(employeeId, leaveType);

    const newAvailable = parseFloat(balance.available) - days;
    const newUsed = parseFloat(balance.used) + days;

    if (newAvailable < 0) {
      throw new BadRequestException('Balance deduction would result in negative balance');
    }

    await this.balanceRepo.update(balance.id, {
      available: newAvailable,
      used: newUsed,
    });
  }

  // Restore days when a request is rejected or cancelled after approval
  async restoreBalance(employeeId, leaveType, days) {
    const balance = await this.findByEmployeeAndLeaveType(employeeId, leaveType);

    const newAvailable = parseFloat(balance.available) + days;
    const newUsed = Math.max(0, parseFloat(balance.used) - days);

    await this.balanceRepo.update(balance.id, {
      available: newAvailable,
      used: newUsed,
    });
  }
}

Injectable()(BalanceService);

InjectRepository(Balance)(BalanceService, undefined, 0);

module.exports = { BalanceService };
