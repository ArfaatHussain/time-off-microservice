const { TimeOffService } = require('../../time-off/time-off.service');

// --- Helpers ---

function makeRequest(overrides = {}) {
  return {
    id: 1,
    employeeId: 'emp1',
    leaveType: 'annual',
    startDate: '2026-05-01',
    endDate: '2026-05-03',
    days: 3,
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    reason: null,
    rejectionNote: null,
    ...overrides,
  };
}

function makeRepo(request) {
  return {
    find: jest.fn().mockResolvedValue([request]),
    findOne: jest.fn().mockResolvedValue(request),
    create: jest.fn().mockReturnValue(request),
    save: jest.fn().mockResolvedValue(request),
    update: jest.fn().mockResolvedValue({}),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null), // no overlap by default
    }),
  };
}

function makeBalanceService(overrides = {}) {
  return {
    validateSufficientBalance: jest.fn().mockResolvedValue(undefined),
    deductBalance: jest.fn().mockResolvedValue(undefined),
    restoreBalance: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeEmployeeService(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({ id: 'emp1', name: 'John' }),
    ...overrides,
  };
}

function makeHcmService(overrides = {}) {
  return {
    updateBalance: jest.fn().mockResolvedValue({}),
    validateBalance: jest.fn().mockResolvedValue({ valid: true, available: 20 }),
    ...overrides,
  };
}

// --- Tests ---

describe('TimeOffService', () => {

  describe('createRequest', () => {

    it('should create a request successfully', async () => {
      const request = makeRequest();
      const repo = makeRepo(request);
      const service = new TimeOffService(
        repo,
        makeBalanceService(),
        makeEmployeeService(),
        makeHcmService(),
      );

      const result = await service.createRequest('emp1', {
        leaveType: 'annual',
        startDate: '2026-05-01',
        endDate: '2026-05-03',
        days: 3,
      });

      expect(result).toEqual(request);
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw if employee does not exist', async () => {
      const repo = makeRepo(makeRequest());
      const employeeService = makeEmployeeService({
        findById: jest.fn().mockRejectedValue(new Error('Employee emp1 not found')),
      });
      const service = new TimeOffService(
        repo,
        makeBalanceService(),
        employeeService,
        makeHcmService(),
      );

      await expect(
        service.createRequest('emp1', {
          leaveType: 'annual',
          startDate: '2026-05-01',
          endDate: '2026-05-03',
          days: 3,
        }),
      ).rejects.toThrow('Employee emp1 not found');
    });

    it('should throw if balance validation fails', async () => {
      const repo = makeRepo(makeRequest());
      const balanceService = makeBalanceService({
        validateSufficientBalance: jest.fn().mockRejectedValue(
          new Error('Insufficient balance'),
        ),
      });
      const service = new TimeOffService(
        repo,
        balanceService,
        makeEmployeeService(),
        makeHcmService(),
      );

      await expect(
        service.createRequest('emp1', {
          leaveType: 'annual',
          startDate: '2026-05-01',
          endDate: '2026-05-03',
          days: 3,
        }),
      ).rejects.toThrow('Insufficient balance');
    });

    it('should throw if request overlaps with existing request', async () => {
      const existingRequest = makeRequest({ status: 'approved' });
      const repo = makeRepo(makeRequest());

      // Simulate overlap found
      repo.createQueryBuilder = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(existingRequest),
      });

      const service = new TimeOffService(
        repo,
        makeBalanceService(),
        makeEmployeeService(),
        makeHcmService(),
      );

      await expect(
        service.createRequest('emp1', {
          leaveType: 'annual',
          startDate: '2026-05-01',
          endDate: '2026-05-03',
          days: 3,
        }),
      ).rejects.toThrow('overlaps');
    });

  });

  describe('approveRequest', () => {

    it('should approve a pending request and deduct balance', async () => {
      const request = makeRequest({ status: 'pending' });
      const repo = makeRepo(request);
      const balanceService = makeBalanceService();
      const hcmService = makeHcmService();
      const service = new TimeOffService(
        repo,
        balanceService,
        makeEmployeeService(),
        hcmService,
      );

      await service.approveRequest(1, 'mgr1');

      expect(balanceService.deductBalance).toHaveBeenCalledWith('emp1', 'annual', 3);
      expect(hcmService.updateBalance).toHaveBeenCalledWith('emp1', 'annual', 3);
      expect(repo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: 'approved', reviewedBy: 'mgr1' }),
      );
    });

    it('should throw if request is not pending', async () => {
      const request = makeRequest({ status: 'approved' });
      const repo = makeRepo(request);
      const service = new TimeOffService(
        repo,
        makeBalanceService(),
        makeEmployeeService(),
        makeHcmService(),
      );

      await expect(service.approveRequest(1, 'mgr1')).rejects.toThrow(
        'Only pending requests can be approved',
      );
    });

    it('should still approve locally if HCM update fails', async () => {
      const request = makeRequest({ status: 'pending' });
      const repo = makeRepo(request);
      const balanceService = makeBalanceService();
      const hcmService = makeHcmService({
        updateBalance: jest.fn().mockRejectedValue(new Error('HCM down')),
      });
      const service = new TimeOffService(
        repo,
        balanceService,
        makeEmployeeService(),
        hcmService,
      );

      // Should not throw even though HCM failed
      await expect(service.approveRequest(1, 'mgr1')).resolves.not.toThrow();

      // Local deduction should still happen
      expect(balanceService.deductBalance).toHaveBeenCalled();
    });

  });

  describe('rejectRequest', () => {

    it('should reject a pending request', async () => {
      const request = makeRequest({ status: 'pending' });
      const repo = makeRepo(request);
      const service = new TimeOffService(
        repo,
        makeBalanceService(),
        makeEmployeeService(),
        makeHcmService(),
      );

      await service.rejectRequest(1, 'mgr1', 'Not enough coverage');

      expect(repo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: 'rejected',
          rejectionNote: 'Not enough coverage',
        }),
      );
    });

    it('should throw if request is not pending', async () => {
      const request = makeRequest({ status: 'rejected' });
      const repo = makeRepo(request);
      const service = new TimeOffService(
        repo,
        makeBalanceService(),
        makeEmployeeService(),
        makeHcmService(),
      );

      await expect(service.rejectRequest(1, 'mgr1', 'note')).rejects.toThrow(
        'Only pending requests can be rejected',
      );
    });

  });

  describe('cancelRequest', () => {

    it('should cancel a pending request without restoring balance', async () => {
      const request = makeRequest({ status: 'pending', employeeId: 'emp1' });
      const repo = makeRepo(request);
      const balanceService = makeBalanceService();
      const service = new TimeOffService(
        repo,
        balanceService,
        makeEmployeeService(),
        makeHcmService(),
      );

      await service.cancelRequest(1, 'emp1');

      expect(repo.update).toHaveBeenCalledWith(1, { status: 'cancelled' });
      // Balance should NOT be restored for pending requests
      expect(balanceService.restoreBalance).not.toHaveBeenCalled();
    });

    it('should cancel an approved request and restore balance', async () => {
      const request = makeRequest({ status: 'approved', employeeId: 'emp1' });
      const repo = makeRepo(request);
      const balanceService = makeBalanceService();
      const service = new TimeOffService(
        repo,
        balanceService,
        makeEmployeeService(),
        makeHcmService(),
      );

      await service.cancelRequest(1, 'emp1');

      expect(balanceService.restoreBalance).toHaveBeenCalledWith('emp1', 'annual', 3);
    });

    it('should throw if employee tries to cancel someone else\'s request', async () => {
      const request = makeRequest({ status: 'pending', employeeId: 'emp1' });
      const repo = makeRepo(request);
      const service = new TimeOffService(
        repo,
        makeBalanceService(),
        makeEmployeeService(),
        makeHcmService(),
      );

      await expect(service.cancelRequest(1, 'emp99')).rejects.toThrow(
        'You can only cancel your own requests',
      );
    });

    it('should throw if request is already rejected', async () => {
      const request = makeRequest({ status: 'rejected', employeeId: 'emp1' });
      const repo = makeRepo(request);
      const service = new TimeOffService(
        repo,
        makeBalanceService(),
        makeEmployeeService(),
        makeHcmService(),
      );

      await expect(service.cancelRequest(1, 'emp1')).rejects.toThrow(
        'Only pending or approved requests can be cancelled',
      );
    });

  });

});