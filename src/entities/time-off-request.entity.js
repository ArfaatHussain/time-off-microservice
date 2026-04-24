const { EntitySchema } = require('typeorm');
const TimeOffRequest = new EntitySchema({
  name: 'TimeOffRequest',
  tableName: 'time_off_requests',
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
      comment: 'Must match a leave type present in the employee\'s balance',
    },
    startDate: {
      name: 'start_date',
      type: 'date',
    },
    endDate: {
      name: 'end_date',
      type: 'date',
    },
    days: {
      type: 'decimal',
      precision: 5,
      scale: 1,
      comment: 'Total working days requested — calculated before saving',
    },
    status: {
      type: 'varchar',
      default: 'pending',
      comment: 'pending | approved | rejected | cancelled',
    },
    reviewedBy: {
      name: 'reviewed_by',
      type: 'varchar',
      nullable: true,
      comment: 'Manager employee ID who approved or rejected',
    },
    reviewedAt: {
      name: 'reviewed_at',
      type: 'datetime',
      nullable: true,
    },
    reason: {
      type: 'text',
      nullable: true,
      comment: 'Optional note from the employee',
    },
    rejectionNote: {
      name: 'rejection_note',
      type: 'text',
      nullable: true,
      comment: 'Optional note from the manager when rejecting',
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
  relations: {
    employee: {
      type: 'many-to-one',
      target: 'Employee',
      joinColumn: { name: 'employee_id' },
      onDelete: 'CASCADE',
    },
  },
});

module.exports = { TimeOffRequest };
