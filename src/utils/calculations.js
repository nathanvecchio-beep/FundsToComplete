// ── Stamp Duty (placeholder until full tables provided) ──────────────────────
// NSW thresholds (established/existing home, non-first-home)
const NSW_STAMP_DUTY = [
  { max: 16000,     base: 0,        rate: 0.0125 },
  { max: 35000,     base: 200,      rate: 0.015  },
  { max: 93000,     base: 485,      rate: 0.0175 },
  { max: 351000,    base: 1500,     rate: 0.035  },
  { max: 1168000,   base: 10530,    rate: 0.045  },
  { max: 3505000,   base: 47295,    rate: 0.055  },
  { max: Infinity,  base: 175860,   rate: 0.07   },
];

// VIC thresholds
const VIC_STAMP_DUTY = [
  { max: 25000,     base: 0,        rate: 0.014  },
  { max: 130000,    base: 350,      rate: 0.024  },
  { max: 960000,    base: 2870,     rate: 0.06   },
  { max: 2000000,   base: 55070,    rate: 0.055  },
  { max: Infinity,  base: 110070,   rate: 0.065  },
];

// QLD thresholds
const QLD_STAMP_DUTY = [
  { max: 5000,      base: 0,        rate: 0      },
  { max: 75000,     base: 0,        rate: 0.015  },
  { max: 540000,    base: 1050,     rate: 0.035  },
  { max: 1000000,   base: 17325,    rate: 0.045  },
  { max: Infinity,  base: 38025,    rate: 0.0575 },
];

// SA thresholds
const SA_STAMP_DUTY = [
  { max: 12000,     base: 0,        rate: 0.01   },
  { max: 30000,     base: 120,      rate: 0.02   },
  { max: 50000,     base: 480,      rate: 0.03   },
  { max: 100000,    base: 1080,     rate: 0.035  },
  { max: 200000,    base: 2830,     rate: 0.04   },
  { max: 250000,    base: 6830,     rate: 0.0425 },
  { max: 300000,    base: 8955,     rate: 0.0425 },
  { max: 500000,    base: 11080,    rate: 0.045  },
  { max: Infinity,  base: 20080,    rate: 0.055  },
];

// WA thresholds
const WA_STAMP_DUTY = [
  { max: 120000,    base: 0,        rate: 0.019  },
  { max: 150000,    base: 2280,     rate: 0.0285 },
  { max: 360000,    base: 3135,     rate: 0.038  },
  { max: 725000,    base: 11115,    rate: 0.0465 },
  { max: Infinity,  base: 28092.5,  rate: 0.051  },
];

// ACT thresholds
const ACT_STAMP_DUTY = [
  { max: 200000,    base: 0,        rate: 0.0206 },
  { max: 300000,    base: 4120,     rate: 0.0342 },
  { max: 500000,    base: 7540,     rate: 0.0431 },
  { max: 750000,    base: 16100,    rate: 0.0516 },
  { max: 1000000,   base: 29000,    rate: 0.0583 },
  { max: 1455000,   base: 43575,    rate: 0.0638 },
  { max: Infinity,  base: 72600,    rate: 0.069  },
];

// NT thresholds
const NT_STAMP_DUTY = [
  { max: 525000,    base: 0,        rate: null, ntCalc: true },
  { max: Infinity,  base: 0,        rate: 0.0495 },
];

// TAS thresholds
const TAS_STAMP_DUTY = [
  { max: 3000,      base: 50,       rate: 0      },
  { max: 25000,     base: 50,       rate: 0.0175 },
  { max: 75000,     base: 435,      rate: 0.0225 },
  { max: 200000,    base: 1560,     rate: 0.035  },
  { max: 375000,    base: 5935,     rate: 0.04   },
  { max: 725000,    base: 12935,    rate: 0.0425 },
  { max: Infinity,  base: 27810,    rate: 0.045  },
];

function calcFromTable(table, value) {
  let prev = 0;
  for (const band of table) {
    if (value <= band.max) {
      if (band.ntCalc) {
        // NT formula for under 525k
        return Math.max(0, 0.06571441 * value + 15 * value / 1000 * value / 1000 - 12000);
      }
      return band.base + (value - prev) * band.rate;
    }
    prev = band.max;
  }
  return 0;
}

