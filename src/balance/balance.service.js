const { Injectable, NotFoundException, BadRequestException } = require('@nestjs/common');
const { InjectRepository } = require('@nestjs/typeorm');
const { Inject } = require('@nestjs/common');
const { Balance } = require('../entities/balance.entity');
const { HcmService } = require('../hcm/hcm.service');

class BalanceService {
  constructor(balanceRepo, hcmService) {
    this.balanceRepo = balanceRepo;
    this.hcmService = hcmService;
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

  /**
   * Validate balance — HCM first, fall back to local if HCM is unavailable.
   */
  async validateSufficientBalance(employeeId, leaveType, requestedDays) {
    let hcmResult = null;

    try {
      hcmResult = await this.hcmService.validateBalance(employeeId, leaveType, requestedDays);
    } catch (err) {
      // HCM is unavailable — log and fall back to local check
      console.warn(
        `[BalanceService] HCM validation failed for employee ${employeeId}. ` +
        `Falling back to local balance. Reason: ${err.message}`,
      );
    }

    if (hcmResult) {
      // HCM responded — trust it as source of truth
      if (!hcmResult.valid) {
        throw new BadRequestException(
          `HCM validation failed: ${hcmResult.reason}`,
        );
      }
      // HCM says valid — also sync the local balance with what HCM returned
      await this._syncLocalFromHcm(employeeId, leaveType, hcmResult);
      return;
    }

    // HCM fallback — use local balance
    const balance = await this.findByEmployeeAndLeaveType(employeeId, leaveType);
    if (balance.available < requestedDays) {
      throw new BadRequestException(
        `Insufficient balance (local check). Requested: ${requestedDays}, Available: ${balance.available}`,
      );
    }
  }

  /**
   * Sync local balance with HCM data if there is a discrepancy.
   */
  async _syncLocalFromHcm(employeeId, leaveType, hcmData) {
    try {
      const balance = await this.balanceRepo.findOne({
        where: { employeeId, leaveType },
      });

      if (!balance) return;

      const localAvailable = parseFloat(balance.available);
      const hcmAvailable = parseFloat(hcmData.available);

      if (localAvailable !== hcmAvailable) {
        console.warn(
          `[BalanceService] Discrepancy detected for employee ${employeeId} ` +
          `leave type "${leaveType}". Local: ${localAvailable}, HCM: ${hcmAvailable}. ` +
          `Updating local to match HCM.`,
        );
        await this.balanceRepo.update(balance.id, {
          available: hcmAvailable,
          used: hcmData.used,
          lastSyncedAt: new Date(),
        });
      }
    } catch (err) {
      // Non-critical — just log, don't block the request
      console.error(`[BalanceService] Failed to sync local balance from HCM: ${err.message}`);
    }
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
Inject(HcmService)(BalanceService, undefined, 1);

module.exports = { BalanceService };