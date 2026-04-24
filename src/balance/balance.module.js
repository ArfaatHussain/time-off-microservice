const { Module } = require('@nestjs/common');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { Balance } = require('../entities/balance.entity');
const { BalanceService } = require('./balance.service');
const { BalanceController } = require('./balance.controller');
const { HcmModule } = require('../hcm/hcm.module');

class BalanceModule { }

Module({
  imports: [TypeOrmModule.forFeature([Balance]),
    HcmModule,
  ],
  controllers: [BalanceController],
  providers: [BalanceService],
  exports: [BalanceService], // exported so TimeOffService can use it
})(BalanceModule);

module.exports = { BalanceModule };