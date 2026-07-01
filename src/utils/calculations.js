// ── Stamp Duty Rate Tables (verified 26 June 2026) ───────────────────────────
// Source: au-stamp-duty-calculator.js + au-stamp-duty-rates.json
//
// Verified against state revenue office calculators June 2026:
//   NSW  — $800k established non-FHB → $30,412 ✓ | $500k → $16,912 ✓
//   VIC  — $600k general → $31,070 ✓ | $450k PPR owner-occupier → $18,970 ✓
//   QLD  — $600k owner-occupier home concession → $12,850 ✓
//   WA   — $550k general → $20,140 ✓
//   SA   — $500k general → $21,330 ✓
//   NT   — $400k quadratic formula → ~$16,514 ✓

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

// ── Transfer / Mortgage Registration fees (verified 26 June 2026) ────────────
// Sources: au-government-fees-calculator.js + au-government-fees.json

// WA: flat fee per consideration band
const WA_TRANSFER_BANDS = [
  { upTo: 85000,   fee: 216.60 },
  { upTo: 120000,  fee: 226.60 },
  { upTo: 200000,  fee: 246.60 },
  { upTo: 300000,  fee: 266.60 },
  { upTo: 400000,  fee: 286.60 },
  { upTo: 500000,  fee: 306.60 },
  { upTo: 600000,  fee: 326.60 },
  { upTo: 700000,  fee: 346.60 },
  { upTo: 800000,  fee: 366.60 },
  { upTo: 900000,  fee: 386.60 },
  { upTo: 1000000, fee: 406.60 },
  { upTo: 1100000, fee: 426.60 },
  { upTo: 1200000, fee: 446.60 },
  { upTo: 1300000, fee: 466.60 },
  { upTo: 1400000, fee: 486.60 },
  { upTo: 1500000, fee: 506.60 },
  { upTo: 1600000, fee: 526.60 },
  { upTo: 1700000, fee: 546.60 },
  { upTo: 1800000, fee: 566.60 },
  { upTo: 1900000, fee: 586.60 },
  { upTo: 2000000, fee: 606.60 },
];

function waTransferFee(v) {
  for (const band of WA_TRANSFER_BANDS) {
    if (v <= band.upTo) return band.fee;
  }
  return 606.60 + 20 * Math.ceil((v - 2000000) / 100000);
}

// SA: ad-valorem sliding scale (verified against official table)
function saTransferFee(v) {
  if (v <= 5000)  return 198.00;
  if (v <= 20000) return 221.00;
  if (v <= 40000) return 243.00;
  const steps = Math.ceil(v / 10000) * 10000;
  const stepsAbove40k = (steps - 40000) / 10000;
  return Math.round((342.00 + 102.00 * (stepsAbove40k - 1)) * 100) / 100;
}

// QLD: base + per-$10k increment above $180k (FY2025-26 rates)
function qldTransferFee(v) {
  if (v <= 180000) return 238.14;
  return Math.round((238.14 + 44.71 * Math.ceil((v - 180000) / 10000)) * 100) / 100;
}

// VIC: sliding scale capped at $3,611 (electronic lodgement, 2025-26 — Land Use Victoria)
function vicTransferFee(v) {
  return Math.min(Math.round((101.50 + 2.34 * Math.ceil(v / 1000)) * 100) / 100, 3611);
}

export function calculateTransferFee(stateCode, propertyValue) {
  const v = Number(propertyValue) || 0;
  if (!v) return 0;
  switch (stateCode) {
    case 'NSW': return 175.70;
    case 'VIC': return vicTransferFee(v);
    case 'QLD': return qldTransferFee(v);
    case 'WA':  return waTransferFee(v);
    case 'SA':  return saTransferFee(v);
    case 'TAS': return 250.21;
    case 'ACT': return 479.00;
    case 'NT':  return 176.00; // NT Land Titles Office flat fee (nt.gov.au verified 2025-26)
    default: return 0;
  }
}

