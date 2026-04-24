const { Injectable, NotFoundException } = require('@nestjs/common');
const { InjectRepository } = require('@nestjs/typeorm');
const { Employee } = require('../entities/employee.entity');

class EmployeeService {
  constructor(employeeRepo) {
    this.employeeRepo = employeeRepo;
  }

  async findAll() {
    return this.employeeRepo.find();
  }

  async findById(id) {
    const employee = await this.employeeRepo.findOne({ where: { id } });
    if (!employee) throw new NotFoundException(`Employee ${id} not found`);
    return employee;
  }

  async create(data) {
    const employee = this.employeeRepo.create(data);
    return this.employeeRepo.save(employee);
  }

  async update(id, data) {
    await this.findById(id); // ensures employee exists
    await this.employeeRepo.update(id, data);
    return this.findById(id);
  }

  async remove(id) {
    await this.findById(id); // ensures employee exists
    await this.employeeRepo.delete(id);
  }
}

Injectable()(EmployeeService);

InjectRepository(Employee)(EmployeeService, undefined, 0);

module.exports = { EmployeeService };
