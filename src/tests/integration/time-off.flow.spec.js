const { Test } = require('@nestjs/testing');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { Employee } = require('../../entities/employee.entity');
const { Balance } = require('../../entities/balance.entity');
const { TimeOffRequest } = require('../../entities/time-off-request.entity');
const { EmployeeModule } = require('../../employee/employee.module');
const { BalanceModule } = require('../../balance/balance.module');
const { TimeOffModule } = require('../../time-off/time-off.module');
const { HcmModule } = require('../../hcm/hcm.module');
const { EmployeeService } = require('../../employee/employee.service');
const { BalanceService } = require('../../balance/balance.service');
const { TimeOffService } = require('../../time-off/time-off.service');
const { HcmService } = require('../../hcm/hcm.service');

// --- Test module setup ---

async function createTestModule(hcmOverrides = {}) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'sqlite',
        database: ':memory:', // fresh in-memory DB per test run
        entities: [Employee, Balance, TimeOffRequest],
        synchronize: true,
      }),
      HcmModule,
      EmployeeModule,
      BalanceModule,
      TimeOffModule,
    ],
  })
    .overrideProvider(HcmService)
    .useValue({
      validateBalance: jest.fn().mockResolvedValue({ valid: true, available: 20, used: 0 }),
      updateBalance: jest.fn().mockResolvedValue({}),
      getFullBalance: jest.fn().mockResolvedValue(null),
      ...hcmOverrides,
    })
    .compile();

  return {
    moduleRef,
    employeeService: moduleRef.get(EmployeeService),
    balanceService: moduleRef.get(BalanceService),
    timeOffService: moduleRef.get(TimeOffService),
    hcmService: moduleRef.get(HcmService),
  };
}

// --- Seed helpers ---

async function seedEmployee(employeeService, overrides = {}) {
  return employeeService.create({
    id: 'emp1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'employee',
    ...overrides,
  });
}

async function seedBalance(balanceService, overrides = {}) {
  return balanceService.create({
    employeeId: 'emp1',
    leaveType: 'annual',
    available: 20,
    used: 0,
    ...overrides,
  });
}

// --- Tests ---

