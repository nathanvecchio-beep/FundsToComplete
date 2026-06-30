import { useState, useMemo, useRef, useEffect } from 'react';
import Toggle from './Toggle';
import { SelectField } from './Field';
import {
  calculateStampDuty,
  calculateTransferFee,
  calculateMortgageRegistration,
  calculateLMI,
} from '../utils/calculations';

const STATES = ['New South Wales','Victoria','Queensland','South Australia','Western Australia','Australian Capital Territory','Northern Territory','Tasmania'];
const STATE_CODES = { 'New South Wales':'NSW','Victoria':'VIC','Queensland':'QLD','South Australia':'SA','Western Australia':'WA','Australian Capital Territory':'ACT','Northern Territory':'NT','Tasmania':'TAS' };
const PROPERTY_TYPES = ['Established Home','New Home','Vacant Land','Off the Plan'];
const PURPOSES = ['Owner Occupied','Investment'];
const DEFAULT_FEES = 3000;

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

// Editable stat card — click the value to override it inline
function EditableStatCard({ label, displayValue, editValue, editable, onEdit, inputPrefix, inputSuffix, sub, valueClass }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const ref = useRef();

  const start = (e) => {
    if (!editable) return;
    e.stopPropagation();
    setRaw(String(editValue ?? ''));
    setEditing(true);
    setTimeout(() => ref.current?.select(), 0);
  };
  const commit = () => {
    const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (!isNaN(n)) onEdit(n);
    setEditing(false);
  };

  return (
    <div className={`hero-stat-card ${editable ? 'hsc-editable' : ''}`} onClick={start}>
      <div className="hsc-label">{label}</div>
      {editing ? (
        <div className="hsc-edit-row" onClick={e => e.stopPropagation()}>
          {inputPrefix && <span className="hsc-edit-affix">{inputPrefix}</span>}
          <input
            ref={ref}
            className="hsc-edit-input"
            type="text"
            inputMode="decimal"
            value={raw}
            onChange={e => setRaw(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          />
          {inputSuffix && <span className="hsc-edit-affix">{inputSuffix}</span>}
        </div>
      ) : (
        <div className={`hsc-value ${valueClass || ''} ${editable ? 'hsc-value-editable' : ''}`}>
          {displayValue}
          {editable && <span className="hsc-edit-hint">✎</span>}
        </div>
      )}
      {sub && <div className="hsc-sub">{sub}</div>}
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

  const [depositOverride, setDepositOverride] = useState(false);
  const [depositManual, setDepositManual] = useState(0);

  // Deposit display value — tracks what the sidebar shows.
  // We drive the loan via baseLvr (% of property), not via depositOverride,
  // so the loan stays clean (80% of PV) and costs are separate.
  const [depositDisplay, setDepositDisplay] = useState(0);

  const pvInitialized = useRef(false);


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

  // ── Extra funds (sale proceeds, gifts, shares, etc.) ─────────────────────
  const [extraFunds, setExtraFunds] = useState([]);
  const addExtraFund = () => setExtraFunds(f => [...f, { id: Date.now(), label: '', amount: 0 }]);
  const removeExtraFund = (id) => setExtraFunds(f => f.filter(x => x.id !== id));
  const updateExtraFund = (id, field, value) => setExtraFunds(f => f.map(x => x.id === id ? { ...x, [field]: value } : x));
  const extraFundsTotal = extraFunds.reduce((s, f) => s + (Number(f.amount) || 0), 0);

  // ── Sundry fees (user-fillable in Funds Required) ────────────────────────
  const [lenderSetupFees, setLenderSetupFees] = useState(0);
  const [clientLegalFees, setClientLegalFees] = useState(0);
  const [mortgageDischargeFees, setMortgageDischargeFees] = useState(0);
  const [otherSundries, setOtherSundries] = useState(0);
  const sundryTotal = lenderSetupFees + clientLegalFees + mortgageDischargeFees + otherSundries;

  // ── Debts to close ────────────────────────────────────────────────────────
  const [debts, setDebts] = useState([]);
  const addDebt = () => setDebts(d => [...d, { id: Date.now(), label: '', amount: 0 }]);
  const removeDebt = (id) => setDebts(d => d.filter(x => x.id !== id));
  const updateDebt = (id, field, value) => setDebts(d => d.map(x => x.id === id ? { ...x, [field]: value } : x));
  const debtsTotal = debts.reduce((s, d) => s + (Number(d.amount) || 0), 0);

  const stateCode = STATE_CODES[state] || 'NSW';
  const lmiWaived = fhgScheme || profLmi || famGuarantor;

  const FHOG_AMOUNTS = { NSW: 10000, VIC: 10000, QLD: 30000, SA: 15000, WA: 10000, TAS: 30000, ACT: 0, NT: 10000 };
  const isNewBuild = propertyType === 'New Home' || propertyType === 'Off the Plan' || propertyType === 'Vacant Land';
  const autoFhog = (firstHome && isNewBuild) ? (FHOG_AMOUNTS[stateCode] || 0) : 0;

  // ── All computation in one memo ──────────────────────────────────────────
  const C = useMemo(() => {
    const pv = Number(propertyValue) || 0;

    const baseLvr = baseLvrOverride ? Number(baseLvrManual) : 0;

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

    const mortgageReg = calculateMortgageRegistration(stateCode, rawBaseLoan || pv);
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

    return {
      pv, baseLvr, baseLvrCalc, rawBaseLoan, totalLoan, totalLvr,
      stampDuty, stampDutyConc, netStampDuty, transferFee, mortgageReg, totalGovt,
      lmi, lmiResult, capitalisedLmi, fees, ratesAdj, fhog, fundsRequired,
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
  ]);

  const { pv, baseLvr, baseLvrCalc, rawBaseLoan, totalLoan, totalLvr,
    stampDuty, stampDutyConc, netStampDuty, transferFee, mortgageReg, totalGovt,
    lmi, lmiResult, capitalisedLmi, fees, ratesAdj, fhog, fundsRequired, lmiActive } = C;

  const contribution = Math.max(0, fundsRequired - totalLoan);

  useEffect(() => {
    onSummaryUpdate?.({
      label: label || `Property ${propIndex + 1}`,
      pv, totalLoan, rawBaseLoan, totalLvr, lmi, lmiActive, capLMI,
      netStampDuty, transferFee, mortgageReg, totalGovt,
      fees, fundsRequired, contribution,
      stateCode, purpose, propertyType,
      inputState: {
        pv,
        state,
        propertyType,
        purpose,
        firstHome,
        foreignBuyer,
        baseLvrManual,
      },
    });
  }, [pv, totalLoan, rawBaseLoan, totalLvr, lmi, lmiActive, capLMI,
      netStampDuty, transferFee, mortgageReg, totalGovt,
      fees, fundsRequired, contribution,
      stateCode, purpose, propertyType, label, propIndex,
      state, firstHome, foreignBuyer, baseLvrManual]);

  const handlePvEdit = (v) => {
    setPropertyValue(v);
  };

  const handleLoanEdit = (v) => {
    setBaseLoanOverride(true);
    setBaseLoanManual(v);
    setTotalLoanOverride(false);
    setBaseLvrOverride(false);
    setDepositOverride(false);
  };

  const handleLvrEdit = (v) => {
    const clamped = Math.max(0, Math.min(100, v));
    setBaseLvrManual(clamped);
    setBaseLvrOverride(true);
    setBaseLoanOverride(false);
    setDepositOverride(false);
    setTotalLoanOverride(false);
    if (pv > 0) setDepositDisplay(Math.round(pv * (1 - clamped / 100)));
  };

  // Derived display values
  const depositPct = pv > 0 ? Math.round(depositDisplay / pv * 100) : 0;
  const upfrontCosts = Math.max(0, fundsRequired - pv);

  // Restructured totals: Available = loan + deposit + extra funds
  //                      Required  = purchase price + costs + debts
  const loanForTotal = rawBaseLoan > 0 ? totalLoan : 0;
  const totalAvailable = loanForTotal + depositDisplay + extraFundsTotal;
  const totalRequired = pv + netStampDuty + transferFee + mortgageReg + sundryTotal
    + (lmiActive && !capLMI ? lmi : 0) - fhog + debtsTotal;
  const summaryPosition = totalAvailable - totalRequired;
  const hasSurplus = summaryPosition >= 0;

  const handleDepositChange = (v) => {
    setDepositDisplay(v);
  };

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

            {/* State pill picker */}
          <div style={{ marginBottom: 14 }}>
            <label className="sb-field-label">State / Territory</label>
            <div className="state-pill-grid">
              {Object.entries(STATE_CODES).map(([full, code]) => (
                <button
                  key={code}
                  className={`state-pill${state === full ? ' state-pill-active' : ''}`}
                  onClick={() => setState(full)}
                  title={full}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
            <SelectField label="Property Type" value={propertyType} onChange={setPropertyType}
              options={PROPERTY_TYPES} />
            <SelectField label="Purpose" value={purpose} onChange={setPurpose}
              options={PURPOSES} />
          </div>

          {/* Buyer Profile */}
          <div className="sb-section">
            <SbToggle label="First home buyer" checked={firstHome} onChange={setFirstHome} />
            <SbToggle label="Foreign buyer" checked={foreignBuyer} onChange={setForeignBuyer} />
          </div>

          {/* Advanced Options */}
          <div className="sb-section">
            <button className="sb-advanced-link" onClick={() => setAdvancedOpen(v => !v)}>
              {advancedOpen ? '− Advanced options' : '+ Advanced options'} · LMI, fees
            </button>

            {advancedOpen && (
              <div className="sb-advanced-body">
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

          {/* LMI ALERT BANNER — only shown when LMI applies */}
          {lmiActive && pv > 0 && (
            <div className="lmi-alert-banner">
              <div className="lmi-alert-icon">⚠</div>
              <div className="lmi-alert-body">
                <div className="lmi-alert-title">Lenders Mortgage Insurance applies at {fmtPct(totalLvr, 1)} LVR</div>
                <div className="lmi-alert-sub">
                  Your deposit is below 20% of the property value. LMI protects the lender — not you — and adds {fmt(lmi)} to your loan.
                  Increase your deposit to ≥20% ({fmt(Math.ceil(pv * 0.2))}) or explore an LMI waiver below.
                </div>
              </div>
              <div className="lmi-alert-amount">{fmt(lmi)}</div>
            </div>
          )}

          {/* HERO SECTION */}
          <div className="hero-section">
            <div className="hero-stat-cards">
              <EditableStatCard
                label={lmiActive && capLMI ? 'TOTAL LOAN (INCL. LMI)' : 'HOME LOAN'}
                displayValue={pv > 0 && rawBaseLoan > 0 ? fmt(totalLoan) : '$—'}
                editValue={rawBaseLoan}
                editable={pv > 0}
                onEdit={handleLoanEdit}
                inputPrefix="$"
                sub={lmiActive && capLMI ? `Base ${fmt(rawBaseLoan)} + LMI ${fmt(lmi)}` : null}
              />
              <EditableStatCard
                label="LVR"
                displayValue={pv > 0 && rawBaseLoan > 0 ? fmtPct(totalLvr, 1) : '—'}
                editValue={Number(baseLvr.toFixed(1))}
                editable={pv > 0}
                onEdit={handleLvrEdit}
                inputSuffix="%"
                valueClass={lmiActive ? 'hsc-lmi' : ''}
                sub={pv > 0 && rawBaseLoan > 0 ? (lmiActive ? '⚠ LMI applies' : '✓ No LMI') : null}
              />
              <div className="hero-stat-card">
                <div className="hsc-label">STAMP DUTY</div>
                <div className="hsc-value">{pv > 0 ? fmt(netStampDuty) : '$—'}</div>
                {pv > 0 && <div className="hsc-sub">{stateCode} — {propertyType}</div>}
              </div>
            </div>
          </div>

          {/* FUNDING SUMMARY TABLE */}
          <div className="funding-summary-card">
              <div className="fsc-table">

                {/* LEFT — Funds Available */}
                <div className="fsc-col">
                  <div className="fsc-col-head-row">
                    <div className="fsc-col-head">Funds Available</div>
                  </div>

                  <div className="fsc-row">
                    <span className="fsc-row-label">Home Loan</span>
                    <div className="fsc-amt-wrap">
                      <span className="fsc-edit-amount"><span className="fsc-edit-dollar">$</span><DollarInput className="fsc-edit-input" value={rawBaseLoan > 0 ? totalLoan : 0} onChange={v => handleLoanEdit(v)} placeholder="0" /></span>
                      <div className="fsc-del-spacer" />
                    </div>
                  </div>

                  <div className="fsc-row">
                    <span className="fsc-row-label">Savings / Deposit</span>
                    <div className="fsc-amt-wrap">
                      <span className="fsc-edit-amount"><span className="fsc-edit-dollar">$</span><DollarInput className="fsc-edit-input" value={depositDisplay} onChange={v => handleDepositChange(v)} placeholder="0" /></span>
                      <div className="fsc-del-spacer" />
                    </div>
                  </div>

                  {extraFunds.map(f => (
                    <div key={f.id} className="fsc-row">
                      <input className="fsc-label-input fsc-label-input-bordered" value={f.label} placeholder="e.g. Shares, Gift, Sale proceeds…" onChange={e => updateExtraFund(f.id, 'label', e.target.value)} />
                      <div className="fsc-amt-wrap">
                        <span className="fsc-edit-amount"><span className="fsc-edit-dollar">$</span><DollarInput className="fsc-edit-input" value={f.amount} onChange={v => updateExtraFund(f.id, 'amount', v)} placeholder="0" /></span>
                        <button className="fsc-del-btn" onClick={() => removeExtraFund(f.id)}>✕</button>
                      </div>
                    </div>
                  ))}

                  <button className="fsc-add-item-btn fsc-add-fund-btn" onClick={addExtraFund}>
                    <span className="fsc-add-item-plus">+</span> Fund
                  </button>

                  <div className="fsc-total"><span>Total Available</span><span>{fmt(totalAvailable)}</span></div>
                </div>

                {/* RIGHT — Funds Required */}
                <div className="fsc-col fsc-col-right">
                  <div className="fsc-col-head-row">
                    <div className="fsc-col-head">Funds Required</div>
                  </div>

                  {[
                    ['Purchase Price', pv > 0 ? pv.toLocaleString() : '—'],
                    ['Stamp Duty', Math.round(netStampDuty).toLocaleString()],
                    ['Transfer Fees', Math.round(transferFee).toLocaleString()],
                    ['Mortgage Registration', Math.round(mortgageReg).toLocaleString()],
                    ...( lmiActive && !capLMI ? [['LMI (upfront)', Math.round(lmi).toLocaleString()]] : [] ),
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="fsc-row">
                      <span className="fsc-row-label">{lbl}</span>
                      <div className="fsc-amt-wrap">
                        <span className="fsc-readonly-amount"><span className="fsc-readonly-dollar">$</span><span className="fsc-readonly-value">{val}</span></span>
                        <div className="fsc-del-spacer" />
                      </div>
                    </div>
                  ))}
                  {fhog > 0 && (
                    <div className="fsc-row">
                      <span className="fsc-row-label">FHOG Grant</span>
                      <div className="fsc-amt-wrap">
                        <span className="fsc-readonly-amount fsc-readonly-credit"><span className="fsc-readonly-dollar">$</span><span className="fsc-readonly-value">−{Math.round(fhog).toLocaleString()}</span></span>
                        <div className="fsc-del-spacer" />
                      </div>
                    </div>
                  )}

                  <div className="fsc-debts-divider">
                    <div className="fsc-debts-divider-bar" style={{ background: '#d0ccc6' }} />
                    <span className="fsc-debts-label">Sundry Fees</span>
                  </div>

                  {[
                    ['Lender Setup Fees', lenderSetupFees, setLenderSetupFees],
                    ['Client Legal Fees', clientLegalFees, setClientLegalFees],
                    ['Discharge Fees', mortgageDischargeFees, setMortgageDischargeFees],
                    ['Other / Sundries', otherSundries, setOtherSundries],
                  ].map(([lbl, val, setter]) => (
                    <div key={lbl} className="fsc-row">
                      <span className="fsc-row-label">{lbl}</span>
                      <div className="fsc-amt-wrap">
                        <span className="fsc-edit-amount"><span className="fsc-edit-dollar">$</span><DollarInput className="fsc-edit-input" value={val} onChange={setter} placeholder="—" /></span>
                        <div className="fsc-del-spacer" />
                      </div>
                    </div>
                  ))}

                  <div className="fsc-debts-divider">
                    <div className="fsc-debts-divider-bar" style={{ background: '#fca5a5' }} />
                    <span className="fsc-debts-label">Debts to Close</span>
                  </div>

                  {debts.map(d => (
                    <div key={d.id} className="fsc-row">
                      <input className="fsc-label-input fsc-label-input-bordered" value={d.label} placeholder="e.g. Credit card, Car loan…" onChange={e => updateDebt(d.id, 'label', e.target.value)} />
                      <div className="fsc-amt-wrap">
                        <span className="fsc-edit-amount"><span className="fsc-edit-dollar">$</span><DollarInput className="fsc-edit-input" value={d.amount} onChange={v => updateDebt(d.id, 'amount', v)} placeholder="0" /></span>
                        <button className="fsc-del-btn" onClick={() => removeDebt(d.id)}>✕</button>
                      </div>
                    </div>
                  ))}

                  <button className="fsc-add-item-btn fsc-add-debt-btn" onClick={addDebt}>
                    <span className="fsc-add-item-plus">+</span> Debt
                  </button>

                  <div className="fsc-total"><span>Total Required</span><span>{fmt(totalRequired)}</span></div>
                </div>
              </div>

              {/* Summary Position */}
              {pv > 0 && (
                <div className={`fsc-position ${hasSurplus ? 'fsc-surplus' : 'fsc-deficit'}`}>
                  <div className="fsc-position-left">
                    <div className="fsc-position-icon">{hasSurplus ? '✓' : '!'}</div>
                    <div>
                      <div className="fsc-position-label">{hasSurplus ? 'Surplus' : 'Shortfall'}</div>
                      <div className="fsc-position-sub">
                        {hasSurplus
                          ? "Available funds exceed all purchase costs and debts to close"
                          : `Shortfall of ${fmt(Math.abs(summaryPosition))} — consider increasing loan or additional funds`}
                      </div>
                    </div>
                  </div>
                  <div className="fsc-position-amount">{fmt(Math.abs(summaryPosition))}</div>
                </div>
              )}
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
