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

// ── LMI Estimator (real industry rate table) ─────────────────────────────────
// Source: Home Loan Experts published rate table ("one of our lenders" — bank
// identity withheld at the bank's request), updated 18 May 2026.
// Rows = LVR bands (upper bound %, 1% wide starting at 80.01%)
// Cols = Loan size bands (upper bound $)
//
// IMPORTANT DISCLAIMER: LMI premiums are NOT publicly published on a per-bank
// basis. This uses an industry-representative table. No bank publicly discloses
// its exact rate — get a real quote from the lender at application time.

const LVR_BANDS  = [81,82,83,84,85,86,87,88,89,90,91,92,93,94,95];
const LOAN_BANDS = [300000, 500000, 600000, 750000, 1000000];

const LMI_RATE_TABLE = [
  [0.00475, 0.00568, 0.00904, 0.00904, 0.00913], // 80.01–81%
  [0.00485, 0.00568, 0.00904, 0.00904, 0.00913], // 81.01–82%
  [0.00596, 0.00699, 0.00932, 0.01090, 0.01109], // 82.01–83%
  [0.00662, 0.00829, 0.00960, 0.01090, 0.01146], // 83.01–84%
  [0.00727, 0.00969, 0.01165, 0.01333, 0.01407], // 84.01–85%
  [0.00876, 0.01081, 0.01258, 0.01407, 0.01463], // 85.01–86%
  [0.00932, 0.01146, 0.01407, 0.01631, 0.01733], // 86.01–87%
  [0.01062, 0.01305, 0.01463, 0.01631, 0.01752], // 87.01–88%
  [0.01295, 0.01621, 0.01948, 0.02218, 0.02395], // 88.01–89%
  [0.01463, 0.01873, 0.02180, 0.02367, 0.02516], // 89.01–90%
  [0.02013, 0.02618, 0.03513, 0.03783, 0.03820], // 90.01–91%
  [0.02013, 0.02674, 0.03569, 0.03867, 0.03932], // 91.01–92%
  [0.02330, 0.03028, 0.03802, 0.04081, 0.04156], // 92.01–93%
  [0.02376, 0.03028, 0.03802, 0.04286, 0.04324], // 93.01–94%
  [0.02609, 0.03345, 0.03998, 0.04613, 0.04603], // 94.01–95%
];

// Stamp duty on the LMI premium — legislated per state, verified 26 June 2026
const LMI_STAMP_DUTY = { NSW: 0.00, VIC: 0.10, QLD: 0.09, SA: 0.11, WA: 0.10, TAS: 0.10, ACT: 0.00, NT: 0.10 };

function lvrBandIdx(lvrPct) {
  if (lvrPct <= 80) return -1;
  for (let i = 0; i < LVR_BANDS.length; i++) {
    if (lvrPct <= LVR_BANDS[i]) return i;
  }
  return LVR_BANDS.length - 1;
}
function loanBandIdx(loan) {
  for (let j = 0; j < LOAN_BANDS.length; j++) {
    if (loan <= LOAN_BANDS[j]) return j;
  }
  return LOAN_BANDS.length - 1;
}

export function calculateLMI(loanAmount, propertyValue, lmiWaived, stateCode = 'NSW') {
  if (lmiWaived || !loanAmount || !propertyValue) return { lmi: 0, basePremium: 0, dutyOnPremium: 0, rate: 0, warnings: [] };
  const lvrPct = (loanAmount / propertyValue) * 100;
  if (lvrPct <= 80) return { lmi: 0, basePremium: 0, dutyOnPremium: 0, rate: 0, warnings: [] };

  const warnings = [];
  if (lvrPct > 95) warnings.push('LVR exceeds 95% — most lenders will not lend above this. Estimate uses the 94–95% band.');
  if (loanAmount > 1000000) warnings.push('Loan exceeds $1M — rate table tops out at the $750k–$1M band. Actual premium may be higher.');

  const i = lvrBandIdx(lvrPct);
  const j = loanBandIdx(loanAmount);
  const rate = LMI_RATE_TABLE[i][j];
  const basePremium = Math.round(loanAmount * rate * 100) / 100;
  const dutyRate = LMI_STAMP_DUTY[stateCode] ?? 0;
  const dutyOnPremium = Math.round(basePremium * dutyRate * 100) / 100;
  const lmi = Math.round(basePremium + dutyOnPremium);

  return { lmi, basePremium, dutyOnPremium, rate, lvrPct: Math.round(lvrPct * 100) / 100, warnings };
}

// ── Repayment ────────────────────────────────────────────────────────────────
export function calculateRepayment(loanAmount, annualRate, termYears, ioTermYears = 0) {
  if (!loanAmount || !annualRate || !termYears) return 0;
  const r = annualRate / 100 / 12;
  if (ioTermYears > 0) return Math.round(loanAmount * r); // IO repayment
  const n = termYears * 12;
  return Math.round(loanAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
}