export function calculateStampDuty(state, propertyValue, isFirstHome, propertyType) {
  const v = propertyValue;
  if (!v || v <= 0) return 0;

  switch (state) {
    case 'NSW': {
      let duty = calcFromTable(NSW_STAMP_DUTY, v);
      // First home buyer concession NSW: full exemption ≤ $800k, taper $800k-$1M
      if (isFirstHome && propertyType !== 'Vacant Land') {
        if (v <= 800000) return 0;
        if (v <= 1000000) {
          const fullDuty = duty;
          const exemptPortion = (1000000 - v) / 200000;
          duty = fullDuty * (1 - exemptPortion);
        }
      }
      return Math.round(duty);
    }
    case 'VIC': {
      let duty = calcFromTable(VIC_STAMP_DUTY, v);
      if (isFirstHome) {
        if (v <= 600000) return 0;
        if (v <= 750000) {
          const reduction = duty * (750000 - v) / 150000;
          duty = duty - reduction;
        }
      }
      return Math.round(duty);
    }
    case 'QLD': {
      let duty = calcFromTable(QLD_STAMP_DUTY, v);
      if (isFirstHome && v <= 550000) return 0;
      return Math.round(duty);
    }
    case 'SA': return Math.round(calcFromTable(SA_STAMP_DUTY, v));
    case 'WA': {
      let duty = calcFromTable(WA_STAMP_DUTY, v);
      if (isFirstHome && v <= 430000) return 0;
      return Math.round(duty);
    }
    case 'ACT': return Math.round(calcFromTable(ACT_STAMP_DUTY, v));
    case 'NT': return Math.round(calcFromTable(NT_STAMP_DUTY, v));
    case 'TAS': return Math.round(calcFromTable(TAS_STAMP_DUTY, v));
    default: return 0;
  }
}

// ── Transfer / Mortgage Registration fees ────────────────────────────────────
export function calculateTransferFee(state, propertyValue) {
  const v = propertyValue;
  if (!v) return 0;
  switch (state) {
    case 'NSW': return Math.round(Math.min(Math.max(109 + Math.floor(v / 1000) * 3.4, 109), 50000));
    case 'VIC': return Math.round(Math.min(Math.max(109 + Math.floor(v / 1000) * 2.34, 109), 150000));
    case 'QLD': return Math.round(Math.min(600 + Math.floor(v / 10000) * 33, 3500));
    case 'SA':  return Math.round(Math.min(163 + Math.floor(v / 5000) * 11, 15000));
    case 'WA':  return Math.round(Math.min(168 + Math.floor(v / 100000) * 20, 1500));
    case 'ACT': return 1230;
    case 'NT':  return Math.round(Math.min(141 + Math.floor(v / 10000) * 12, 2000));
    case 'TAS': return Math.round(Math.min(174 + Math.floor(v / 10000) * 14, 3000));
    default: return 0;
  }
}

export function calculateMortgageRegistration(state, loanAmount) {
  const v = loanAmount;
  if (!v) return 0;
  switch (state) {
    case 'NSW': return Math.round(Math.min(Math.max(109 + Math.floor(v / 1000) * 3.4, 109), 5000));
    case 'VIC': return Math.round(Math.min(109 + Math.floor(v / 1000) * 2.34, 5000));
    case 'QLD': return 194;
    case 'SA':  return 163;
    case 'WA':  return Math.round(Math.min(168 + Math.floor(v / 100000) * 5, 500));
    case 'ACT': return 161;
    case 'NT':  return 141;
    case 'TAS': return 174;
    default: return 0;
  }
}

// ── LMI (simplified tier estimate) ──────────────────────────────────────────
const LMI_RATES = [
  { lvr: 0.8,  rate: 0 },
  { lvr: 0.85, rate: 0.0077 },
  { lvr: 0.9,  rate: 0.0158 },
  { lvr: 0.95, rate: 0.0374 },
  { lvr: 1.0,  rate: 0.0449 },
];

export function calculateLMI(loanAmount, propertyValue, lmiWaived) {
  if (lmiWaived || !loanAmount || !propertyValue) return 0;
  const lvr = loanAmount / propertyValue;
  if (lvr <= 0.8) return 0;
  let rate = 0.0449;
  for (const tier of LMI_RATES) {
    if (lvr <= tier.lvr) { rate = tier.rate; break; }
  }
  return Math.round(loanAmount * rate);
}

// ── Repayment ────────────────────────────────────────────────────────────────
export function calculateRepayment(loanAmount, annualRate, termYears, ioTermYears = 0) {
  if (!loanAmount || !annualRate || !termYears) return 0;
  const r = annualRate / 100 / 12;
  const pAndITerm = termYears - ioTermYears;
  if (ioTermYears > 0) {
    return Math.round(loanAmount * r);
  }
  const n = pAndITerm * 12;
  return Math.round(loanAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
}
