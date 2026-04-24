const { Injectable, ServiceUnavailableException } = require('@nestjs/common');

// Simulated HCM database — this is the source of truth
const HCM_BALANCES = {
  emp1: {
    annual: { available: 20, used: 0 },
    sick: { available: 10, used: 0 },
    unpaid: { available: 5, used: 0 },
  },
};

// Failure simulation config — tweak these to test different scenarios
const SIMULATE = {
  transientFailureRate: 0.2,   // 20% chance of random failure
  latencyMs: 200,              // simulated network delay
  staleDataChance: 0.1,        // 10% chance HCM returns stale/inconsistent data
};

class HcmService {
  // Simulate network latency
  _delay() {
    return new Promise((resolve) => setTimeout(resolve, SIMULATE.latencyMs));
  }

  // Simulate random transient failure
  _maybeThrow() {
    if (Math.random() < SIMULATE.transientFailureRate) {
      throw new ServiceUnavailableException(
        'HCM service is temporarily unavailable. Please retry.',
      );
    }
  }

  // Simulate stale/inconsistent data by slightly altering the balance
  _maybeReturnStaleData(balance) {
    if (Math.random() < SIMULATE.staleDataChance) {
      return {
        ...balance,
        available: balance.available + 2, // HCM returns a slightly different value
        _stale: true,                      // flag for debugging
      };
    }
    return balance;
  }

  _getEmployeeBalances(employeeId) {
    const balances = HCM_BALANCES[employeeId];
    if (!balances) {
      return null;
    }
    return balances;
  }

  /**
   * Validate whether the employee has enough balance in HCM.
   * Returns { valid, available, used } or throws on failure.
   */
  async validateBalance(employeeId, leaveType, requestedDays) {
    await this._delay();
    this._maybeThrow();

    const balances = this._getEmployeeBalances(employeeId);

    if (!balances) {
      return { valid: false, reason: `Employee ${employeeId} not found in HCM` };
    }

    const balance = balances[leaveType];

    if (!balance) {
      return {
        valid: false,
        reason: `Leave type "${leaveType}" not found for employee ${employeeId} in HCM`,
      };
    }

    const data = this._maybeReturnStaleData(balance);

    if (data.available < requestedDays) {
      return {
        valid: false,
        available: data.available,
        used: data.used,
        reason: `Insufficient balance in HCM. Available: ${data.available}, Requested: ${requestedDays}`,
      };
    }

    return {
      valid: true,
      available: data.available,
      used: data.used,
    };
  }

  /**
   * Update balance in HCM after approval.
   * Returns updated balance or throws on failure.
   */
  async updateBalance(employeeId, leaveType, daysUsed) {
    await this._delay();
    this._maybeThrow();

    const balances = this._getEmployeeBalances(employeeId);

    if (!balances) {
      throw new ServiceUnavailableException(
        `Employee ${employeeId} not found in HCM — cannot update balance`,
      );
    }

    const balance = balances[leaveType];

    if (!balance) {
      throw new ServiceUnavailableException(
        `Leave type "${leaveType}" not found in HCM — cannot update balance`,
      );
    }

    if (balance.available < daysUsed) {
      throw new ServiceUnavailableException(
        `HCM rejected update — insufficient balance. Available: ${balance.available}, Requested: ${daysUsed}`,
      );
    }

    // Apply update to our mock HCM store
    balance.available = parseFloat((balance.available - daysUsed).toFixed(1));
    balance.used = parseFloat((balance.used + daysUsed).toFixed(1));

    return {
      employeeId,
      leaveType,
      available: balance.available,
      used: balance.used,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Fetch full balance snapshot for an employee from HCM.
   * Used during batch sync to reconcile local state.
   */
  async getFullBalance(employeeId) {
    await this._delay();
    this._maybeThrow();

    const balances = this._getEmployeeBalances(employeeId);

    if (!balances) {
      return null;
    }

    // Return a deep copy to avoid mutation of mock store
    return JSON.parse(JSON.stringify(balances));
  }
}

Injectable()(HcmService);

module.exports = { HcmService };