export function calculateMortgageRegistration(stateCode, loanAmount) {
  const v = Number(loanAmount) || 0;
  if (!v) return 0;
  switch (stateCode) {
    case 'NSW': return 175.70;
    case 'VIC': return 125.70; // Land Use Victoria 2025-26 (electronic lodgement)
    case 'QLD': return 238.14; // FY2025-26
    case 'WA':  return 216.60;
    case 'SA':  return 198.00;
    case 'TAS': return 163.30;
    case 'ACT': return 178.00;
    case 'NT':  return 176.00; // NT Land Titles Office flat fee (nt.gov.au verified 2025-26)
    default: return 0;
  }
}

// ── LMI Rate Tables — per lender ─────────────────────────────────────────────
// Sources: Westpac OBP Credit Policy (21/08/2022), Helia LMI Premium Calculator
// workbook (Standard product), CBA worked examples (21/09/2024).
// All figures are indicative only — confirm live figures with the lender.

// Stamp duty on LMI premium by state
const LMI_STAMP_DUTY = { NSW: 0.00, VIC: 0.10, QLD: 0.096585365854, SA: 0.11, WA: 0.10, TAS: 0.10, ACT: 0.00, NT: 0.10 };

function _lvrBand(lvr, bounds) {
  for (let i = 0; i < bounds.length; i++) { if (lvr <= bounds[i]) return i; }
  return bounds.length - 1;
}
function _loanBand(loan, bounds) {
  for (let i = 0; i < bounds.length; i++) { if (loan <= bounds[i]) return i; }
  return bounds.length - 1;
}
function _gridRate(loan, lvr, lvrBounds, loanBounds, grid) {
  return grid[_lvrBand(lvr, lvrBounds)][_loanBand(loan, loanBounds)];
}
function _applyStamp(premium, stateCode) {
  const dutyOnPremium = Math.round(premium * (LMI_STAMP_DUTY[stateCode] ?? 0) * 100) / 100;
  return { dutyOnPremium, total: Math.round(premium + dutyOnPremium) };
}

// ── Westpac (ALMI/WLMI) ──────────────────────────────────────────────────────
const WBC_LVR = [75,76,78,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95];
const WBC_LOAN = [300000,500000,750000,1000000,1500000,2000000,2500000,Infinity];
const WBC_RATES = [
  [0.27,0.39,0.49,0.49,0.58,0.66,0.75,0.75],
  [0.34,0.41,0.59,0.60,0.65,0.68,0.72,0.72],
  [0.34,0.45,0.59,0.68,0.68,0.69,0.72,0.72],
  [0.46,0.54,0.75,0.80,0.90,0.91,0.92,0.92],
  [0.60,0.60,0.74,0.74,0.93,0.93,0.93,0.93],
  [0.61,0.61,0.74,0.74,0.93,0.93,0.93,0.93],
  [0.80,0.85,0.97,0.97,1.24,1.24,1.24,1.24],
  [0.80,0.88,1.02,1.02,1.30,1.30,1.30,1.30],
  [0.81,1.08,1.18,1.18,1.52,1.52,1.52,1.52],
  [0.84,1.11,1.26,1.26,1.58,1.58,1.58,1.58],
  [1.18,1.22,1.45,1.45,1.81,1.81,1.81,1.81],
  [1.20,1.28,1.58,1.58,1.86,1.91,1.97,1.97],
  [1.24,1.60,2.00,2.00,2.34,2.34,2.34,2.34],
  [1.68,1.80,2.41,2.41,2.66,2.68,2.80,2.80],
  [1.94,2.38,3.38,3.38,3.52,3.84,4.06,4.06],
  [1.94,2.55,3.51,3.52,3.65,4.03,4.06,4.06],
  [2.28,2.74,3.66,3.66,3.91,4.16,4.33,4.33],
  [2.32,2.76,3.81,3.82,3.98,4.23,4.43,4.43],
  [2.55,3.12,4.00,4.03,4.17,4.55,4.78,4.78],
];

