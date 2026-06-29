import { useState, useMemo, useRef, useEffect } from 'react';
import Toggle from './Toggle';
import { SelectField } from './Field';
import {
  calculateStampDuty,
  calculateTransferFee,
  calculateMortgageRegistration,
  calculateLMI,
  calculateRepayment,
} from '../utils/calculations';

const STATES = ['New South Wales','Victoria','Queensland','South Australia','Western Australia','Australian Capital Territory','Northern Territory','Tasmania'];
const STATE_CODES = { 'New South Wales':'NSW','Victoria':'VIC','Queensland':'QLD','South Australia':'SA','Western Australia':'WA','Australian Capital Territory':'ACT','Northern Territory':'NT','Tasmania':'TAS' };
const PROPERTY_TYPES = ['Established Home','New Home','Vacant Land','Off the Plan'];
const PURPOSES = ['Owner Occupied','Investment'];
const DEFAULT_FEES = 3000;
const DEFAULT_RATE = 6.25;
const DEFAULT_TERM = 30;

function fmt(n) {
  if (n == null || n === '') return '$0';
  return '$' + Math.round(Number(n)).toLocaleString();
}
function fmtPct(n, dec = 2) {
  if (!n) return '0.00%';
  return Number(n).toFixed(dec) + '%';
}

// Dollar input that displays with comma formatting while editing
function DollarInput({ value, onChange, className, placeholder }) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');
  const onFocus = () => { setRaw(value > 0 ? String(value) : ''); setFocused(true); };
  const onBlur = () => { const n = Number(raw.replace(/[^0-9.]/g, '')); onChange(isNaN(n) ? 0 : n); setFocused(false); };
  const display = focused ? raw : (value > 0 ? Number(value).toLocaleString() : '');
  return (
    <input
      className={className}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={display}
      onFocus={onFocus}
      onChange={e => setRaw(e.target.value)}
      onBlur={onBlur}
    />
  );
}

