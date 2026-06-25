// ── Stamp Duty Rate Tables (verified 26 June 2026) ───────────────────────────
// Source: au-stamp-duty-calculator.js + au-stamp-duty-rates.json

const RATES = {
  NSW: {
    general: [
      { upTo: 17000,   base: 0,      rate: 0.0125, minDuty: 20 },
      { upTo: 37000,   base: 212,    rate: 0.015 },
      { upTo: 99000,   base: 512,    rate: 0.0175 },
      { upTo: 372000,  base: 1597,   rate: 0.035 },
      { upTo: 1240000, base: 11152,  rate: 0.045 },
      { upTo: null,    base: 50212,  rate: 0.055 },
    ],
    premiumThreshold: 3721000,
    premiumBase: 186667,
    premiumRate: 0.07,
    foreignSurcharge: 0.09,
    fhb: { existingFullUpTo: 800000, existingConcUpTo: 1000000, landFullUpTo: 350000, landConcUpTo: 450000 },
  },

  VIC: {
    general: [
      { upTo: 25000,   base: 0,    rate: 0.014 },
      { upTo: 130000,  base: 350,  rate: 0.024 },
      { upTo: 960000,  base: 2870, rate: 0.06 },
      { upTo: 2000000, base: null, rate: 0.055, flatRateOnTotalValue: true },
      { upTo: null,    base: 110000, rate: 0.065 },
    ],
    ppr: [
      { upTo: 25000,  base: 0,     rate: 0.014 },
      { upTo: 130000, base: 350,   rate: 0.024 },
      { upTo: 440000, base: 2870,  rate: 0.05 },
      { upTo: 550000, base: 18370, rate: 0.06 },
    ],
    pprMax: 550000,
    foreignSurcharge: 0.08,
    fhb: { fullExemptionUpTo: 600000, concessionUpTo: 750000 },
  },

  QLD: {
    general: [
      { upTo: 5000,    base: 0,     rate: 0 },
      { upTo: 75000,   base: 0,     rate: 0.015 },
      { upTo: 540000,  base: 1050,  rate: 0.035 },
      { upTo: 1000000, base: 17325, rate: 0.045 },
      { upTo: null,    base: 38025, rate: 0.0575 },
    ],
    homeConcession: [
      { upTo: 350000,  base: 0,     rate: 0.01 },
      { upTo: 540000,  base: 3500,  rate: 0.035 },
      { upTo: 1000000, base: 10150, rate: 0.045 },
      { upTo: null,    base: 30850, rate: 0.0575 },
    ],
    foreignSurcharge: 0.08,
    // FHB QLD: new/land = full exemption; established = exempt ≤$700k, sliding $700k-$800k
    fhb: { establishedFullUpTo: 700000, establishedConcUpTo: 800000 },
  },

  WA: {
    general: [
      { upTo: 120000, base: 0,     rate: 0.019 },
      { upTo: 150000, base: 2280,  rate: 0.0285 },
      { upTo: 360000, base: 3135,  rate: 0.038 },
      { upTo: 725000, base: 11115, rate: 0.0475 },
      { upTo: null,   base: 28453, rate: 0.0515 },
    ],
    concessional: [
      { upTo: 120000, base: 0,    rate: 0.015 },
      { upTo: 200000, base: 1800, rate: 0.0404 },
    ],
    concessionalMax: 200000,
    foreignSurcharge: 0.07,
    // FHB WA (from 2025-03-21): established/new exempt ≤$500k, concession metro to $700k
    fhb: { fullExemptionUpTo: 500000, concessionUpTo: 700000 },
  },

  SA: {
    general: [
      { upTo: 12000,  base: 0,     rate: 0.01 },
      { upTo: 30000,  base: 120,   rate: 0.02 },
      { upTo: 50000,  base: 480,   rate: 0.03 },
      { upTo: 100000, base: 1080,  rate: 0.035 },
      { upTo: 200000, base: 2830,  rate: 0.04 },
      { upTo: 250000, base: 6830,  rate: 0.0425 },
      { upTo: 300000, base: 8955,  rate: 0.0475 },
      { upTo: 500000, base: 11330, rate: 0.05 },
      { upTo: null,   base: 21330, rate: 0.055 },
    ],
    foreignSurcharge: 0.07,
    // SA: no concession on established homes; new/land/OTP = full exemption (from 2025-02-13)
    fhb: { newAndLandFullExemption: true },
  },

  TAS: {
    general: [
      { upTo: 3000,   base: 50,    rate: 0,      flatMinimum: true },
      { upTo: 25000,  base: 50,    rate: 0.0175 },
      { upTo: 75000,  base: 435,   rate: 0.0225 },
      { upTo: 200000, base: 1560,  rate: 0.035 },
      { upTo: 375000, base: 5935,  rate: 0.04 },
      { upTo: 725000, base: 12935, rate: 0.0425 },
      { upTo: null,   base: 27810, rate: 0.045 },
    ],
    foreignSurcharge: 0.08,
    // TAS FHB: full exemption for established ≤$750k (contracts 18 Feb 2024 - 30 Jun 2026)
    fhb: { fullExemptionUpTo: 750000 },
  },

  ACT: {
    ownerOccupier: [
      { upTo: 260000,  base: 0,     rate: 0.0028 },
      { upTo: 300000,  base: 728,   rate: 0.022 },
      { upTo: 500000,  base: 1608,  rate: 0.034 },
      { upTo: 750000,  base: 8408,  rate: 0.0432 },
      { upTo: 1000000, base: 19208, rate: 0.059 },
      { upTo: 1455000, base: 33958, rate: 0.064 },
      { upTo: null,    base: null,  rate: 0.0454, flatRateOnTotalValue: true },
    ],
    nonOwnerOccupier: [
      { upTo: 200000,  base: 0,     rate: 0.012 },
      { upTo: 300000,  base: 2400,  rate: 0.022 },
      { upTo: 500000,  base: 4600,  rate: 0.034 },
      { upTo: 750000,  base: 11400, rate: 0.0432 },
      { upTo: 1000000, base: 22200, rate: 0.059 },
      { upTo: 1455000, base: 36950, rate: 0.064 },
      { upTo: null,    base: null,  rate: 0.0454, flatRateOnTotalValue: true },
    ],
    foreignSurcharge: 0,
    // ACT Home Buyer Concession Scheme (income-tested, not just FHB): full exemption ≤$1,020,000
    hbcs: { fullExemptionUpTo: 1020000, maxReduction: 35238 },
  },

  NT: {
    lowBandUpTo: 525000,
    higherBands: [
      { from: 525001,  upTo: 3000000, rate: 0.0495 },
      { from: 3000001, upTo: 5000000, rate: 0.0575 },
      { from: 5000001, upTo: null,    rate: 0.0595 },
    ],
    foreignSurcharge: 0,
  },
};