// ── St George / BankSA / Bank of Melbourne (Westpac Group) ───────────────────
const SGB_LOAN = [300000,500000,1000000,Infinity];
const SGB_RATES = [
  [0.27,0.39,0.49,0.58],[0.27,0.39,0.49,0.58],[0.46,0.54,0.75,0.90],[0.46,0.54,0.75,0.90],
  [0.60,0.60,0.74,0.93],[0.61,0.61,0.74,0.93],[0.80,0.85,0.97,1.24],[0.80,0.88,1.02,1.30],
  [0.81,1.08,1.18,1.52],[0.84,1.11,1.26,1.58],[1.18,1.22,1.45,1.81],[1.20,1.28,1.58,1.86],
  [1.24,1.60,2.00,2.34],[1.68,1.80,2.41,2.66],[1.94,2.38,3.38,3.52],[1.94,2.55,3.51,3.65],
  [2.28,2.74,3.66,3.91],[2.32,2.76,3.81,3.98],[2.55,3.12,4.00,4.17],
];

// ── Helia "Standard" — used by ANZ, NAB, Macquarie, ING, Suncorp & others ────
const HELIA_LVR = [60,65,70,75,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95];
const HELIA_LOAN = [300000,500000,600000,750000,1000000,1500000,2000000,2500000,3000000,5000000,Infinity];
const HELIA_RATES = [
  [0.33,0.35,0.37,0.37,0.37,0.42,0.42,0.42,0.42,0.42,0.42],
  [0.35,0.38,0.48,0.48,0.48,0.53,0.53,0.53,0.53,0.53,0.53],
  [0.37,0.40,0.55,0.55,0.55,0.61,0.61,0.61,0.61,0.61,0.61],
  [0.38,0.44,0.74,0.74,0.74,0.81,0.81,0.81,0.81,0.81,0.81],
  [0.42,0.48,0.80,0.80,0.80,0.88,0.88,0.88,0.88,0.88,0.88],
  [0.47,0.55,0.87,0.87,0.87,0.96,0.96,0.96,0.96,0.96,0.96],
  [0.48,0.55,0.87,0.87,0.87,0.96,0.96,0.96,0.96,0.96,0.96],
  [0.67,0.83,1.02,1.02,1.02,1.12,1.12,1.12,1.12,1.12,1.12],
  [0.67,0.83,1.09,1.09,1.09,1.20,1.20,1.20,1.20,1.20,1.20],
  [0.85,1.10,1.25,1.25,1.25,1.38,1.38,1.38,1.38,1.38,1.38],
  [0.87,1.10,1.37,1.37,1.37,1.50,1.50,1.50,1.50,1.50,1.50],
  [1.03,1.25,1.52,1.52,1.52,1.67,1.67,1.67,1.67,1.67,1.67],
  [1.03,1.25,1.60,1.60,1.60,1.77,1.77,1.77,1.77,1.77,1.77],
  [1.34,1.75,2.05,2.05,2.05,2.25,2.25,2.25,2.25,2.25,2.25],
  [1.50,1.91,2.43,2.43,2.43,2.67,2.67,2.67,2.67,2.67,2.67],
  [1.93,2.48,3.35,3.35,3.35,3.69,3.69,3.69,3.69,3.69,3.69],
  [1.93,2.48,3.49,3.49,3.49,3.83,3.83,3.83,3.83,3.83,3.83],
  [2.22,2.81,3.62,3.62,3.62,3.98,3.98,3.98,3.98,3.98,3.98],
  [2.22,2.81,3.96,3.96,3.96,4.36,4.36,4.36,4.36,4.36,4.36],
  [2.47,3.10,4.16,4.16,4.16,4.57,4.57,4.57,4.57,4.57,4.57],
];
const HELIA_MIN_PREMIUM = 1200;
const HELIA_INVESTMENT_LOADER = 1.15;

