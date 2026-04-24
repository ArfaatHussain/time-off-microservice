const { EntitySchema } = require('typeorm');
const Employee = new EntitySchema({
  name: 'Employee',
  tableName: 'employees',
  columns: {
    id: {
      primary: true,
      type: 'varchar',
      generated: false, // We use the HCM employee ID as our PK
      comment: 'Matches the employee ID in the HCM system',
    },
    name: {
      type: 'varchar',
    },
    email: {
      type: 'varchar',
      unique: true,
    },
    role: {
      type: 'varchar',
      default: 'employee', // 'employee' | 'manager'
    },
    managerId: {
      name: 'manager_id',
      type: 'varchar',
      nullable: true,
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
});

module.exports = { Employee };