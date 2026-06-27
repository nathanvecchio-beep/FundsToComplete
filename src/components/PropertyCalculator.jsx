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
function DollarInput({ value, onChange, className }) {
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

// Hero cell (editable)
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
  const [lmiOpen, setLmiOpen] = useState(false);
  const [costsOpen, setCostsOpen] = useState(false);
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
    setPropertyValue(v);
  };

  const handleTotalLoanEdit = (v) => {
    setBaseLoanOverride(true);
    setBaseLoanManual(v);
    setTotalLoanOverride(false);
    setDepositOverride(false);
    setDepositManual(0);
    setBaseLvrOverride(false);
  };

  return (
    <>
      <div className="calc-layout">

        {/* LEFT SIDEBAR */}
        <div className="sidebar">
          <div className="sb-section">
            <div className="sb-section-label">Property</div>
            <SelectField label="State" value={state} onChange={setState}
              options={STATES.map(s => ({ value: s, label: s }))} />
            <SelectField label="Property Type" value={propertyType} onChange={setPropertyType}
              options={PROPERTY_TYPES} />
            <SelectField label="Purpose" value={purpose} onChange={setPurpose}
              options={PURPOSES} />
          </div>

          <div className="sb-section">
            <div className="sb-section-label">Buyer Profile</div>
            <SbToggle label="First Home Buyer" checked={firstHome} onChange={setFirstHome} />
            <SbToggle label="Foreign Buyer" checked={foreignBuyer} onChange={setForeignBuyer} />
          </div>

          <div className="sb-section">
            <div className="sb-section-label sb-collapsible" onClick={() => setLmiOpen(v => !v)}>
              LMI Waivers <span className={`sb-chevron ${lmiOpen ? 'open' : ''}`}>▾</span>
            </div>
            {lmiOpen && (
              <>
                <SbToggle
                  label="First Home Guarantee"
                  sub="5% deposit, no LMI"
                  checked={fhgScheme}
                  onChange={setFhgScheme}
                  disabled={!firstHome}
                  info="Government scheme — FHBs can buy with 5% deposit and no LMI. Income and price caps apply."
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
              </>
            )}
          </div>

          <div className="sb-section">
            <div className="sb-section-label sb-collapsible" onClick={() => setCostsOpen(v => !v)}>
              Costs &amp; Fees <span className={`sb-chevron ${costsOpen ? 'open' : ''}`}>▾</span>
            </div>
            {costsOpen && (
              <>
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
                  info="Buyers typically reimburse seller for prepaid council/water rates. Usually $500–$1,500."
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
              </>
            )}
          </div>
        </div>

        {/* RIGHT CONTENT */}
        <div className="calc-right">

          {/* HERO BAR */}
          <div className="hero-bar">
            <HeroCell
              label="Property Value"
              value={pv}
              editable
              onEdit={handlePvEdit}
              sub={pv > 0 ? `Base LVR ${fmtPct(baseLvrCalc, 1)}` : 'Click to enter'}
            />
            <div className="hero-div" />
            <HeroCell
              label="Total Loan"
              value={totalLoan}
              editable
              onEdit={handleTotalLoanEdit}
              sub={lmiActive ? `incl. LMI ${fmt(lmi)}` : rawBaseLoan > 0 ? 'No LMI' : '—'}
            />
            <div className="hero-div" />
            <div className="hero-item">
              <div className="hero-label">LVR</div>
              <div className={`hero-value ${lmiActive ? 'hero-val-lmi' : ''}`}>{fmtPct(totalLvr, 1)}</div>
              <div className={`hero-sub ${lmiActive ? 'hero-sub-lmi' : ''}`}>
                {lmiActive ? '⚠ LMI applies' : totalLvr > 0 ? '✓ No LMI' : '—'}
              </div>
            </div>
            <div className="hero-cash">
              <div className="hero-label">Cash Required</div>
              <div className="hero-cash-value">{fundsRequired > 0 ? fmt(contribution) : 'N/A'}</div>
              <div className="hero-sub hero-sub-cash">
                {fundsRequired > 0 ? `Total funds: ${fmt(fundsRequired)}` : 'Enter property value'}
              </div>
            </div>
          </div>

          {/* CARDS GRID */}
          <div className="cards-grid">

            {/* LOAN STRUCTURE CARD */}
            <div className="panel-card">
              <div className="panel-card-header">
                <span className="panel-card-title">Loan Structure</span>
                <span className="panel-card-hint">Toggle to override</span>
              </div>
              <div className="panel-card-body">

                <LoanRow
                  label="Deposit Required"
                  displayValue={fmt(depositOverride ? depositManual : contribution)}
                  overrideActive={depositOverride}
                  overrideInput={depositOverride ? (
                    <DollarInput className="loan-override-input" value={depositManual}
                      onChange={v => {
                        setDepositManual(v);
                        setDepositOverride(true);
                        setBaseLoanOverride(false); setBaseLvrOverride(false); setTotalLoanOverride(false);
                      }} />
                  ) : null}
                  onToggle={v => {
                    setDepositOverride(v);
                    if (!v) setDepositManual(0);
                    if (v) { setBaseLoanOverride(false); setBaseLvrOverride(false); }
                  }}
                />

                <LoanRow
                  label="Base LVR"
                  displayValue={fmtPct(baseLvrCalc, 2)}
                  overrideActive={baseLvrOverride}
                  overrideInput={baseLvrOverride ? (
                    <input className="loan-override-input" type="number" step="0.1" value={baseLvrManual}
                      onChange={e => setBaseLvrManual(Number(e.target.value))} />
                  ) : null}
                  onToggle={v => {
                    setBaseLvrOverride(v);
                    if (!v) setBaseLoanOverride(false);
                    if (v) { setDepositOverride(false); setDepositManual(0); setBaseLoanOverride(false); }
                  }}
                />

                <LoanRow
                  label="Base Loan Amount"
                  displayValue={fmt(rawBaseLoan)}
                  overrideActive={baseLoanOverride}
                  overrideInput={baseLoanOverride ? (
                    <DollarInput className="loan-override-input" value={baseLoanManual}
                      onChange={v => {
                        setBaseLoanManual(v); setBaseLoanOverride(true);
                        setDepositOverride(false); setDepositManual(0);
                      }} />
                  ) : null}
                  onToggle={v => {
                    setBaseLoanOverride(v);
                    if (!v) setTotalLoanOverride(false);
                    if (v) { setDepositOverride(false); setDepositManual(0); setBaseLvrOverride(false); }
                  }}
                />

                {lmiWaived && <div className="lmi-waived-strip">✓ LMI Waived — no LMI applies</div>}
                {lmiActive && (
                  <div className="lmi-strip">
                    <div className="lmi-strip-body">
                      <span className="lmi-strip-icon">⚠</span>
                      <div>
                        <div className="lmi-strip-title">LMI — {fmt(lmi)}</div>
                        <div className="lmi-strip-sub">
                          LVR {fmtPct(totalLvr, 1)} &gt; 80% · Rate {(lmiResult.rate * 100).toFixed(3)}% · {capLMI ? 'Capitalised into loan' : 'Paid upfront'}
                        </div>
                      </div>
                    </div>
                    <div className="lmi-strip-action">
                      <span>Capitalise</span>
                      <Toggle checked={capLMI} onChange={setCapLMI} />
                    </div>
                  </div>
                )}

                {lmiActive && (
                  <div className="loan-row loan-row-sub">
                    <span className="loan-row-label">Total LVR (incl. LMI)</span>
                    <span className="loan-row-value" style={{ color: 'var(--lmi-text)' }}>{fmtPct(totalLvr, 2)}</span>
                  </div>
                )}

                <div className="loan-row loan-row-total">
                  <span>Total Loan Amount</span>
                  <span>{fmt(totalLoan)}</span>
                </div>

              </div>

              {/* Repayment footer */}
              <div className="repay-footer">
                <div className="repay-field">
                  <label>Rate %</label>
                  <input type="number" value={rate} onChange={e => setRate(Number(e.target.value))} step="0.05" min="0" />
                </div>
                <div className="repay-sep">·</div>
                <div className="repay-field">
                  <label>Term</label>
                  <input type="number" value={term} onChange={e => setTerm(Number(e.target.value))} min="1" max="30" />
                </div>
                <div className="repay-sep">·</div>
                <div className="repay-field">
                  <label>IO yrs</label>
                  <input type="number" value={ioTerm} onChange={e => setIoTerm(Number(e.target.value))} min="0" max="10" />
                </div>
                <div className="repay-result">
                  <span className="repay-label">Monthly P&amp;I</span>
                  <span className="repay-value">{fmt(repayment)}<span className="repay-mo">/mo</span></span>
                </div>
              </div>
            </div>

            {/* COST BREAKDOWN CARD */}
            <div className="panel-card">
              <div className="panel-card-header">
                <span className="panel-card-title">Cost Breakdown</span>
                <button className="panel-card-action-btn" onClick={() => setShowBreakdown(v => !v)}>
                  {showBreakdown ? '← Simple' : 'Advanced →'}
                </button>
              </div>

              {!showBreakdown ? (
                <div className="panel-card-body cost-body">
                  <CostRow label="Purchase Price" value={fmt(pv)} />

                  <div className="cost-row cost-row-stamp">
                    <span className="cost-label">
                      Stamp Duty
                      {firstHome && govtChargesOn && <span className="cost-badge cost-badge-fhb">FHB rate</span>}
                      {!govtChargesOn && <span className="cost-badge cost-badge-off">excluded</span>}
                      {stampDutyOverride && govtChargesOn && <span className="cost-badge cost-badge-override">OVERRIDE</span>}
                    </span>
                    <div className="cost-row-right">
                      {govtChargesOn ? (
                        stampDutyOverride ? (
                          <>
                            <input className="cost-inline-input" type="number" value={stampDutyManual}
                              onChange={e => setStampDutyManual(Number(e.target.value))} />
                            <button className="cost-reset-btn" onClick={() => { setStampDutyOverride(false); setStampDutyManual(0); }}>↩ auto</button>
                          </>
                        ) : (
                          <>
                            <span className="cost-value">{fmt(netStampDuty)}</span>
                            <button className="cost-adjust-btn" onClick={() => { setStampDutyOverride(true); setStampDutyManual(netStampDuty); }}>adjust</button>
                          </>
                        )
                      ) : <span className="cost-value cost-excluded">—</span>}
                    </div>
                  </div>

                  {stampDutyConc > 0 && govtChargesOn && (
                    <CostRow label="Stamp Duty Concession" value={`−${fmt(stampDutyConc)}`} valueClass="cost-val-success" />
                  )}
                  <CostRow label="Transfer &amp; Registration" value={govtChargesOn ? fmt(transferFee + mortgageReg) : '—'} />
                  <CostRow label="Legal &amp; Bank Fees" value={fmt(fees)} />
                  {ratesAdj > 0 && <CostRow label="Rates Adjustment" value={fmt(ratesAdj)} />}
                  {!capLMI && lmi > 0 && <CostRow label="LMI (upfront payment)" value={fmt(lmi)} valueClass="cost-val-lmi" />}
                  {fhog > 0 && <CostRow label={`FHOG Grant (${stateCode})`} value={`−${fmt(fhog)}`} valueClass="cost-val-success" />}

                  <div className="cost-subtotal">
                    <span>Total Funds Required</span>
                    <span>{fmt(fundsRequired)}</span>
                  </div>

                  <div className="cost-loan-line">
                    <span>Less: Total Loan</span>
                    <span>−{fmt(totalLoan)}</span>
                  </div>

                  <div className="cost-total">
                    <span>Cash Required</span>
                    <span>{fmt(contribution)}</span>
                  </div>
                </div>
              ) : (
                <div className="panel-card-body adv-body">
                  <div className="adv-section">
                    <div className="adv-section-title">
                      Government Charges
                      <div className="adv-section-toggle">
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: 4 }}>Include</span>
                        <Toggle checked={govtChargesOn} onChange={setGovtChargesOn} />
                      </div>
                    </div>
                    <div className="adv-row">
                      <span>Stamp Duty {firstHome ? '(FHB rate)' : ''}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {stampDutyOverride
                          ? <><input className="adv-input" type="number" value={stampDutyManual} onChange={e => { setStampDutyOverride(true); setStampDutyManual(Number(e.target.value)); }} /><button className="cost-reset-btn" onClick={() => { setStampDutyOverride(false); setStampDutyManual(0); }}>↩ auto</button></>
                          : <><span>{fmt(stampDuty)}</span><button className="cost-adjust-btn" onClick={() => { setStampDutyOverride(true); setStampDutyManual(stampDuty); }}>adjust</button></>}
                      </div>
                    </div>
                    <div className="adv-row">
                      <span>Stamp Duty Concession</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {stampDutyConcOverride
                          ? <input className="adv-input" type="number" value={stampDutyConcManual} onChange={e => { setStampDutyConcOverride(true); setStampDutyConcManual(Number(e.target.value)); }} />
                          : <><span>{fmt(stampDutyConc)}</span><button className="cost-adjust-btn" onClick={() => { setStampDutyConcOverride(true); setStampDutyConcManual(0); }}>+</button></>}
                      </div>
                    </div>
                    <div className="adv-row"><span>Net Stamp Duty</span><span style={{ fontWeight: 700 }}>{fmt(netStampDuty)}</span></div>
                    <div className="adv-row"><span>Title Transfer Fee</span><span>${transferFee.toFixed(2)}</span></div>
                    <div className="adv-row"><span>Mortgage Registration</span><span>${mortgageReg.toFixed(2)}</span></div>
                    <div className="adv-row adv-subtotal"><span>Total Govt Charges</span><span>{fmt(totalGovt)}</span></div>
                  </div>

                  <div className="adv-section">
                    <div className="adv-section-title">Fees &amp; Other Costs</div>
                    {!useDetailedFees
                      ? <div className="adv-row"><span>Legal &amp; Bank Fees (estimate)</span><span>{fmt(fees)}</span></div>
                      : <>
                          {[['Conveyancer', conveyancerFee, setConveyancerFee],
                            ['Bank Fees', bankFee, setBankFee],
                            ['Building Inspection', buildingInspection, setBuildingInspection],
                            ['Pest Inspection', pestInspection, setPestInspection],
                            ['Other', otherFees, setOtherFees]].map(([lbl, val, setter]) => (
                            <div key={lbl} className="adv-row">
                              <span>{lbl}</span>
                              <input className="adv-input" type="number" value={val} onChange={e => setter(Number(e.target.value))} />
                            </div>
                          ))}
                          <div className="adv-row adv-subtotal"><span>Total Fees</span><span>{fmt(fees)}</span></div>
                        </>
                    }
                    {ratesAdj > 0 && <div className="adv-row"><span>Rates Adjustment</span><span>{fmt(ratesAdj)}</span></div>}
                    {fhog > 0 && <div className="adv-row" style={{ color: 'var(--success)' }}><span>FHOG Grant</span><span>−{fmt(fhog)}</span></div>}
                  </div>

                  <div className="adv-section">
                    <div className="adv-section-title">
                      Lender's Mortgage Insurance
                      {lmiWaived && <span style={{ fontSize: '0.7rem', color: 'var(--success)', marginLeft: 6 }}>✓ Waived</span>}
                    </div>
                    {!lmiWaived && lmi === 0 && pv > 0 && <div className="adv-row" style={{ color: 'var(--success)' }}><span>✓ No LMI — LVR ≤ 80%</span></div>}
                    {lmiActive && <>
                      <div className="adv-row"><span>Base Loan</span><span>{fmt(rawBaseLoan)}</span></div>
                      <div className="adv-row"><span>LVR</span><span>{fmtPct(totalLvr, 2)}</span></div>
                      <div className="adv-row"><span>Premium Rate ({(lmiResult.rate * 100).toFixed(3)}%)</span><span>{fmt(lmiResult.basePremium)}</span></div>
                      {lmiResult.dutyOnPremium > 0 && <div className="adv-row"><span>Stamp Duty on Premium</span><span>{fmt(lmiResult.dutyOnPremium)}</span></div>}
                      <div className="adv-row adv-subtotal"><span>Total LMI</span><span>{fmt(lmi)}</span></div>
                    </>}
                    <div className="adv-disclaimer">
                      Estimate only. LMI premiums vary by lender. Confirm exact premium with your lender before settlement.
                      {lmiResult.warnings?.length > 0 && <div style={{ color: 'var(--lmi-text)', marginTop: 4 }}>{lmiResult.warnings.join(' ')}</div>}
                    </div>
                  </div>
                </div>
              )}
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
          <span className="pp-property-badge">{stateCode} · {propertyType}</span>
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
                <span className="pp-row-value">−{fmt(fhog)}</span>
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
            <div className="pp-repayment-detail">{fmtPct(rate, 2)} p.a. · {term} yr loan{ioTerm > 0 ? ` · ${ioTerm} yr IO` : ' · P&I'}</div>
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
            📞 1300 088 065 &nbsp;·&nbsp; ✉ hello@huntergalloway.com.au<br />
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