// ── CBA (modelled curve fitted to CBA's published worked examples) ────────────
const CBA_CURVE = [
  [60,0.35],[70,0.55],[75,0.65],[80,0.80],[82,0.95],
  [84,1.15],[84.80,1.2469],[86,1.29],[87.50,1.3136],
  [88,1.45],[89,1.75],[90,2.05],[90.62,2.3225],
  [91,2.55],[92,2.95],[93,3.35],[94,3.80],[95,4.30],
];
function _cbaBaseRate(lvr) {
  if (lvr <= CBA_CURVE[0][0]) return CBA_CURVE[0][1];
  for (let i = 0; i < CBA_CURVE.length - 1; i++) {
    const [x0,y0] = CBA_CURVE[i], [x1,y1] = CBA_CURVE[i+1];
    if (lvr >= x0 && lvr <= x1) return y0 + (lvr - x0) / (x1 - x0) * (y1 - y0);
  }
  return CBA_CURVE[CBA_CURVE.length - 1][1];
}
function _cbaLoanMultiplier(loan) {
  if (loan <= 300000) return 0.71;
  if (loan <= 750000) return 1.0;
  if (loan <= 1500000) return 1.2;
  return 1.3;
}
const CBA_MIN_PREMIUM_LOW = 1118;
const CBA_MIN_PREMIUM_HIGH = 1397;
const CBA_INVESTMENT_LOADING = 1.15;

// Lender definitions — id, display label, verified flag
export const LMI_LENDERS = [
  { id: 'westpac',  label: 'Westpac',                          verified: true  },
  { id: 'sgb',      label: 'St George / BankSA / Bank of Melb', verified: true  },
  { id: 'helia',    label: 'ANZ / NAB / Macquarie / ING (Helia)', verified: true  },
  { id: 'cba',      label: 'CBA (modelled)',                    verified: false },
];

export function calculateLMI(loanAmount, propertyValue, lmiWaived, stateCode = 'NSW', lenderId = 'helia', isInvestment = false) {
  const zero = { lmi: 0, basePremium: 0, dutyOnPremium: 0, rate: 0, warnings: [], lvrPct: 0 };
  if (lmiWaived || !loanAmount || !propertyValue) return zero;

  const lvrPct = (loanAmount / propertyValue) * 100;
  if (lvrPct <= 80) return zero;

  const warnings = [];
  if (lvrPct > 95) warnings.push('LVR exceeds 95% — most lenders will not lend above this.');

  let rate = 0;
  let basePremium = 0;

  if (lenderId === 'westpac') {
    rate = _gridRate(loanAmount, lvrPct, WBC_LVR, WBC_LOAN, WBC_RATES);
    basePremium = loanAmount * (rate / 100);
  } else if (lenderId === 'sgb') {
    rate = _gridRate(loanAmount, lvrPct, WBC_LVR, SGB_LOAN, SGB_RATES);
    basePremium = loanAmount * (rate / 100);
  } else if (lenderId === 'helia') {
    rate = _gridRate(loanAmount, lvrPct, HELIA_LVR, HELIA_LOAN, HELIA_RATES);
    basePremium = loanAmount * (rate / 100);
    if (isInvestment) basePremium *= HELIA_INVESTMENT_LOADER;
    basePremium = Math.max(basePremium, HELIA_MIN_PREMIUM);
  } else if (lenderId === 'cba') {
    rate = _cbaBaseRate(lvrPct) * _cbaLoanMultiplier(loanAmount);
    basePremium = loanAmount * (rate / 100);
    if (isInvestment) basePremium *= CBA_INVESTMENT_LOADING;
    const minPrem = loanAmount <= 500000 ? CBA_MIN_PREMIUM_LOW : CBA_MIN_PREMIUM_HIGH;
    basePremium = Math.max(basePremium, minPrem);
  }

  basePremium = Math.round(basePremium * 100) / 100;
  const { dutyOnPremium, total } = _applyStamp(basePremium, stateCode);

  return { lmi: total, basePremium, dutyOnPremium, rate, lvrPct: Math.round(lvrPct * 100) / 100, warnings };
}

// ── Repayment ────────────────────────────────────────────────────────────────
export function calculateRepayment(loanAmount, annualRate, termYears, ioTermYears = 0) {
  if (!loanAmount || !annualRate || !termYears) return 0;
  const r = annualRate / 100 / 12;
  if (ioTermYears > 0) return Math.round(loanAmount * r); // IO repayment
  const n = termYears * 12;
  return Math.round(loanAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
}
