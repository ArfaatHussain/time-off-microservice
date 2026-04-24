const {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Inject,
  BadRequestException,
} = require('@nestjs/common');
const { BalanceService } = require('./balance.service');

const VALID_LEAVE_TYPES = ['annual', 'sick', 'unpaid'];

class BalanceController {
  constructor(balanceService) {
    this.balanceService = balanceService;
  }

  async createBalance(body) {
    const { employeeId, leaveType, available } = body;

    // Manual validation
    if (!employeeId || !leaveType || available === undefined) {
      throw new BadRequestException('employeeId, leaveType and available are required');
    }

    if (!VALID_LEAVE_TYPES.includes(leaveType)) {
      throw new BadRequestException(
        `leaveType must be one of: ${VALID_LEAVE_TYPES.join(', ')}`,
      );
    }

    if (typeof available !== 'number' || available < 0) {
      throw new BadRequestException('available must be a non-negative number');
    }

    return this.balanceService.create({ employeeId, leaveType, available });
  }

  async getBalances(employeeId) {
    return this.balanceService.findByEmployee(employeeId);
  }
}

// Apply class decorator
Controller('balances')(BalanceController);

// Wire constructor injection
Inject(BalanceService)(BalanceController, undefined, 0);

// Apply method decorators
Post()(BalanceController.prototype, 'createBalance', Object.getOwnPropertyDescriptor(BalanceController.prototype, 'createBalance'));
Body()(BalanceController.prototype, 'createBalance', 0);

Get(':employeeId')(BalanceController.prototype, 'getBalances', Object.getOwnPropertyDescriptor(BalanceController.prototype, 'getBalances'));
Param('employeeId')(BalanceController.prototype, 'getBalances', 0);

module.exports = { BalanceController };