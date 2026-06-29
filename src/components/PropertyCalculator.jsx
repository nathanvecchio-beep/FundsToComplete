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

  // When PV first becomes > 0, set deposit display to 20% and lock LVR at 80%
  const pvInitialized = useRef(false);
  useEffect(() => {
    const pv = Number(propertyValue) || 0;
    if (pv > 0 && !pvInitialized.current) {
      pvInitialized.current = true;
      const d = Math.round(pv * 0.2);
      setDepositDisplay(d);
      setBaseLvrManual(80);
      setBaseLvrOverride(true);
    } else if (pv > 0 && pvInitialized.current && baseLvrOverride) {
      // PV changed — recalculate deposit display from existing LVR
      const lvr = Number(baseLvrManual);
      setDepositDisplay(Math.round(pv * (1 - lvr / 100)));
    }
  }, [propertyValue]);


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

  // ── Extra funds (sale proceeds, gifts, etc.) ─────────────────────────────
  const [extraFunds, setExtraFunds] = useState([]);
  const addExtraFund = () => setExtraFunds(f => [...f, { id: Date.now(), label: 'Sale Proceeds', amount: 0 }]);
  const removeExtraFund = (id) => setExtraFunds(f => f.filter(x => x.id !== id));
  const updateExtraFund = (id, field, value) => setExtraFunds(f => f.map(x => x.id === id ? { ...x, [field]: value } : x));
  const extraFundsTotal = extraFunds.reduce((s, f) => s + (Number(f.amount) || 0), 0);

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
    pvInitialized.current = false;
    setPropertyValue(v);
  };

  const handleLoanEdit = (v) => {
    setBaseLoanOverride(true);
    setBaseLoanManual(v);
    setTotalLoanOverride(false);
    setBaseLvrOverride(false);
    setDepositOverride(false);
    if (pv > 0) setDepositDisplay(Math.max(0, pv - v));
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

  // Computed values for new UI
  // depositDisplay is the sidebar input; loan = PV × (1 - depositDisplay/PV) via baseLvr
  const depositPct = pv > 0 ? Math.round(depositDisplay / pv * 100) : 20;
  const loanNeeded = Math.max(0, pv - depositDisplay);
  const upfrontCosts = Math.max(0, fundsRequired - pv);
  // cashToComplete = deposit + upfront costs (contribution when loan = PV × LVR)
  const cashToComplete = depositDisplay + upfrontCosts;

  // Funding summary position
  const totalAvailable = cashToComplete + extraFundsTotal;
  const summaryPosition = totalAvailable - cashToComplete; // surplus (positive) or deficit (negative)
  const hasSurplus = summaryPosition >= 0;

  // Proportion bar
  const totalBar = depositDisplay + upfrontCosts;
  const depositBarPct = totalBar > 0 ? (depositDisplay / totalBar * 100) : 70;
  const costsBarPct = totalBar > 0 ? (upfrontCosts / totalBar * 100) : 30;

  const handleDepositChange = (v) => {
    setDepositDisplay(v);
    if (pv > 0) {
      const lvr = Math.max(0, Math.min(100, ((pv - v) / pv) * 100));
      setBaseLvrManual(Math.round(lvr * 100) / 100);
      setBaseLvrOverride(true);
    }
    setBaseLoanOverride(false);
    setDepositOverride(false);
    setTotalLoanOverride(false);
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

          {/* Cash to Complete */}
          <div className="sb-section">
            <div className="sb-deposit-header">
              <label className="sb-field-label">CASH TO COMPLETE</label>
              {pv > 0 && (
                <span className="sb-deposit-pct-badge">
                  {(depositDisplay / pv * 100).toFixed(1)}% deposit · LVR {(100 - depositDisplay / pv * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <div className="sb-dollar-wrap">
              <span className="sb-dollar-sign">$</span>
              <DollarInput
                className="sb-pv-input"
                value={pv > 0 ? cashToComplete : 0}
                onChange={v => handleDepositChange(Math.max(0, v - upfrontCosts))}
                placeholder="120,000"
              />
            </div>
            <input
              type="range"
              className="sb-deposit-slider"
              min={0}
              max={pv || 1000000}
              step={1000}
              value={depositDisplay}
              onChange={e => handleDepositChange(Number(e.target.value))}
            />
            <div className="sb-loan-needed">
              Loan needed: <strong>{pv > 0 ? fmt(loanNeeded) : '—'}</strong>
            </div>
          </div>

          {/* Funds Available */}
          <div className="sb-section">
            <label className="sb-field-label">FUNDS AVAILABLE</label>
            <div className="sb-fund-row">
              <span className="sb-fund-tag">Savings / Deposit</span>
              <span className="sb-fund-val">{pv > 0 ? fmt(cashToComplete) : '—'}</span>
            </div>
            {extraFunds.map(f => (
              <div key={f.id} className="sb-fund-row">
                <span className="sb-fund-tag sb-fund-tag-extra">{f.label || 'Other Fund'}</span>
                <span className="sb-fund-val">{fmt(f.amount)}</span>
              </div>
            ))}
            {extraFunds.length === 0 && (
              <div className="sb-fund-row sb-fund-row-dim">
                <span className="sb-fund-tag">Sale Proceeds</span>
                <span className="sb-fund-val">—</span>
              </div>
            )}
            <div className="sb-fund-total-row">
              <span className="sb-fund-total-label">Total Available</span>
              <span className="sb-fund-total-val">{pv > 0 ? fmt(totalAvailable) : '—'}</span>
            </div>
            {pv > 0 && extraFundsTotal > 0 && (
              <div className={`sb-position-pill ${hasSurplus ? 'sb-position-surplus' : 'sb-position-deficit'}`}>
                <div>
                  <div>{hasSurplus ? '✓ Surplus' : '⚠ Shortfall'}</div>
                  <div className="sb-position-sub">{hasSurplus ? 'Funds cover all costs' : 'Additional funds needed'}</div>
                </div>
                <span className="sb-position-amount">{fmt(Math.abs(summaryPosition))}</span>
              </div>
            )}
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
            <div className="hero-main">
              <div className="hero-gold-label">CASH YOU NEED TO COMPLETE</div>
              <div className="hero-big-number">
                {pv > 0 ? fmt(cashToComplete) : '$—'}
              </div>
              <div className="hero-subtitle">
                {pv > 0
                  ? `Your ${depositPct}% deposit plus all upfront costs to settle a ${fmt(pv)} home in ${state}.`
                  : 'Enter a property value to see your funds to complete.'
                }
              </div>
            </div>
            <div className="hero-stat-cards">
              {/* #2 Editable loan card; #4 disambiguated label when LMI capitalised */}
              <EditableStatCard
                label={lmiActive && capLMI ? 'TOTAL LOAN (INCL. LMI)' : 'HOME LOAN'}
                displayValue={fmt(totalLoan)}
                editValue={rawBaseLoan}
                editable={pv > 0}
                onEdit={handleLoanEdit}
                inputPrefix="$"
                sub={lmiActive && capLMI ? `Base ${fmt(rawBaseLoan)} + LMI ${fmt(lmi)}` : null}
              />
              {/* #2 Editable LVR card */}
              <EditableStatCard
                label="LVR"
                displayValue={fmtPct(totalLvr, 1)}
                editValue={Number(baseLvr.toFixed(1))}
                editable={pv > 0}
                onEdit={handleLvrEdit}
                inputSuffix="%"
                valueClass={lmiActive ? 'hsc-lmi' : ''}
                sub={lmiActive ? '⚠ LMI applies' : (pv > 0 ? '✓ No LMI' : null)}
              />
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
                  <span>Deposit {fmt(depositDisplay)} &middot; {depositBarPct.toFixed(0)}%</span>
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

          {/* FUNDING SUMMARY TABLE */}
          {pv > 0 && (
            <div className="funding-summary-card">
              <div className="fsc-header-row">
                <div className="fsc-title">FUNDING SUMMARY</div>
                <button className="fsc-add-btn" onClick={addExtraFund}>+ Add Fund</button>
              </div>
              <div className="fsc-table">
                <div className="fsc-col">
                  <div className="fsc-col-head">Funds Available</div>
                  <div className="fsc-row"><span>Savings / Deposit</span><span>{fmt(cashToComplete)}</span></div>
                  {extraFunds.map(f => (
                    <div key={f.id} className="fsc-row fsc-row-extra">
                      <span>{f.label || 'Other'}</span>
                      <span className="fsc-extra-right">
                        {fmt(f.amount)}
                        <button className="fsc-del-btn" onClick={() => removeExtraFund(f.id)}>✕</button>
                      </span>
                    </div>
                  ))}
                  <div className="fsc-row fsc-row-empty"><span>Sale Proceeds</span><span>—</span></div>
                  <div className="fsc-row fsc-row-empty"><span>Gift / Other</span><span>—</span></div>
                  <div className="fsc-total"><span>Total Available</span><span>{fmt(totalAvailable)}</span></div>
                </div>
                <div className="fsc-col fsc-col-right">
                  <div className="fsc-col-head">Funds Required</div>
                  <div className="fsc-row"><span>Deposit ({(depositDisplay / pv * 100).toFixed(0)}%)</span><span>{fmt(depositDisplay)}</span></div>
                  <div className="fsc-row"><span>Stamp Duty</span><span>{fmt(netStampDuty)}</span></div>
                  <div className="fsc-row"><span>Transfer &amp; Reg Fees</span><span>{fmt(transferFee + mortgageReg)}</span></div>
                  <div className="fsc-row"><span>Legal &amp; Bank Fees</span><span>{fmt(fees)}</span></div>
                  {lmiActive && !capLMI && <div className="fsc-row fsc-row-lmi"><span>LMI (upfront)</span><span>{fmt(lmi)}</span></div>}
                  {fhog > 0 && <div className="fsc-row fsc-row-credit"><span>FHOG Grant</span><span>−{fmt(fhog)}</span></div>}
                  <div className="fsc-total"><span>Total Required</span><span>{fmt(cashToComplete)}</span></div>
                </div>
              </div>
              <div className={`fsc-position ${hasSurplus ? 'fsc-surplus' : 'fsc-deficit'}`}>
                <div>
                  <div className="fsc-position-label">{hasSurplus ? '✓ Summary Position — Surplus' : '⚠ Summary Position — Shortfall'}</div>
                  <div className="fsc-position-sub">
                    {hasSurplus
                      ? extraFundsTotal > 0 ? "Client's funds fully cover all costs to complete" : 'Savings cover all upfront costs and deposit'
                      : `Client is short by ${fmt(Math.abs(summaryPosition))} — consider additional funds or a higher LVR`}
                  </div>
                </div>
                <div className="fsc-position-amount">{extraFundsTotal > 0 ? fmt(Math.abs(summaryPosition)) : '—'}</div>
              </div>
            </div>
          )}

          {/* BOTTOM EQUATION BAR */}
          <div className="equation-bar">
            <div className="eq-item">
              <span className="eq-label">DEPOSIT</span>
              <span className="eq-value">{fmt(depositDisplay)}</span>
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