// ── Core bracket calculator ───────────────────────────────────────────────────
function calcFromBrackets(value, brackets) {
  let prevUpTo = 0;
  for (const b of brackets) {
    const upTo = b.upTo === null ? Infinity : b.upTo;
    if (value <= upTo) {
      if (b.flatMinimum) return b.base;
      if (b.flatRateOnTotalValue) return value * b.rate;
      const duty = b.base + (value - prevUpTo) * b.rate;
      return b.minDuty ? Math.max(duty, b.minDuty) : duty;
    }
    prevUpTo = upTo;
  }
  const last = brackets[brackets.length - 1];
  return last.base + (value - (brackets[brackets.length - 2]?.upTo ?? 0)) * last.rate;
}

// ── Base duty per jurisdiction (before FHB concessions) ──────────────────────
function baseDutyRaw(stateCode, value, isOwnerOccupier) {
  const r = RATES[stateCode];

  switch (stateCode) {
    case 'NSW':
      if (value > r.premiumThreshold) {
        return r.premiumBase + (value - r.premiumThreshold) * r.premiumRate;
      }
      return calcFromBrackets(value, r.general);

    case 'VIC':
      if (isOwnerOccupier && value <= r.pprMax) {
        return calcFromBrackets(value, r.ppr);
      }
      return calcFromBrackets(value, r.general);

    case 'QLD':
      return isOwnerOccupier
        ? calcFromBrackets(value, r.homeConcession)
        : calcFromBrackets(value, r.general);

    case 'WA':
      if (isOwnerOccupier && value <= r.concessionalMax) {
        return calcFromBrackets(value, r.concessional);
      }
      return calcFromBrackets(value, r.general);

    case 'SA':
    case 'TAS':
      return calcFromBrackets(value, r.general);

    case 'ACT':
      return calcFromBrackets(value, isOwnerOccupier ? r.ownerOccupier : r.nonOwnerOccupier);

    case 'NT': {
      if (value <= r.lowBandUpTo) {
        const v = value / 1000;
        return 0.06571441 * v * v + 15 * v;
      }
      const band = r.higherBands.find(b => value >= b.from && (b.upTo === null || value <= b.upTo));
      return value * band.rate;
    }

    default:
      return 0;
  }
}

