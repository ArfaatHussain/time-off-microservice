const { Module } = require('@nestjs/common');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { Employee } = require('../entities/employee.entity');
const { EmployeeService } = require('./employee.service');
const { EmployeeController } = require('./employee.controller');

class EmployeeModule {}

Module({
  imports: [TypeOrmModule.forFeature([Employee])],
   controllers: [EmployeeController],
  providers: [EmployeeService],
  exports: [EmployeeService], // exported so TimeOffService can use it
})(EmployeeModule);

module.exports = { EmployeeModule };