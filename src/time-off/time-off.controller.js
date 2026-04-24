const {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Inject,
  BadRequestException,
} = require('@nestjs/common');
const { TimeOffService } = require('./time-off.service');

const VALID_LEAVE_TYPES = ['annual', 'sick', 'unpaid'];
const VALID_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

class TimeOffController {
  constructor(timeOffService) {
    this.timeOffService = timeOffService;
  }

  // POST /time-off
  async createRequest(body) {
    const { employeeId, leaveType, startDate, endDate, days, reason } = body;

    if (!employeeId || !leaveType || !startDate || !endDate || !days) {
      throw new BadRequestException(
        'employeeId, leaveType, startDate, endDate and days are required',
      );
    }

    if (!VALID_LEAVE_TYPES.includes(leaveType)) {
      throw new BadRequestException(
        `leaveType must be one of: ${VALID_LEAVE_TYPES.join(', ')}`,
      );
    }

    if (typeof days !== 'number' || days <= 0) {
      throw new BadRequestException('days must be a positive number');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('startDate and endDate must be valid dates');
    }

    if (start > end) {
      throw new BadRequestException('startDate must be before or equal to endDate');
    }

    return this.timeOffService.createRequest(employeeId, {
      leaveType,
      startDate,
      endDate,
      days,
      reason,
    });
  }

  // GET /time-off/:id
  async getRequest(id) {
    return this.timeOffService.findById(Number(id));
  }

  // GET /time-off/employee/:employeeId
  async getRequestsByEmployee(employeeId) {
    return this.timeOffService.findByEmployee(employeeId);
  }

  // PATCH /time-off/:id/approve
  async approveRequest(id, body) {
    const { managerId } = body;

    if (!managerId) {
      throw new BadRequestException('managerId is required');
    }

    return this.timeOffService.approveRequest(Number(id), managerId);
  }

  // PATCH /time-off/:id/reject
  async rejectRequest(id, body) {
    const { managerId, rejectionNote } = body;

    if (!managerId) {
      throw new BadRequestException('managerId is required');
    }

    return this.timeOffService.rejectRequest(Number(id), managerId, rejectionNote);
  }

  // PATCH /time-off/:id/cancel
  async cancelRequest(id, body) {
    const { employeeId } = body;

    if (!employeeId) {
      throw new BadRequestException('employeeId is required');
    }

    return this.timeOffService.cancelRequest(Number(id), employeeId);
  }
}

// Apply class decorator
Controller('time-off')(TimeOffController);

// Wire constructor injection
Inject(TimeOffService)(TimeOffController, undefined, 0);

// Apply method decorators
Post()(TimeOffController.prototype, 'createRequest', Object.getOwnPropertyDescriptor(TimeOffController.prototype, 'createRequest'));
Body()(TimeOffController.prototype, 'createRequest', 0);

Get(':id')(TimeOffController.prototype, 'getRequest', Object.getOwnPropertyDescriptor(TimeOffController.prototype, 'getRequest'));
Param('id')(TimeOffController.prototype, 'getRequest', 0);

Get('employee/:employeeId')(TimeOffController.prototype, 'getRequestsByEmployee', Object.getOwnPropertyDescriptor(TimeOffController.prototype, 'getRequestsByEmployee'));
Param('employeeId')(TimeOffController.prototype, 'getRequestsByEmployee', 0);

Patch(':id/approve')(TimeOffController.prototype, 'approveRequest', Object.getOwnPropertyDescriptor(TimeOffController.prototype, 'approveRequest'));
Param('id')(TimeOffController.prototype, 'approveRequest', 0);
Body()(TimeOffController.prototype, 'approveRequest', 1);

Patch(':id/reject')(TimeOffController.prototype, 'rejectRequest', Object.getOwnPropertyDescriptor(TimeOffController.prototype, 'rejectRequest'));
Param('id')(TimeOffController.prototype, 'rejectRequest', 0);
Body()(TimeOffController.prototype, 'rejectRequest', 1);

Patch(':id/cancel')(TimeOffController.prototype, 'cancelRequest', Object.getOwnPropertyDescriptor(TimeOffController.prototype, 'cancelRequest'));
Param('id')(TimeOffController.prototype, 'cancelRequest', 0);
Body()(TimeOffController.prototype, 'cancelRequest', 1);

module.exports = { TimeOffController };