// ── Public: calculate stamp duty with all concessions ────────────────────────
export function calculateStampDuty(stateCode, propertyValue, opts = {}) {
  const v = Number(propertyValue) || 0;
  if (v <= 0) return 0;
  const { isFirstHome = false, isOwnerOccupier = true, propertyType = 'Established Home', isForeignBuyer = false } = opts;
  const r = RATES[stateCode];
  if (!r) return 0;

  const isNewBuild = propertyType === 'New Home' || propertyType === 'Off the Plan';
  const isLand = propertyType === 'Vacant Land';

  let duty = baseDutyRaw(stateCode, v, isOwnerOccupier);

  // Apply FHB concessions
  if (isFirstHome) {
    switch (stateCode) {
      case 'NSW': {
        const { existingFullUpTo, existingConcUpTo, landFullUpTo, landConcUpTo } = r.fhb;
        const fullUp = isLand ? landFullUpTo : existingFullUpTo;
        const concUp = isLand ? landConcUpTo : existingConcUpTo;
        if (v <= fullUp) { duty = 0; }
        else if (v <= concUp) {
          // Linear taper: full exemption at fullUp, no concession at concUp
          duty = duty * (v - fullUp) / (concUp - fullUp);
        }
        break;
      }
      case 'VIC': {
        if (v <= r.fhb.fullExemptionUpTo) { duty = 0; }
        else if (v <= r.fhb.concessionUpTo) {
          // VIC formula: fullDuty × (value - 600000) / 150000
          duty = duty * (v - r.fhb.fullExemptionUpTo) / (r.fhb.concessionUpTo - r.fhb.fullExemptionUpTo);
        }
        break;
      }
      case 'QLD': {
        if (isNewBuild || isLand) {
          duty = 0; // full exemption, no cap
        } else {
          if (v <= r.fhb.establishedFullUpTo) { duty = 0; }
          else if (v <= r.fhb.establishedConcUpTo) {
            duty = duty * (v - r.fhb.establishedFullUpTo) / (r.fhb.establishedConcUpTo - r.fhb.establishedFullUpTo);
          }
        }
        break;
      }
      case 'WA': {
        if (v <= r.fhb.fullExemptionUpTo) { duty = 0; }
        else if (v <= r.fhb.concessionUpTo) {
          // Sliding scale: full exemption at $500k, no concession at $700k
          duty = duty * (v - r.fhb.fullExemptionUpTo) / (r.fhb.concessionUpTo - r.fhb.fullExemptionUpTo);
        }
        break;
      }
      case 'SA': {
        // No concession on established homes; new/land/OTP fully exempt
        if (isNewBuild || isLand) { duty = 0; }
        break;
      }
      case 'TAS': {
        if (v <= r.fhb.fullExemptionUpTo) { duty = 0; }
        break;
      }
      case 'ACT': {
        // Home Buyer Concession Scheme (income-tested) — full exemption ≤$1,020,000
        if (v <= r.hbcs.fullExemptionUpTo) { duty = 0; }
        break;
      }
      case 'NT':
        // No general FHB duty concession on established homes
        break;
    }
  }

  // Foreign buyer surcharge
  if (isForeignBuyer && r.foreignSurcharge) {
    duty += v * r.foreignSurcharge;
  }

  return Math.round(duty);
}

// ── Transfer / Mortgage Registration fees ────────────────────────────────────
export function calculateTransferFee(stateCode, propertyValue) {
  const v = Number(propertyValue) || 0;
  if (!v) return 0;
  switch (stateCode) {
    case 'NSW': return Math.min(Math.max(Math.round(109 + Math.floor(v / 1000) * 3.4), 109), 50000);
    case 'VIC': return Math.min(Math.max(Math.round(109 + Math.floor(v / 1000) * 2.34), 109), 150000);
    case 'QLD': return Math.min(Math.round(600 + Math.floor(v / 10000) * 33), 3500);
    case 'SA':  return Math.min(Math.round(163 + Math.floor(v / 5000) * 11), 15000);
    case 'WA':  return Math.min(Math.round(168 + Math.floor(v / 100000) * 20), 1500);
    case 'ACT': return 1230;
    case 'NT':  return Math.min(Math.round(141 + Math.floor(v / 10000) * 12), 2000);
    case 'TAS': return Math.min(Math.round(174 + Math.floor(v / 10000) * 14), 3000);
    default: return 0;
  }
}

export function calculateMortgageRegistration(stateCode, loanAmount) {
  const v = Number(loanAmount) || 0;
  if (!v) return 0;
  switch (stateCode) {
    case 'NSW': return Math.min(Math.max(Math.round(109 + Math.floor(v / 1000) * 3.4), 109), 5000);
    case 'VIC': return Math.min(Math.round(109 + Math.floor(v / 1000) * 2.34), 5000);
    case 'QLD': return 194;
    case 'SA':  return 163;
    case 'WA':  return Math.min(Math.round(168 + Math.floor(v / 100000) * 5), 500);
    case 'ACT': return 161;
    case 'NT':  return 141;
    case 'TAS': return 174;
    default: return 0;
  }
}

// ── LMI (simplified tier estimate) ──────────────────────────────────────────
export function calculateLMI(loanAmount, propertyValue, lmiWaived) {
  if (lmiWaived || !loanAmount || !propertyValue) return 0;
  const lvr = loanAmount / propertyValue;
  if (lvr <= 0.8) return 0;
  let rate;
  if (lvr <= 0.85)      rate = 0.0077;
  else if (lvr <= 0.9)  rate = 0.0158;
  else if (lvr <= 0.95) rate = 0.0374;
  else                   rate = 0.0449;
  return Math.round(loanAmount * rate);
}

// ── Repayment ────────────────────────────────────────────────────────────────
export function calculateRepayment(loanAmount, annualRate, termYears, ioTermYears = 0) {
  if (!loanAmount || !annualRate || !termYears) return 0;
  const r = annualRate / 100 / 12;
  if (ioTermYears > 0) return Math.round(loanAmount * r); // IO repayment
  const n = termYears * 12;
  return Math.round(loanAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
}
