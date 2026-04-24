const { Module } = require('@nestjs/common');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { Employee } = require('./entities/employee.entity');
const { Balance } = require('./entities/balance.entity');
const { TimeOffRequest } = require('./entities/time-off-request.entity');

const { EmployeeModule } = require('./employee/employee.module');
const { BalanceModule } = require('./balance/balance.module');
const { TimeOffModule } = require('./time-off/time-off.module');
const { HcmModule } = require('./hcm/hcm.module');

class AppModule { }

Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'timeoff.db',
      entities: [Employee, Balance, TimeOffRequest],
      synchronize: true,
    }),
    HcmModule,
    EmployeeModule,
    BalanceModule,
    TimeOffModule,
  ],
})(AppModule);

module.exports = { AppModule };