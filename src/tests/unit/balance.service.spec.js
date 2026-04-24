const { BalanceService } = require('../../balance/balance.service');

// --- Helpers ---

function makeBalance(overrides = {}) {
  return {
    id: 1,
    employeeId: 'emp1',
    leaveType: 'annual',
    available: 20,
    used: 0,
    lastSyncedAt: null,
    ...overrides,
  };
}

function makeRepo(balance) {
  return {
    find: jest.fn().mockResolvedValue([balance]),
    findOne: jest.fn().mockResolvedValue(balance),
    create: jest.fn().mockReturnValue(balance),
    save: jest.fn().mockResolvedValue(balance),
    update: jest.fn().mockResolvedValue({}),
  };
}

function makeHcm(overrides = {}) {
  return {
    validateBalance: jest.fn().mockResolvedValue({ valid: true, available: 20, used: 0 }),
    updateBalance: jest.fn().mockResolvedValue({}),
    getFullBalance: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

// --- Tests ---

describe('BalanceService', () => {

  describe('validateSufficientBalance', () => {

    it('should pass when HCM says balance is valid', async () => {
      const balance = makeBalance();
      const repo = makeRepo(balance);
      const hcm = makeHcm();
      const service = new BalanceService(repo, hcm);

      await expect(
        service.validateSufficientBalance('emp1', 'annual', 5),
      ).resolves.not.toThrow();

      expect(hcm.validateBalance).toHaveBeenCalledWith('emp1', 'annual', 5);
    });

    it('should throw when HCM says balance is insufficient', async () => {
      const repo = makeRepo(makeBalance());
      const hcm = makeHcm({
        validateBalance: jest.fn().mockResolvedValue({
          valid: false,
          available: 2,
          reason: 'Insufficient balance in HCM. Available: 2, Requested: 5',
        }),
      });
      const service = new BalanceService(repo, hcm);

      await expect(
        service.validateSufficientBalance('emp1', 'annual', 5),
      ).rejects.toThrow('HCM validation failed');
    });

    it('should fall back to local check when HCM is down', async () => {
      const balance = makeBalance({ available: 20 });
      const repo = makeRepo(balance);
      const hcm = makeHcm({
        validateBalance: jest.fn().mockRejectedValue(new Error('HCM unavailable')),
      });
      const service = new BalanceService(repo, hcm);

      await expect(
        service.validateSufficientBalance('emp1', 'annual', 5),
      ).resolves.not.toThrow();
    });

    it('should throw on local check when HCM is down and local balance is insufficient', async () => {
      const balance = makeBalance({ available: 2 });
      const repo = makeRepo(balance);
      const hcm = makeHcm({
        validateBalance: jest.fn().mockRejectedValue(new Error('HCM unavailable')),
      });
      const service = new BalanceService(repo, hcm);

      await expect(
        service.validateSufficientBalance('emp1', 'annual', 5),
      ).rejects.toThrow('Insufficient balance (local check)');
    });

    it('should sync local balance when HCM returns a different value', async () => {
      const balance = makeBalance({ available: 15 }); // local is 15
      const repo = makeRepo(balance);
      const hcm = makeHcm({
        validateBalance: jest.fn().mockResolvedValue({
          valid: true,
          available: 20, // HCM says 20
          used: 0,
        }),
      });
      const service = new BalanceService(repo, hcm);

      await service.validateSufficientBalance('emp1', 'annual', 5);

      // Should have updated local to match HCM
      expect(repo.update).toHaveBeenCalledWith(
        balance.id,
        expect.objectContaining({ available: 20 }),
      );
    });

    it('should not update local when HCM and local match', async () => {
      const balance = makeBalance({ available: 20 });
      const repo = makeRepo(balance);
      const hcm = makeHcm({
        validateBalance: jest.fn().mockResolvedValue({
          valid: true,
          available: 20, // same as local
          used: 0,
        }),
      });
      const service = new BalanceService(repo, hcm);

      await service.validateSufficientBalance('emp1', 'annual', 5);

      expect(repo.update).not.toHaveBeenCalled();
    });

  });

  describe('deductBalance', () => {

    it('should deduct days correctly', async () => {
      const balance = makeBalance({ available: 20, used: 0 });
      const repo = makeRepo(balance);
      const service = new BalanceService(repo, makeHcm());

      await service.deductBalance('emp1', 'annual', 5);

      expect(repo.update).toHaveBeenCalledWith(balance.id, {
        available: 15,
        used: 5,
      });
    });

    it('should throw if deduction results in negative balance', async () => {
      const balance = makeBalance({ available: 3 });
      const repo = makeRepo(balance);
      const service = new BalanceService(repo, makeHcm());

      await expect(
        service.deductBalance('emp1', 'annual', 5),
      ).rejects.toThrow('negative balance');
    });

  });

  describe('restoreBalance', () => {

    it('should restore days correctly', async () => {
      const balance = makeBalance({ available: 15, used: 5 });
      const repo = makeRepo(balance);
      const service = new BalanceService(repo, makeHcm());

      await service.restoreBalance('emp1', 'annual', 5);

      expect(repo.update).toHaveBeenCalledWith(balance.id, {
        available: 20,
        used: 0,
      });
    });

    it('should not let used go below zero on restore', async () => {
      const balance = makeBalance({ available: 20, used: 0 });
      const repo = makeRepo(balance);
      const service = new BalanceService(repo, makeHcm());

      await service.restoreBalance('emp1', 'annual', 5);

      expect(repo.update).toHaveBeenCalledWith(balance.id, {
        available: 25,
        used: 0, // Math.max(0, 0-5) = 0
      });
    });

  });

});