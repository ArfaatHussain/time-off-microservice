const { Module } = require('@nestjs/common');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { TimeOffRequest } = require('../entities/time-off-request.entity');
const { TimeOffService } = require('./time-off.service');
const { BalanceModule } = require('../balance/balance.module');
const { EmployeeModule } = require('../employee/employee.module');
const { TimeOffController } = require('./time-off.controller');

class TimeOffModule { }

Module({
  imports: [
    TypeOrmModule.forFeature([TimeOffRequest]),
    BalanceModule,   // gives us BalanceService
    EmployeeModule,  // gives us EmployeeService
  ],
  controllers: [TimeOffController],
  providers: [TimeOffService],
  exports: [TimeOffService],
})(TimeOffModule);

module.exports = { TimeOffModule };