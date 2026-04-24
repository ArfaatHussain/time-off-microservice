const {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Inject,
  BadRequestException,
} = require('@nestjs/common');
const { EmployeeService } = require('./employee.service');

class EmployeeController {
  constructor(employeeService) {
    this.employeeService = employeeService;
  }

  async createEmployee(body) {
    const { id, name, email, role, managerId } = body;

    // Manual validation
    if (!id || !name || !email) {
      throw new BadRequestException('id, name and email are required');
    }

    if (role && !['employee', 'manager'].includes(role)) {
      throw new BadRequestException('role must be either "employee" or "manager"');
    }

    return this.employeeService.create({ id, name, email, role, managerId });
  }

  async getEmployee(id) {
    return this.employeeService.findById(id);
  }
}

// Apply class decorator
Controller('employees')(EmployeeController);

// Wire constructor injection
Inject(EmployeeService)(EmployeeController, undefined, 0);

// Apply method decorators
Post()(EmployeeController.prototype, 'createEmployee', Object.getOwnPropertyDescriptor(EmployeeController.prototype, 'createEmployee'));
Body()(EmployeeController.prototype, 'createEmployee', 0);

Get(':id')(EmployeeController.prototype, 'getEmployee', Object.getOwnPropertyDescriptor(EmployeeController.prototype, 'getEmployee'));
Param('id')(EmployeeController.prototype, 'getEmployee', 0);

module.exports = { EmployeeController };