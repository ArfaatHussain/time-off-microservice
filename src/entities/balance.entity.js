const { EntitySchema } = require('typeorm');
const Balance = new EntitySchema({
  name: 'Balance',
  tableName: 'balances',
  columns: {
    id: {
      primary: true,
      type: 'integer',
      generated: true,
    },
    employeeId: {
      name: 'employee_id',
      type: 'varchar',
    },
    leaveType: {
      name: 'leave_type',
      type: 'varchar',
      comment: 'e.g. annual, sick, unpaid',
    },
    available: {
      type: 'decimal',
      precision: 5,
      scale: 1,
      comment: 'Days currently available to use',
    },
    used: {
      type: 'decimal',
      precision: 5,
      scale: 1,
      default: 0,
      comment: 'Days used so far — tracked locally, reconciled via HCM sync',
    },
    lastSyncedAt: {
      name: 'last_synced_at',
      type: 'datetime',
      nullable: true,
      comment: 'When this balance was last confirmed with the HCM system',
    },
    createdAt: {
      name: 'created_at',
      type: 'datetime',
      createDate: true,
    },
    updatedAt: {
      name: 'updated_at',
      type: 'datetime',
      updateDate: true,
    },
  },
  uniques: [
    {
      name: 'UQ_balance_employee_leave_type',
      columns: ['employeeId', 'leaveType'],
    },
  ],
  relations: {
    employee: {
      type: 'many-to-one',
      target: 'Employee',
      joinColumn: { name: 'employee_id' },
      onDelete: 'CASCADE',
    },
  },
});

module.exports = { Balance };