// Sidebar toggle row
function SbToggle({ label, sub, checked, onChange, disabled, info }) {
  return (
    <div className={`sb-toggle-item ${disabled ? 'sb-toggle-disabled' : ''}`}>
      <div className="sb-toggle-text">
        <span className="sb-toggle-label">{label}</span>
        {sub && <span className="sb-toggle-sub">{sub}</span>}
      </div>
      {info && <span className="info-icon" title={info}>i</span>}
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// Hero cell (editable) — kept for internal use / print page
function HeroCell({ label, value, editable, onEdit, sub }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const ref = useRef();
  const start = () => {
    if (!editable) return;
    setRaw(value > 0 ? String(value) : '');
    setEditing(true);
    setTimeout(() => ref.current?.select(), 0);
  };
  const commit = () => {
    const n = Number(raw.replace(/[^0-9.]/g, ''));
    onEdit(isNaN(n) ? 0 : n);
    setEditing(false);
  };
  return (
    <div className="hero-item" onClick={!editing ? start : undefined}>
      <div className="hero-label">{label}{editable && <span className="hero-edit-hint"> ✎</span>}</div>
      {editing ? (
        <input ref={ref} className="hero-edit-input" type="number" value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} />
      ) : (
        <div className={`hero-value ${editable ? 'hero-value-editable' : ''}`}>{fmt(value)}</div>
      )}
      <div className="hero-sub">{sub || ''}</div>
    </div>
  );
}

// Loan row (label + value + toggle)
function LoanRow({ label, displayValue, overrideActive, overrideInput, onToggle }) {
  return (
    <div className={`loan-row ${overrideActive ? 'loan-row-active' : ''}`}>
      <span className="loan-row-label">{label}</span>
      <div className="loan-row-right">
        {overrideActive && overrideInput ? overrideInput : <span className="loan-row-value">{displayValue}</span>}
        {!overrideActive && <span className="autocalc-badge">AUTO</span>}
        <Toggle checked={overrideActive} onChange={onToggle} />
      </div>
    </div>
  );
}

// Cost row (simple label + value)
function CostRow({ label, value, valueClass }) {
  return (
    <div className="cost-row">
      <span className="cost-label">{label}</span>
      <span className={`cost-value ${valueClass || ''}`}>{value}</span>
    </div>
  );
}

export default function PropertyCalculator({ propIndex, label, onSummaryUpdate, initialValues }) {
  // ── Left panel ───────────────────────────────────────────────────────────
  const [state, setState] = useState(initialValues?.state || 'New South Wales');
  const [propertyType, setPropertyType] = useState(initialValues?.propertyType || 'Established Home');
  const [purpose, setPurpose] = useState(initialValues?.purpose || 'Owner Occupied');
  const [firstHome, setFirstHome] = useState(initialValues?.firstHome || false);
  const [foreignBuyer, setForeignBuyer] = useState(initialValues?.foreignBuyer || false);

  // ── LMI waivers ─────────────────────────────────────────────────────────
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fhgScheme, setFhgScheme] = useState(false);
  const [profLmi, setProfLmi] = useState(false);
  const [famGuarantor, setFamGuarantor] = useState(false);

  // ── Core inputs ──────────────────────────────────────────────────────────
  const [propertyValue, setPropertyValue] = useState(initialValues?.pv || 0);

  const [baseLvrOverride, setBaseLvrOverride] = useState(initialValues?.lvr != null);
  const [baseLvrManual, setBaseLvrManual] = useState(initialValues?.lvr != null ? initialValues.lvr : 80);

  const [baseLoanOverride, setBaseLoanOverride] = useState(false);
  const [baseLoanManual, setBaseLoanManual] = useState(0);

  const [totalLoanOverride, setTotalLoanOverride] = useState(false);
  const [totalLoanManual, setTotalLoanManual] = useState(0);

  // Always use depositOverride = true in new UI
  const depositOverride = true;
  const [depositManual, setDepositManual] = useState(0);

  // Auto-set deposit to 20% when property value is first set
  const pvInitialized = useRef(false);
  useEffect(() => {
    const pv = Number(propertyValue) || 0;
    if (pv > 0 && !pvInitialized.current) {
      pvInitialized.current = true;
      if (depositManual === 0) {
        setDepositManual(Math.round(pv * 0.2));
      }
    }
  }, [propertyValue]);

  // ── Repayment ────────────────────────────────────────────────────────────
  const [rate, setRate] = useState(initialValues?.rate ?? DEFAULT_RATE);
  const [term, setTerm] = useState(initialValues?.term ?? DEFAULT_TERM);
  const [ioTerm, setIoTerm] = useState(0);

  // ── LMI options ──────────────────────────────────────────────────────────
  const [capLMI, setCapLMI] = useState(true);
  const [overrideLMI, setOverrideLMI] = useState(false);
  const [lmiManualAmt, setLmiManualAmt] = useState(0);

  // ── Breakdown ────────────────────────────────────────────────────────────
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [govtChargesOn, setGovtChargesOn] = useState(true);
  const [stampDutyOverride, setStampDutyOverride] = useState(false);
  const [stampDutyManual, setStampDutyManual] = useState(0);
  const [stampDutyConcOverride, setStampDutyConcOverride] = useState(false);
  const [stampDutyConcManual, setStampDutyConcManual] = useState(0);

  // ── Detailed fees ───────────────────────────────────────────────────────
  const [useDetailedFees, setUseDetailedFees] = useState(false);
  const [conveyancerFee, setConveyancerFee] = useState(2000);
  const [bankFee, setBankFee] = useState(600);
  const [buildingInspection, setBuildingInspection] = useState(500);
  const [pestInspection, setPestInspection] = useState(300);
  const [otherFees, setOtherFees] = useState(0);

  // ── First Home Owner Grant ───────────────────────────────────────────────
  const [includeFhog, setIncludeFhog] = useState(false);
  const [fhogOverride, setFhogOverride] = useState(false);
  const [fhogManual, setFhogManual] = useState(0);

  // ── Council / water rates adjustment ────────────────────────────────────
  const [includeRates, setIncludeRates] = useState(false);
  const [ratesAmount, setRatesAmount] = useState(800);

  const stateCode = STATE_CODES[state] || 'NSW';
  const lmiWaived = fhgScheme || profLmi || famGuarantor;

  const FHOG_AMOUNTS = { NSW: 10000, VIC: 10000, QLD: 30000, SA: 15000, WA: 10000, TAS: 30000, ACT: 0, NT: 10000 };
  const isNewBuild = propertyType === 'New Home' || propertyType === 'Off the Plan' || propertyType === 'Vacant Land';
  const autoFhog = (firstHome && isNewBuild) ? (FHOG_AMOUNTS[stateCode] || 0) : 0;

  // ── All computation in one memo ──────────────────────────────────────────
  const C = useMemo(() => {
    const pv = Number(propertyValue) || 0;

    const baseLvr = baseLvrOverride ? Number(baseLvrManual) : 80;

    const fees = useDetailedFees
      ? (Number(conveyancerFee) + Number(bankFee) + Number(buildingInspection) + Number(pestInspection) + Number(otherFees))
      : DEFAULT_FEES;
    const ratesAdj = includeRates ? Number(ratesAmount) : 0;
    const fhog = includeFhog ? (fhogOverride ? Number(fhogManual) : autoFhog) : 0;

    const autoStampDuty = calculateStampDuty(stateCode, pv, {
      isFirstHome: firstHome,
      isOwnerOccupier: purpose === 'Owner Occupied',
      propertyType,
      isForeignBuyer: foreignBuyer,
    });
    const stampDuty = stampDutyOverride ? Number(stampDutyManual) : autoStampDuty;
    const stampDutyConc = stampDutyConcOverride ? Number(stampDutyConcManual) : 0;
    const netStampDuty = Math.max(0, stampDuty - stampDutyConc);
    const transferFee = calculateTransferFee(stateCode, pv);

    let rawBaseLoan;
    if (depositOverride) {
      const D = Number(depositManual);
      let est = Math.max(0, pv + (govtChargesOn ? (netStampDuty + transferFee) : 0) + fees - D);
      for (let i = 0; i < 5; i++) {
        const mortRegEst = calculateMortgageRegistration(stateCode, est);
        const totalGovtEst = govtChargesOn ? (netStampDuty + transferFee + mortRegEst) : 0;
        const lmiEst = overrideLMI ? Number(lmiManualAmt) : calculateLMI(est, pv, lmiWaived, stateCode).lmi;
        const next = Math.max(0, Math.round(
          capLMI
            ? pv + totalGovtEst + fees - D - lmiEst
            : pv + totalGovtEst + fees + lmiEst - D
        ));
        if (next === est) break;
        est = next;
      }
      rawBaseLoan = est;
    } else if (baseLoanOverride) {
      rawBaseLoan = Number(baseLoanManual);
    } else if (totalLoanOverride) {
      rawBaseLoan = Number(totalLoanManual);
    } else {
      rawBaseLoan = Math.round(pv * baseLvr / 100);
    }

    const mortgageReg = calculateMortgageRegistration(stateCode, rawBaseLoan);
    const totalGovt = govtChargesOn ? (netStampDuty + transferFee + mortgageReg) : 0;

    const lmiResult = calculateLMI(rawBaseLoan, pv, lmiWaived, stateCode);
    const lmiAuto = lmiResult.lmi;
    const lmi = overrideLMI ? Number(lmiManualAmt) : lmiAuto;
    const capitalisedLmi = capLMI ? lmi : 0;

    const totalLoan = (totalLoanOverride && baseLoanOverride)
      ? Number(totalLoanManual)
      : rawBaseLoan + capitalisedLmi;

    const baseLvrCalc = pv > 0 ? (rawBaseLoan / pv * 100) : 0;
    const totalLvr    = pv > 0 ? (totalLoan / pv * 100) : 0;

    const totalFundsRequired = pv + totalGovt + fees + ratesAdj + (capLMI ? 0 : lmi) - fhog;
    const fundsRequired = Math.max(0, totalFundsRequired);

    const repayment = calculateRepayment(totalLoan, rate, term, ioTerm);

    return {
      pv, baseLvr, baseLvrCalc, rawBaseLoan, totalLoan, totalLvr,
      stampDuty, stampDutyConc, netStampDuty, transferFee, mortgageReg, totalGovt,
      lmi, lmiResult, capitalisedLmi, fees, ratesAdj, fhog, fundsRequired, repayment,
      lmiActive: lmi > 0 && !lmiWaived,
    };
  }, [
    propertyValue,
    depositOverride, depositManual,
    baseLvrOverride, baseLvrManual,
    baseLoanOverride, baseLoanManual,
    totalLoanOverride, totalLoanManual,
    stateCode, firstHome, propertyType, purpose, foreignBuyer,
    stampDutyOverride, stampDutyManual, stampDutyConcOverride, stampDutyConcManual,
    govtChargesOn,
    useDetailedFees, conveyancerFee, bankFee, buildingInspection, pestInspection, otherFees,
    includeRates, ratesAmount,
    includeFhog, fhogOverride, fhogManual, autoFhog,
    capLMI, overrideLMI, lmiManualAmt, lmiWaived,
    rate, term, ioTerm,
  ]);

  const { pv, baseLvr, baseLvrCalc, rawBaseLoan, totalLoan, totalLvr,
    stampDuty, stampDutyConc, netStampDuty, transferFee, mortgageReg, totalGovt,
    lmi, lmiResult, capitalisedLmi, fees, ratesAdj, fhog, fundsRequired, repayment, lmiActive } = C;

  const contribution = Math.max(0, fundsRequired - totalLoan);

  useEffect(() => {
    onSummaryUpdate?.({
      label: label || `Property ${propIndex + 1}`,
      pv, totalLoan, rawBaseLoan, totalLvr, lmi, lmiActive, capLMI,
      netStampDuty, transferFee, mortgageReg, totalGovt,
      fees, fundsRequired, contribution, repayment,
      stateCode, purpose, propertyType,
      rate, term, ioTerm,
      inputState: {
        pv,
        state,
        propertyType,
        purpose,
        firstHome,
        foreignBuyer,
        rate,
        term,
        baseLvrManual,
      },
    });
  }, [pv, totalLoan, rawBaseLoan, totalLvr, lmi, lmiActive, capLMI,
      netStampDuty, transferFee, mortgageReg, totalGovt,
      fees, fundsRequired, contribution, repayment,
      stateCode, purpose, propertyType, label, propIndex, rate, term, ioTerm,
      state, firstHome, foreignBuyer, baseLvrManual]);

  const handlePvEdit = (v) => {
    pvInitialized.current = false;
    setPropertyValue(v);
  };

  const handleTotalLoanEdit = (v) => {
    setBaseLoanOverride(true);
    setBaseLoanManual(v);
    setTotalLoanOverride(false);
    setBaseLvrOverride(false);
  };

  // Computed values for new UI
  const depositPct = pv > 0 ? Math.round(depositManual / pv * 100) : 20;
  const loanNeeded = Math.max(0, pv - depositManual);
  const upfrontCosts = Math.max(0, fundsRequired - pv);
  const cashToComplete = contribution;

  // Proportion bar
  const totalBar = depositManual + upfrontCosts;
  const depositBarPct = totalBar > 0 ? (depositManual / totalBar * 100) : 70;
  const costsBarPct = totalBar > 0 ? (upfrontCosts / totalBar * 100) : 30;

  return (
    <>
      <div className="calc-layout">

        {/* LEFT SIDEBAR */}
        <div className="sidebar">
          <div className="sb-section">
            <div className="sb-section-label">Your Purchase</div>

            {/* Property Value */}
            <div className="sb-pv-field">
              <label className="sb-field-label">PROPERTY VALUE</label>
              <div className="sb-dollar-wrap">
                <span className="sb-dollar-sign">$</span>
                <DollarInput
                  className="sb-pv-input"
                  value={propertyValue}
                  onChange={handlePvEdit}
                  placeholder="750,000"
                />
              </div>
            </div>

            <SelectField label="State" value={state} onChange={setState}
              options={STATES.map(s => ({ value: s, label: s }))} />
            <SelectField label="Property Type" value={propertyType} onChange={setPropertyType}
              options={PROPERTY_TYPES} />
            <SelectField label="Purpose" value={purpose} onChange={setPurpose}
              options={PURPOSES} />
          </div>

          {/* Deposit */}
          <div className="sb-section">
            <div className="sb-deposit-header">
              <label className="sb-field-label">DEPOSIT</label>
              <span className="sb-deposit-pct-badge">{pv > 0 ? depositPct + '% of price' : '20% of price'}</span>
            </div>
            <div className="sb-dollar-wrap">
              <span className="sb-dollar-sign">$</span>
              <DollarInput
                className="sb-pv-input"
                value={depositManual}
                onChange={v => {
                  setDepositManual(v);
                  setBaseLoanOverride(false);
                  setBaseLvrOverride(false);
                  setTotalLoanOverride(false);
                }}
                placeholder="150,000"
              />
            </div>
            <input
              type="range"
              className="sb-deposit-slider"
              min={0}
              max={pv || 1000000}
              step={1000}
              value={depositManual}
              onChange={e => {
                const v = Number(e.target.value);
                setDepositManual(v);
                setBaseLoanOverride(false);
                setBaseLvrOverride(false);
                setTotalLoanOverride(false);
              }}
            />
            <div className="sb-loan-needed">
              Loan needed: <strong>{pv > 0 ? fmt(loanNeeded) : '—'}</strong>
            </div>
          </div>

          {/* Buyer Profile */}
          <div className="sb-section">
            <SbToggle label="First home buyer" checked={firstHome} onChange={setFirstHome} />
            <SbToggle label="Foreign buyer" checked={foreignBuyer} onChange={setForeignBuyer} />
          </div>

          {/* Advanced Options */}
          <div className="sb-section">
            <button className="sb-advanced-link" onClick={() => setAdvancedOpen(v => !v)}>
              {advancedOpen ? '− Advanced options' : '+ Advanced options'} · rate, LMI, fees
            </button>

            {advancedOpen && (
              <div className="sb-advanced-body">
                {/* Rate / term */}
                <div className="sb-adv-row">
                  <span className="sb-adv-label">Interest Rate</span>
                  <div className="sb-adv-input-wrap">
                    <input type="number" className="sb-adv-input" value={rate} onChange={e => setRate(Number(e.target.value))} step="0.05" min="0" />
                    <span className="sb-adv-unit">%</span>
                  </div>
                </div>
                <div className="sb-adv-row">
                  <span className="sb-adv-label">Loan Term</span>
                  <div className="sb-adv-input-wrap">
                    <input type="number" className="sb-adv-input" value={term} onChange={e => setTerm(Number(e.target.value))} min="1" max="30" />
                    <span className="sb-adv-unit">yrs</span>
                  </div>
                </div>
                <div className="sb-adv-row">
                  <span className="sb-adv-label">IO Years</span>
                  <div className="sb-adv-input-wrap">
                    <input type="number" className="sb-adv-input" value={ioTerm} onChange={e => setIoTerm(Number(e.target.value))} min="0" max="10" />
                    <span className="sb-adv-unit">yrs</span>
                  </div>
                </div>

                {/* LMI Waivers */}
                <div className="sb-adv-section-label">LMI Waivers</div>
                <SbToggle
                  label="First Home Guarantee"
                  sub="5% deposit, no LMI"
                  checked={fhgScheme}
                  onChange={setFhgScheme}
                  disabled={!firstHome}
                  info="Government scheme — FHBs can buy with 5% deposit and no LMI."
                />
                <SbToggle
                  label="Professional Waiver"
                  sub="Doctors, lawyers, accountants"
                  checked={profLmi}
                  onChange={setProfLmi}
                  info="Eligible professionals may qualify for LMI waiver up to 90% LVR."
                />
                <SbToggle
                  label="Family Guarantor"
                  sub="Equity security from family"
                  checked={famGuarantor}
                  onChange={setFamGuarantor}
                  info="A family member uses equity in their property as additional security."
                />

                {/* Costs & Fees */}
                <div className="sb-adv-section-label">Costs &amp; Fees</div>
                <SbToggle
                  label="Include Govt Charges"
                  sub="Stamp duty, transfer &amp; reg"
                  checked={govtChargesOn}
                  onChange={setGovtChargesOn}
                />
                {firstHome && (
                  <SbToggle
                    label={`FHOG Grant ($${(FHOG_AMOUNTS[stateCode] || 0).toLocaleString()})`}
                    sub={isNewBuild ? 'Applied as cash reduction' : 'New/OTP homes only in ' + stateCode}
                    checked={includeFhog}
                    onChange={setIncludeFhog}
                  />
                )}
                {includeFhog && (
                  <div className="sb-sub-input">
                    <span>Grant Amount</span>
                    <input type="number" value={fhogOverride ? fhogManual : autoFhog}
                      onChange={e => { setFhogOverride(true); setFhogManual(Number(e.target.value)); }} />
                  </div>
                )}
                <SbToggle
                  label="Rates Adjustment"
                  sub="Council/water at settlement"
                  checked={includeRates}
                  onChange={setIncludeRates}
                  info="Buyers typically reimburse seller for prepaid council/water rates."
                />
                {includeRates && (
                  <div className="sb-sub-input">
                    <span>Amount</span>
                    <input type="number" value={ratesAmount} onChange={e => setRatesAmount(Number(e.target.value))} />
                  </div>
                )}
                <SbToggle
                  label="Itemise Fees"
                  sub="Break down individual costs"
                  checked={useDetailedFees}
                  onChange={setUseDetailedFees}
                />
                {useDetailedFees && (
                  <div className="sb-fee-list">
                    {[['Conveyancer', conveyancerFee, setConveyancerFee],
                      ['Bank Fees', bankFee, setBankFee],
                      ['Building Inspection', buildingInspection, setBuildingInspection],
                      ['Pest Inspection', pestInspection, setPestInspection],
                      ['Other', otherFees, setOtherFees]].map(([lbl, val, setter]) => (
                      <div key={lbl} className="sb-fee-row">
                        <span>{lbl}</span>
                        <input type="number" value={val} onChange={e => setter(Number(e.target.value))} />
                      </div>
                    ))}
                  </div>
                )}
                <SbToggle
                  label="Override LMI"
                  sub="Enter exact LMI amount"
                  checked={overrideLMI}
                  onChange={setOverrideLMI}
                />
                {overrideLMI && (
                  <div className="sb-sub-input">
                    <span>LMI Amount</span>
                    <input type="number" value={lmiManualAmt} onChange={e => setLmiManualAmt(Number(e.target.value))} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT CONTENT */}
        <div className="calc-right">

          {/* HERO SECTION */}
          <div className="hero-section">
            <div className="hero-main">
              <div className="hero-gold-label">CASH YOU NEED TO COMPLETE</div>
              <div className="hero-big-number">
                {pv > 0 ? fmt(contribution) : '$—'}
              </div>
              <div className="hero-subtitle">
                {pv > 0
                  ? `Your ${depositPct}% deposit plus all upfront costs to settle a ${fmt(pv)} home in ${state}.`
                  : 'Enter a property value to see your funds to complete.'
                }
              </div>
            </div>
            <div className="hero-stat-cards">
              <div className="hero-stat-card">
                <div className="hsc-label">HOME LOAN</div>
                <div className="hsc-value">{fmt(totalLoan)}</div>
              </div>
              <div className="hero-stat-card">
                <div className="hsc-label">LVR</div>
                <div className={`hsc-value ${lmiActive ? 'hsc-lmi' : ''}`}>{fmtPct(totalLvr, 1)}</div>
              </div>
              <div className="hero-stat-card">
                <div className="hsc-label">EST. REPAYMENT</div>
                <div className="hsc-value">{fmt(repayment)}<span className="hsc-mo">/mo</span></div>
              </div>
            </div>
          </div>

          {/* MAIN WHITE CARD */}
          <div className="main-card">
            {/* WHERE YOUR CASH GOES */}
            <div className="main-card-section">
              <div className="mcs-label">WHERE YOUR CASH GOES</div>
              {/* Proportional bar */}
              <div className="funds-bar">
                <div className="funds-bar-deposit" style={{ width: `${depositBarPct}%` }} />
                <div className="funds-bar-costs" style={{ width: `${costsBarPct}%` }} />
              </div>
              <div className="funds-legend">
                <div className="funds-legend-item">
                  <span className="fli-dot fli-dot-dark" />
                  <span>Deposit {fmt(depositManual)} &middot; {depositBarPct.toFixed(0)}%</span>
                </div>
                <div className="funds-legend-item">
                  <span className="fli-dot fli-dot-gold" />
                  <span>Costs {fmt(upfrontCosts)} &middot; {costsBarPct.toFixed(0)}%</span>
                </div>
              </div>
            </div>

            <div className="main-card-divider" />

            {/* UPFRONT COSTS BREAKDOWN */}
            <div className="main-card-section">
              <div className="mcs-label">UPFRONT COSTS BREAKDOWN</div>
              <div className="costs-grid">
                <div className="costs-col">
                  <div className="costs-item">
                    <span className="ci-label">Government stamp duty</span>
                    <span className="ci-value">{govtChargesOn ? fmt(netStampDuty) : '—'}</span>
                  </div>
                  <div className="costs-item">
                    <span className="ci-label">Transfer &amp; registration</span>
                    <span className="ci-value">{govtChargesOn ? fmt(transferFee + mortgageReg) : '—'}</span>
                  </div>
                  <div className="costs-item">
                    <span className="ci-label">Legal &amp; bank fees</span>
                    <span className="ci-value">{fmt(fees)}</span>
                  </div>
                  <div className="costs-item">
                    <span className="ci-label">Lenders mortgage insurance</span>
                    <span className={`ci-value ${lmiActive ? '' : 'ci-value-green'}`}>
                      {lmiActive ? fmt(lmi) : 'Not payable'}
                    </span>
                  </div>
                </div>
                <div className="costs-col">
                  {ratesAdj > 0 && (
                    <div className="costs-item">
                      <span className="ci-label">Council &amp; water (rates)</span>
                      <span className="ci-value">{fmt(ratesAdj)}</span>
                    </div>
                  )}
                  {fhog > 0 && (
                    <div className="costs-item">
                      <span className="ci-label">First Home Owner Grant</span>
                      <span className="ci-value ci-value-green">&minus;{fmt(fhog)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM EQUATION BAR */}
          <div className="equation-bar">
            <div className="eq-item">
              <span className="eq-label">DEPOSIT</span>
              <span className="eq-value">{fmt(depositManual)}</span>
            </div>
            <div className="eq-op">+</div>
            <div className="eq-item">
              <span className="eq-label">UPFRONT COSTS</span>
              <span className="eq-value">{fmt(upfrontCosts)}</span>
            </div>
            <div className="eq-op">=</div>
            <div className="eq-item eq-item-highlight">
              <span className="eq-label eq-label-hl">CASH TO COMPLETE</span>
              <span className="eq-value eq-value-hl">{pv > 0 ? fmt(cashToComplete) : '$—'}</span>
            </div>
          </div>

        </div>
      </div>

      {/* PRINT PAGE — hidden on screen */}
      <div className="print-page">
        {/* Header */}
        <div className="pp-header">
          <div className="pp-logo">
            <svg className="pp-logo-mark" width="44" height="44" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 6 L94 46 L94 94 L6 94 L6 46 Z" fill="#1a1a1a" />
              <path d="M37 94 L37 65 A13 13 0 0 1 63 65 L63 94 Z" fill="white" />
            </svg>
            <div className="pp-logo-text">
              <span className="pp-logo-eyebrow">Mortgage Broker Brisbane</span>
              <span className="pp-logo-name">Hunter <span>Galloway</span></span>
            </div>
          </div>
          <div className="pp-header-right">
            <div className="pp-doc-title">Funds to Complete</div>
            <div className="pp-doc-sub">Prepared {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
        </div>

        {/* Property name */}
        <div className="pp-property-name">
          {label || `Property ${propIndex + 1}`}
          <span className="pp-property-badge">{stateCode} &middot; {propertyType}</span>
        </div>

        {/* 4 key figures */}
        <div className="pp-kpi-row">
          <div className="pp-kpi">
            <div className="pp-kpi-label">Property Value</div>
            <div className="pp-kpi-value">{fmt(pv)}</div>
            <div className="pp-kpi-sub">{purpose}</div>
          </div>
          <div className="pp-kpi">
            <div className="pp-kpi-label">Loan Amount</div>
            <div className="pp-kpi-value">{fmt(totalLoan)}</div>
            <div className="pp-kpi-sub">Base {fmt(rawBaseLoan)}{lmiActive ? ` + LMI ${fmt(lmi)}` : ''}</div>
          </div>
          <div className="pp-kpi">
            <div className="pp-kpi-label">LVR</div>
            <div className={`pp-kpi-value ${lmiActive ? 'gold' : ''}`}>{fmtPct(totalLvr, 1)}</div>
            <div className="pp-kpi-sub">{lmiActive ? '⚠ LMI applies' : '✓ No LMI'}</div>
          </div>
          <div className="pp-kpi highlight">
            <div className="pp-kpi-label">Cash Required</div>
            <div className="pp-kpi-value">{fmt(contribution)}</div>
            <div className="pp-kpi-sub">Total funds {fmt(fundsRequired)}</div>
          </div>
        </div>

        {/* Body — two columns */}
        <div className="pp-body">
          <div className="pp-section">
            <div className="pp-section-title">Cost Breakdown</div>
            <div className="pp-row">
              <span className="pp-row-label">Purchase Price</span>
              <span className="pp-row-value">{fmt(pv)}</span>
            </div>
            <div className="pp-row">
              <span className="pp-row-label">Stamp Duty</span>
              <span className="pp-row-value">{fmt(netStampDuty)}</span>
            </div>
            <div className="pp-row">
              <span className="pp-row-label">Transfer &amp; Registration Fees</span>
              <span className="pp-row-value">{fmt(transferFee + mortgageReg)}</span>
            </div>
            <div className="pp-row">
              <span className="pp-row-label">Legal &amp; Bank Fees</span>
              <span className="pp-row-value">{fmt(fees)}</span>
            </div>
            {ratesAdj > 0 && (
              <div className="pp-row">
                <span className="pp-row-label">Rates Adjustment</span>
                <span className="pp-row-value">{fmt(ratesAdj)}</span>
              </div>
            )}
            {!capLMI && lmi > 0 && (
              <div className="pp-row lmi-row">
                <span className="pp-row-label">LMI Premium (upfront)</span>
                <span className="pp-row-value">{fmt(lmi)}</span>
              </div>
            )}
            {fhog > 0 && (
              <div className="pp-row" style={{ color: '#059669' }}>
                <span className="pp-row-label">First Home Owner Grant</span>
                <span className="pp-row-value">&minus;{fmt(fhog)}</span>
              </div>
            )}
            <div className="pp-row total">
              <span className="pp-row-label">Total Funds Required</span>
              <span className="pp-row-value">{fmt(fundsRequired)}</span>
            </div>
          </div>

          <div className="pp-section">
            <div className="pp-section-title">How It's Funded</div>
            <div className="pp-row">
              <span className="pp-row-label">Base Loan</span>
              <span className="pp-row-value">{fmt(rawBaseLoan)}</span>
            </div>
            {lmiActive && capLMI && (
              <div className="pp-row lmi-row">
                <span className="pp-row-label">+ LMI (capitalised into loan)</span>
                <span className="pp-row-value">{fmt(lmi)}</span>
              </div>
            )}
            <div className="pp-row">
              <span className="pp-row-label">Total Loan Amount</span>
              <span className="pp-row-value">{fmt(totalLoan)}</span>
            </div>
            <div className="pp-row total">
              <span className="pp-row-label">Cash Deposit Required</span>
              <span className="pp-row-value">{fmt(contribution)}</span>
            </div>
          </div>
        </div>

        {/* Repayment estimate */}
        <div className="pp-repayment">
          <div>
            <div className="pp-repayment-label">Estimated Monthly Repayment</div>
            <div className="pp-repayment-detail">{fmtPct(rate, 2)} p.a. &middot; {term} yr loan{ioTerm > 0 ? ` · ${ioTerm} yr IO` : ' · P&I'}</div>
          </div>
          <div className="pp-repayment-value">{fmt(repayment)}/mo</div>
        </div>

        {/* LMI note if applicable */}
        {lmiActive && (
          <div className="pp-lmi-note">
            <strong>⚠ Lender's Mortgage Insurance (LMI) applies</strong> — estimated {fmt(lmi)}.
            LVR of {fmtPct(totalLvr, 1)} exceeds 80%. LMI is {capLMI ? 'capitalised into the loan' : 'payable upfront'}.
            This is an industry estimate only — confirm the exact premium with your lender at application.
          </div>
        )}

        {/* Footer */}
        <div className="pp-footer">
          <div className="pp-footer-contact">
            <div className="pp-date">Prepared {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            <strong>Hunter Galloway</strong> — Mortgage Broker Brisbane<br />
            1300 088 065 &nbsp;&middot;&nbsp; hello@huntergalloway.com.au<br />
            Level 10, 179 North Quay, Brisbane QLD 4000
          </div>
          <div className="pp-footer-disclaimer">
            This document is prepared as a guide only and does not constitute financial advice.
            All figures are estimates based on information provided and may vary. Government charges,
            LMI premiums and fees are subject to change. Please confirm all amounts with your
            solicitor and lender prior to settlement. Hunter Galloway Pty Ltd is a Credit
            Representative of BLSSA Pty Ltd ACL 391237.
          </div>
        </div>
      </div>
    </>
  );
}