describe('TimeOff Integration Flow', () => {
  let moduleRef, employeeService, balanceService, timeOffService, hcmService;

  beforeEach(async () => {
    ({ moduleRef, employeeService, balanceService, timeOffService, hcmService } =
      await createTestModule());
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  // --- Happy path ---

  describe('Happy path', () => {

    it('should create, approve a request and deduct balance', async () => {
      await seedEmployee(employeeService);
      await seedBalance(balanceService);

      const request = await timeOffService.createRequest('emp1', {
        leaveType: 'annual',
        startDate: '2026-05-01',
        endDate: '2026-05-03',
        days: 3,
      });

      expect(request.status).toBe('pending');

      const approved = await timeOffService.approveRequest(request.id, 'mgr1');
      expect(approved.status).toBe('approved');

      const balances = await balanceService.findByEmployee('emp1');
      expect(parseFloat(balances[0].available)).toBe(17);
      expect(parseFloat(balances[0].used)).toBe(3);
    });

    it('should reject a request without touching balance', async () => {
      await seedEmployee(employeeService);
      await seedBalance(balanceService);

      const request = await timeOffService.createRequest('emp1', {
        leaveType: 'annual',
        startDate: '2026-05-01',
        endDate: '2026-05-03',
        days: 3,
      });

      await timeOffService.rejectRequest(request.id, 'mgr1', 'Too many people off');

      const balances = await balanceService.findByEmployee('emp1');
      expect(parseFloat(balances[0].available)).toBe(20); // unchanged
    });

    it('should restore balance when cancelling an approved request', async () => {
      await seedEmployee(employeeService);
      await seedBalance(balanceService);

      const request = await timeOffService.createRequest('emp1', {
        leaveType: 'annual',
        startDate: '2026-05-01',
        endDate: '2026-05-03',
        days: 3,
      });

      await timeOffService.approveRequest(request.id, 'mgr1');
      await timeOffService.cancelRequest(request.id, 'emp1');

      const balances = await balanceService.findByEmployee('emp1');
      expect(parseFloat(balances[0].available)).toBe(20); // restored
    });

  });

  // --- HCM failure scenarios ---

  describe('HCM failure scenarios', () => {

    it('should still create request when HCM is down (local fallback)', async () => {
      const { moduleRef, employeeService, balanceService, timeOffService } =
        await createTestModule({
          validateBalance: jest.fn().mockRejectedValue(new Error('HCM down')),
        });

      await seedEmployee(employeeService);
      await seedBalance(balanceService);

      const request = await timeOffService.createRequest('emp1', {
        leaveType: 'annual',
        startDate: '2026-05-01',
        endDate: '2026-05-03',
        days: 3,
      });

      expect(request.status).toBe('pending');
      await moduleRef.close();
    });

    it('should still approve when HCM update fails', async () => {
      const { moduleRef, employeeService, balanceService, timeOffService } =
        await createTestModule({
          validateBalance: jest.fn().mockResolvedValue({ valid: true, available: 20, used: 0 }),
          updateBalance: jest.fn().mockRejectedValue(new Error('HCM down')),
        });

      await seedEmployee(employeeService);
      await seedBalance(balanceService);

      const request = await timeOffService.createRequest('emp1', {
        leaveType: 'annual',
        startDate: '2026-05-01',
        endDate: '2026-05-03',
        days: 3,
      });

      const approved = await timeOffService.approveRequest(request.id, 'mgr1');
      expect(approved.status).toBe('approved');

      // Local balance should still be deducted
      const balances = await balanceService.findByEmployee('emp1');
      expect(parseFloat(balances[0].available)).toBe(17);

      await moduleRef.close();
    });

    it('should block request when HCM explicitly says insufficient balance', async () => {
      const { moduleRef, employeeService, balanceService, timeOffService } =
        await createTestModule({
          validateBalance: jest.fn().mockResolvedValue({
            valid: false,
            available: 2,
            reason: 'Insufficient balance in HCM. Available: 2, Requested: 5',
          }),
        });

      await seedEmployee(employeeService);
      await seedBalance(balanceService, { available: 20 }); // local says 20 but HCM says 2

      await expect(
        timeOffService.createRequest('emp1', {
          leaveType: 'annual',
          startDate: '2026-05-01',
          endDate: '2026-05-03',
          days: 5,
        }),
      ).rejects.toThrow('HCM validation failed');

      await moduleRef.close();
    });

  });

  // --- Edge cases ---

  describe('Edge cases', () => {

    it('should block overlapping requests', async () => {
      await seedEmployee(employeeService);
      await seedBalance(balanceService);

      await timeOffService.createRequest('emp1', {
        leaveType: 'annual',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        days: 5,
      });

      await expect(
        timeOffService.createRequest('emp1', {
          leaveType: 'annual',
          startDate: '2026-05-03', // overlaps
          endDate: '2026-05-07',
          days: 3,
        }),
      ).rejects.toThrow('overlaps');
    });

    it('should block request when local balance is insufficient (HCM down)', async () => {
      const { moduleRef, employeeService, balanceService, timeOffService } =
        await createTestModule({
          validateBalance: jest.fn().mockRejectedValue(new Error('HCM down')),
        });

      await seedEmployee(employeeService);
      await seedBalance(balanceService, { available: 2 }); // only 2 days left

      await expect(
        timeOffService.createRequest('emp1', {
          leaveType: 'annual',
          startDate: '2026-05-01',
          endDate: '2026-05-05',
          days: 5,
        }),
      ).rejects.toThrow('Insufficient balance (local check)');

      await moduleRef.close();
    });

    it('should not allow double approval', async () => {
      await seedEmployee(employeeService);
      await seedBalance(balanceService);

      const request = await timeOffService.createRequest('emp1', {
        leaveType: 'annual',
        startDate: '2026-05-01',
        endDate: '2026-05-03',
        days: 3,
      });

      await timeOffService.approveRequest(request.id, 'mgr1');

      await expect(
        timeOffService.approveRequest(request.id, 'mgr1'),
      ).rejects.toThrow('Only pending requests can be approved');
    });

    it('should not allow cancelling another employee\'s request', async () => {
      await seedEmployee(employeeService);
      await seedBalance(balanceService);

      const request = await timeOffService.createRequest('emp1', {
        leaveType: 'annual',
        startDate: '2026-05-01',
        endDate: '2026-05-03',
        days: 3,
      });

      await expect(
        timeOffService.cancelRequest(request.id, 'emp99'),
      ).rejects.toThrow('You can only cancel your own requests');
    });

  });

});