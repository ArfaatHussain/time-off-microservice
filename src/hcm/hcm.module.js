const { Module } = require('@nestjs/common');
const { HcmService } = require('./hcm.service');

class HcmModule {}

Module({
  providers: [HcmService],
  exports: [HcmService], // exported so BalanceService and TimeOffService can use it
})(HcmModule);

module.exports = { HcmModule };