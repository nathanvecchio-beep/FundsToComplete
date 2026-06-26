import { useState, useMemo, useRef, useEffect } from 'react';
import Toggle from './Toggle';
import { CurrencyField, PercentField, SelectField } from './Field';
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
const TRANS_TYPES = ['Purchase','Refinance','Construction'];
const DEFAULT_FEES = 3000;
const DEFAULT_RATE = 5.75;
const DEFAULT_TERM = 30;

function fmt(n) {
  if (n == null || n === '') return '$0';
  return '$' + Math.round(Number(n)).toLocaleString();
}
function fmtPct(n, dec = 2) {
  if (!n) return '0.00%';
  return Number(n).toFixed(dec) + '%';
}

// Inline editable cell in the summary bar
function EditableCell({ label, value, onChange, readOnly, subtext }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const inputRef = useRef();

  const start = () => {
    if (readOnly) return;
    setRaw(value > 0 ? String(value) : '');
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };
  const commit = () => {
    const n = Number(raw.replace(/[^0-9.]/g, ''));
    onChange(isNaN(n) ? 0 : n);
    setEditing(false);
  };

  return (
    <div className="sb-editable-item">
      <div className="sb-label">{label}{!readOnly && <span className="sb-edit-hint"> ✎</span>}</div>
      {editing ? (
        <input
          ref={inputRef}
          className="sb-edit-input"
          type="number"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        />
      ) : (
        <div className={`sb-value ${!readOnly ? 'sb-value-editable' : ''}`} onClick={start}>
          {fmt(value)}
        </div>
      )}
      {subtext && <div className="sb-subtext">{subtext}</div>}
    </div>
  );
}

export default function PropertyCalculator({ propIndex, label, onSummaryUpdate }) {
  // ── Left panel ───────────────────────────────────────────────────────────
  const [state, setState] = useState('New South Wales');
  const [propertyType, setPropertyType] = useState('Established Home');
  const [purpose, setPurpose] = useState('Owner Occupied');
  const [transType, setTransType] = useState('Purchase');
  const [firstHome, setFirstHome] = useState(false);
  const [diffValuation, setDiffValuation] = useState(false);
  const [selfEmployed, setSelfEmployed] = useState(false);
  const [foreignBuyer, setForeignBuyer] = useState(false);

  // ── LMI waivers ─────────────────────────────────────────────────────────
  const [lmiOpen, setLmiOpen] = useState(true);
  const [fhgScheme, setFhgScheme] = useState(false);
  const [profLmi, setProfLmi] = useState(false);
  const [famGuarantor, setFamGuarantor] = useState(false);

  // ── Core inputs ──────────────────────────────────────────────────────────
  // Property value — single source of truth
  const [propertyValue, setPropertyValue] = useState(0);

  // Base LVR — user can override, default 80%
  const [baseLvrOverride, setBaseLvrOverride] = useState(false);
  const [baseLvrManual, setBaseLvrManual] = useState(80);

  // Base loan — user can override; default = pv × baseLvr
  const [baseLoanOverride, setBaseLoanOverride] = useState(false);
  const [baseLoanManual, setBaseLoanManual] = useState(0);

  // Total loan — user can override; default = baseLoan + capitalisedLMI
  // NOTE: overriding total loan also sets baseLoanManual so LMI re-derives correctly
  const [totalLoanOverride, setTotalLoanOverride] = useState(false);
  const [totalLoanManual, setTotalLoanManual] = useState(0);

  // Deposit override — user enters deposit amount; base loan = pv - deposit
  const [depositOverride, setDepositOverride] = useState(false);
  const [depositManual, setDepositManual] = useState(0);

  // Funds required override
  const [fundsOverride, setFundsOverride] = useState(false);
  const [fundsManual, setFundsManual] = useState(0);

  // ── Repayment ────────────────────────────────────────────────────────────
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [term, setTerm] = useState(DEFAULT_TERM);
  const [ioTerm, setIoTerm] = useState(0);

  // ── LMI options ──────────────────────────────────────────────────────────
  const [capLMI, setCapLMI] = useState(true);
  const [lmiLender, setLmiLender] = useState('ING');
  const [overrideLMI, setOverrideLMI] = useState(false);
  const [lmiManualAmt, setLmiManualAmt] = useState(0);

  // ── Breakdown ────────────────────────────────────────────────────────────
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [govtChargesOn, setGovtChargesOn] = useState(true);
  const [stampDutyOverride, setStampDutyOverride] = useState(false);
  const [stampDutyManual, setStampDutyManual] = useState(0);
  const [stampDutyConcOverride, setStampDutyConcOverride] = useState(false);
  const [stampDutyConcManual, setStampDutyConcManual] = useState(0);

  // ── Detailed fees (Step 4) ───────────────────────────────────────────────
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

  // ── FHOG auto-amounts (2025-26, new/OTP homes only for most states) ──────
  const FHOG_AMOUNTS = { NSW: 10000, VIC: 10000, QLD: 30000, SA: 15000, WA: 10000, TAS: 30000, ACT: 0, NT: 10000 };
  const isNewBuild = propertyType === 'New Home' || propertyType === 'Off the Plan' || propertyType === 'Vacant Land';
  const autoFhog = (firstHome && isNewBuild) ? (FHOG_AMOUNTS[stateCode] || 0) : 0;

  // ── All computation in one memo ──────────────────────────────────────────
  const C = useMemo(() => {
    const pv = Number(propertyValue) || 0;

    // Base LVR
    const baseLvr = baseLvrOverride ? Number(baseLvrManual) : 80;

    // Fees (needed early for deposit → loan conversion)
    const fees = useDetailedFees
      ? (Number(conveyancerFee) + Number(bankFee) + Number(buildingInspection) + Number(pestInspection) + Number(otherFees))
      : DEFAULT_FEES;
    const ratesAdj = includeRates ? Number(ratesAmount) : 0;
    const fhog = includeFhog ? (fhogOverride ? Number(fhogManual) : autoFhog) : 0;

    // Stamp duty and transfer fee don't depend on loan amount — compute first
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

    // Base loan (before LMI)
    // depositOverride has a circular dependency: both mortgageReg and LMI depend on rawBaseLoan.
    // We solve by iterating until the computed contribution matches the entered deposit.
    //   capLMI=true:  contribution = pv + totalGovt + fees - rawBaseLoan - lmi  → rawBaseLoan = pv + totalGovt + fees - D - lmi
    //   capLMI=false: contribution = pv + totalGovt + fees + lmi - rawBaseLoan  → rawBaseLoan = pv + totalGovt + fees + lmi - D
    let rawBaseLoan;
    if (depositOverride) {
      const D = Number(depositManual);
      // Initial estimate ignoring mortgageReg and LMI
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

    // LMI — derived from rawBaseLoan vs propertyValue
    const lmiResult = calculateLMI(rawBaseLoan, pv, lmiWaived, stateCode);
    const lmiAuto = lmiResult.lmi;
    const lmi = overrideLMI ? Number(lmiManualAmt) : lmiAuto;
    const capitalisedLmi = capLMI ? lmi : 0;

    // Total loan — baseLoan + capitalised LMI (unless user has directly overridden both)
    const totalLoan = (totalLoanOverride && baseLoanOverride)
      ? Number(totalLoanManual)
      : rawBaseLoan + capitalisedLmi;

    // LVRs
    const baseLvrCalc = pv > 0 ? (rawBaseLoan / pv * 100) : 0;
    const totalLvr    = pv > 0 ? (totalLoan / pv * 100) : 0;

    // Total funds required = everything the customer must pay, minus any FHOG grant
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
  const surplus = totalLoan - fundsRequired;

  // Push key values up so the Summary tab can display them
  useEffect(() => {
    onSummaryUpdate?.({
      label: label || `Property ${propIndex + 1}`,
      pv, totalLoan, rawBaseLoan, totalLvr, lmi, lmiActive, capLMI,
      netStampDuty, transferFee, mortgageReg, totalGovt,
      fees, fundsRequired, contribution, repayment,
      stateCode, purpose, propertyType,
      rate, term, ioTerm,
    });
  }, [pv, totalLoan, rawBaseLoan, totalLvr, lmi, lmiActive, capLMI,
      netStampDuty, transferFee, mortgageReg, totalGovt,
      fees, fundsRequired, contribution, repayment,
      stateCode, purpose, propertyType, label, propIndex, rate, term, ioTerm]);

  // ── Summary bar handlers ─────────────────────────────────────────────────
  // Editing "Property Value" → clears all overrides so everything auto-recalculates
  const handlePvEdit = (v) => {
    setPropertyValue(v);
    // Don't clear loan overrides — user may have deliberately set them
  };

  // Editing "Total Loan" in summary bar → sets base loan override (so LMI, LVRs all flow)
  const handleTotalLoanEdit = (v) => {
    setBaseLoanOverride(true);
    setBaseLoanManual(v);
    setTotalLoanOverride(false); // let total loan auto-compute (base + LMI)
  };

  return (
    <div>
      {/* ── Editable Summary Bar ── */}
      <div className="summary-bar-editable">
        <EditableCell
          label="Property Value"
          value={pv}
          onChange={handlePvEdit}
          subtext={pv > 0 ? `Base LVR ${fmtPct(baseLvrCalc, 1)}` : null}
        />
        <div className="sb-divider" />
        <EditableCell
          label="Total Loan"
          value={totalLoan}
          onChange={handleTotalLoanEdit}
          subtext={lmiActive ? `incl. LMI ${fmt(lmi)}` : null}
        />
        <div className="sb-divider" />
        <div className="sb-editable-item">
          <div className="sb-label">Total LVR</div>
          <div className={`sb-value ${lmiActive ? 'sb-value-warning' : ''}`}>
            {fmtPct(totalLvr, 1)}
          </div>
          <div className="sb-subtext">{lmiActive ? '⚠ LMI applies' : totalLvr > 0 ? '✓ No LMI' : ''}</div>
        </div>
        <div className="sb-divider" />
        <div className="sb-editable-item">
          <div className="sb-label">Cash Required</div>
          <div className={`sb-value ${contribution > 0 ? 'sb-value-highlight' : ''}`}>
            {fundsRequired > 0 ? fmt(contribution) : 'N/A'}
          </div>
          <div className="sb-subtext">
            {fundsRequired > 0 ? `Total funds to complete: ${fmt(fundsRequired)}` : ''}
          </div>
        </div>
      </div>

      {/* ── LMI Alert Banner ── */}
      {lmiActive && (
        <div className="lmi-banner">
          <div className="lmi-banner-icon">⚠</div>
          <div className="lmi-banner-body">
            <strong>LMI applies — estimated {fmt(lmi)}</strong>
            <span className="lmi-banner-sub">
              LVR {fmtPct(totalLvr, 1)} &gt; 80% · Base premium {fmt(lmiResult.basePremium)}
              {lmiResult.dutyOnPremium > 0 && ` + ${stateCode} stamp duty on premium ${fmt(lmiResult.dutyOnPremium)}`}
              {' · '}{capLMI ? `Capitalised: base ${fmt(rawBaseLoan)} + LMI ${fmt(lmi)} = total loan ${fmt(totalLoan)}` : 'Paid upfront — not added to loan'}
            </span>
            {lmiResult.warnings?.length > 0 && (
              <span className="lmi-banner-warn">{lmiResult.warnings.join(' ')}</span>
            )}
          </div>
          <div className="lmi-banner-toggle">
            <span style={{ fontSize: '0.75rem', marginRight: 6 }}>Capitalise</span>
            <Toggle checked={capLMI} onChange={setCapLMI} />
          </div>
        </div>
      )}

      {/* ── Main calculator card ── */}
      <div className="property-card">
        <div className="calc-grid">
          {/* LEFT — scenario setup (broker controls) */}
          <div>
            <div className="broker-section-label">Property Details</div>
            <SelectField label="State" value={state} onChange={setState}
              options={STATES.map(s => ({ value: s, label: s }))} />
            <SelectField label="Property Type" value={propertyType} onChange={setPropertyType}
              options={PROPERTY_TYPES} />
            <SelectField label="Purchase Purpose" value={purpose} onChange={setPurpose}
              options={PURPOSES} />
            <SelectField label="Transaction Type" value={transType} onChange={setTransType}
              options={TRANS_TYPES} />

            <div className="broker-section-label" style={{ marginTop: 16 }}>Buyer Profile</div>
            <div className="bool-list">
              <div className="bool-item">First Home Buyer <Toggle checked={firstHome} onChange={setFirstHome} /></div>
              <div className="bool-item">Foreign Buyer <Toggle checked={foreignBuyer} onChange={setForeignBuyer} /></div>
              <div className="bool-item">Self Employed <Toggle checked={selfEmployed} onChange={setSelfEmployed} /></div>
              <div className="bool-item">Different Contract/Valuation <Toggle checked={diffValuation} onChange={setDiffValuation} /></div>
            </div>

            <div className="collapsible-header" onClick={() => setLmiOpen(v => !v)}>
              <span className={`chevron ${lmiOpen ? 'open' : ''}`}>▲</span>
              LMI Waiver — does one apply?
            </div>
            {lmiOpen && (
              <div className="bool-list" style={{ marginTop: 10 }}>
                <div className="bool-item" style={{ color: firstHome ? undefined : '#bbb' }}>
                  First Home Guarantee (5% deposit, no LMI)
                  <span className="info-icon" title="Government scheme — FHBs can buy with 5% deposit and no LMI. Income and price caps apply.">i</span>
                  <Toggle checked={fhgScheme} onChange={setFhgScheme} disabled={!firstHome} />
                </div>
                <div className="bool-item">
                  Professional Waiver
                  <span className="info-icon" title="Doctors, lawyers, accountants and some other professionals may qualify for LMI waiver up to 90% LVR.">i</span>
                  <Toggle checked={profLmi} onChange={setProfLmi} />
                </div>
                <div className="bool-item">
                  Family Guarantor
                  <span className="info-icon" title="A family member uses equity in their own property as additional security, removing the need for LMI.">i</span>
                  <Toggle checked={famGuarantor} onChange={setFamGuarantor} />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — calculated loan figures */}
          <div>
            {/* Property Value */}
            <CurrencyField label="Property Value" value={pv} onChange={setPropertyValue} />

            {/* Deposit Required */}
            <CurrencyField
              label="Deposit Required"
              value={depositOverride ? depositManual : contribution}
              onChange={v => { setDepositOverride(true); setDepositManual(v); setBaseLoanOverride(false); setTotalLoanOverride(false); }}
              autoCalc
              overrideActive={depositOverride}
              onToggleOverride={v => { setDepositOverride(v); if (!v) { setDepositManual(0); } }}
            />

            {/* Base LVR — shows actual computed LVR (pv × 80% default) */}
            <div className="field has-toggle">
              <label>Base LVR</label>
              {baseLvrOverride
                ? <input type="number" value={baseLvrManual}
                    onChange={e => setBaseLvrManual(Number(e.target.value))}
                    style={{ borderColor: 'var(--accent)' }} />
                : <input type="text" value={fmtPct(baseLvrCalc, 2)} readOnly />
              }
              <div className="field-right">
                {!baseLvrOverride && <span className="autocalc-badge">AUTOCALCULATED</span>}
                <Toggle checked={baseLvrOverride} onChange={v => { setBaseLvrOverride(v); if (!v) { setBaseLoanOverride(false); } }} />
              </div>
            </div>

            {/* Total LVR */}
            <div className="field">
              <label>Total LVR</label>
              <input type="text" value={fmtPct(totalLvr, 2)} readOnly
                style={lmiActive ? { borderColor: 'var(--lmi-border)', color: 'var(--lmi-text)' } : {}} />
            </div>

            {/* Base Loan */}
            <CurrencyField
              label="Base Loan Amount"
              value={rawBaseLoan}
              onChange={v => { setBaseLoanOverride(true); setBaseLoanManual(v); }}
              autoCalc
              overrideActive={baseLoanOverride}
              onToggleOverride={v => { setBaseLoanOverride(v); if (!v) setTotalLoanOverride(false); }}
            />

            {/* LMI inline row */}
            {lmiActive && (
              <div className="lmi-inline-row">
                <div className="lmi-inline-label">+ LMI {capLMI ? '(capitalised into loan)' : '(paid upfront)'}</div>
                <div className="lmi-inline-value">{fmt(lmi)}</div>
              </div>
            )}

            {/* Total Loan — read-only display */}
            <div className="field">
              <label>Total Loan Amount</label>
              <input type="text" value={fmt(totalLoan)} readOnly />
            </div>

            {/* Repayment */}
            <div className="repayment-bar">
              <div className="rep-field">
                <label>Rate %</label>
                <input type="number" value={rate} onChange={e => setRate(Number(e.target.value))} step="0.05" min="0" />
              </div>
              <div className="rep-field">
                <label>Term (yrs)</label>
                <input type="number" value={term} onChange={e => setTerm(Number(e.target.value))} min="1" max="30" />
              </div>
              <div className="rep-field">
                <label>IO Term</label>
                <input type="number" value={ioTerm} onChange={e => setIoTerm(Number(e.target.value))} min="0" max="10" />
              </div>
              <div className="rep-field">
                <label>Repayment/mo</label>
                <input type="text" value={fmt(repayment)} readOnly style={{ borderColor: 'var(--accent)', fontWeight: 700 }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Breakdown ── */}
      <button className="breakdown-toggle-btn" onClick={() => setShowBreakdown(v => !v)}>
        <span className={`chevron ${showBreakdown ? 'open' : ''}`} style={{ marginRight: 6 }}>▲</span>
        {showBreakdown ? 'Hide' : 'Show'} detailed breakdown of the maths
      </button>

      {showBreakdown && (
        <div className="breakdown-grid">

          {/* ── Government Charges ── */}
          <div className="breakdown-card">
            <h3>
              Government Charges
              {(stateCode === 'NT' || stateCode === 'VIC') && (
                <span className="info-icon" style={{ marginLeft: 6 }} title={stateCode === 'NT' ? 'NT fees are approximate — verify with NT Land Titles Office' : 'VIC transfer fee is approximate — confirm via Land Use Victoria'}>i</span>
              )}
            </h3>
            <div className="field has-toggle">
              <label>Total Government Charges</label>
              <input type="text" value={fmt(totalGovt)} readOnly />
              <div className="field-right"><Toggle checked={govtChargesOn} onChange={setGovtChargesOn} /></div>
            </div>
            <div className="field">
              <label>Stamp Duty {firstHome ? '(FHB rate applied)' : ''}</label>
              <input
                type={stampDutyOverride ? 'number' : 'text'}
                value={stampDutyOverride ? stampDutyManual : fmt(stampDuty)}
                onChange={e => { setStampDutyOverride(true); setStampDutyManual(Number(e.target.value)); }}
                onFocus={() => setStampDutyOverride(true)}
                style={stampDutyOverride ? { borderColor: 'var(--accent)' } : {}}
              />
            </div>
            {stampDutyOverride && (
              <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 8 }}>
                <button className="override-reset" onClick={() => { setStampDutyOverride(false); setStampDutyManual(0); }}>↩ Reset to auto</button>
              </div>
            )}
            <div className="field">
              <label>Stamp Duty Concession</label>
              <input
                type={stampDutyConcOverride ? 'number' : 'text'}
                value={stampDutyConcOverride ? stampDutyConcManual : fmt(stampDutyConc)}
                onChange={e => { setStampDutyConcOverride(true); setStampDutyConcManual(Number(e.target.value)); }}
                style={stampDutyConcOverride ? { borderColor: 'var(--accent)' } : {}}
              />
            </div>
            <div className="field">
              <label>Title Transfer Fee</label>
              <input type="text" value={`$${C.transferFee.toFixed(2)}`} readOnly />
            </div>
            <div className="field">
              <label>Mortgage Registration Fee</label>
              <input type="text" value={`$${C.mortgageReg.toFixed(2)}`} readOnly />
            </div>
          </div>

          {/* ── Fees & Other Costs ── */}
          <div className="breakdown-card">
            <h3>Fees &amp; Other Costs</h3>

            <div className="bool-item" style={{ marginBottom: 12, fontSize: '0.875rem', fontWeight: 600 }}>
              Use itemised fees <Toggle checked={useDetailedFees} onChange={setUseDetailedFees} />
            </div>

            {!useDetailedFees ? (
              <div className="field">
                <label>Legal &amp; Bank Fees (estimate)</label>
                <input type="text" value={fmt(DEFAULT_FEES)} readOnly />
              </div>
            ) : (<>
              <div className="field">
                <label>Conveyancer / Solicitor</label>
                <input type="number" value={conveyancerFee} onChange={e => setConveyancerFee(Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Bank / Lender Fees</label>
                <input type="number" value={bankFee} onChange={e => setBankFee(Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Building Inspection</label>
                <input type="number" value={buildingInspection} onChange={e => setBuildingInspection(Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Pest Inspection</label>
                <input type="number" value={pestInspection} onChange={e => setPestInspection(Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Other</label>
                <input type="number" value={otherFees} onChange={e => setOtherFees(Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Total Fees</label>
                <input type="text" value={fmt(fees)} readOnly style={{ borderColor: 'var(--accent)', fontWeight: 700 }} />
              </div>
            </>)}

            <div className="bool-item" style={{ marginTop: 14, marginBottom: 8, fontSize: '0.875rem', fontWeight: 600 }}>
              Include rates adjustment
              <span className="info-icon" style={{ marginLeft: 4 }} title="At settlement, buyers typically reimburse the seller for any council/water rates paid in advance. Usually $500–$1,500.">i</span>
              <Toggle checked={includeRates} onChange={setIncludeRates} />
            </div>
            {includeRates && (
              <div className="field">
                <label>Council / Water Rates Adjustment</label>
                <input type="number" value={ratesAmount} onChange={e => setRatesAmount(Number(e.target.value))} />
              </div>
            )}

            {firstHome && (
              <>
                <div className="bool-item" style={{ marginTop: 14, marginBottom: 8, fontSize: '0.875rem', fontWeight: 600 }}>
                  First Home Owner Grant
                  <span className="info-icon" style={{ marginLeft: 4 }} title="Cash grant from the state government for eligible first home buyers purchasing a new or off-the-plan home. Not available for established homes in most states.">i</span>
                  <Toggle checked={includeFhog} onChange={setIncludeFhog} />
                </div>
                {includeFhog && (
                  <div className="field">
                    <label>FHOG Amount ({stateCode}{!isNewBuild ? ' — n/a for established homes' : ''})</label>
                    <input
                      type="number"
                      value={fhogOverride ? fhogManual : autoFhog}
                      onChange={e => { setFhogOverride(true); setFhogManual(Number(e.target.value)); }}
                      style={{ borderColor: includeFhog && autoFhog > 0 ? 'var(--success)' : undefined }}
                    />
                  </div>
                )}
                {includeFhog && fhogOverride && (
                  <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 8 }}>
                    <button className="override-reset" onClick={() => { setFhogOverride(false); setFhogManual(0); }}>↩ Reset to auto</button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── LMI ── */}
          <div className="breakdown-card">
            <h3>Lender's Mortgage Insurance</h3>
            {lmiWaived && <div className="lmi-waived-badge">✓ LMI Waived</div>}
            {!lmiWaived && lmi === 0 && pv > 0 && <div className="lmi-none-badge">✓ No LMI — LVR ≤ 80%</div>}
            {lmiActive && (
              <div className="lmi-active-breakdown">
                <div className="lmi-breakdown-row"><span>Base Loan</span><span>{fmt(rawBaseLoan)}</span></div>
                <div className="lmi-breakdown-row"><span>LVR</span><span>{fmtPct(totalLvr, 2)}</span></div>
                <div className="lmi-breakdown-row lmi-highlight-row">
                  <span>Premium rate ({(lmiResult.rate * 100).toFixed(3)}%)</span>
                  <span>{fmt(lmiResult.basePremium)}</span>
                </div>
                {lmiResult.dutyOnPremium > 0 && (
                  <div className="lmi-breakdown-row">
                    <span>Stamp duty on premium ({stateCode})</span>
                    <span>{fmt(lmiResult.dutyOnPremium)}</span>
                  </div>
                )}
                {capLMI && (
                  <div className="lmi-breakdown-row lmi-total-row">
                    <span>Total Loan (incl. LMI)</span><span>{fmt(totalLoan)}</span>
                  </div>
                )}
              </div>
            )}
            <div className="field" style={{ marginTop: 10 }}>
              <label>Total LMI</label>
              <input type="text" value={fmt(lmi)} readOnly />
            </div>
            <div className="bool-item" style={{ marginBottom: 10 }}>
              Add LMI to loan (capitalise) <Toggle checked={capLMI} onChange={setCapLMI} />
            </div>
            <div className="bool-item" style={{ marginBottom: 10 }}>
              Override LMI amount <Toggle checked={overrideLMI} onChange={setOverrideLMI} />
            </div>
            {overrideLMI && (
              <div className="field">
                <label>Override Amount</label>
                <input type="number" value={lmiManualAmt} onChange={e => setLmiManualAmt(Number(e.target.value))} placeholder="$0" />
              </div>
            )}
            <div className="lmi-disclaimer">
              <strong>Estimate only.</strong> LMI premiums vary by lender and are not publicly published. This figure uses an industry-representative rate table. Always confirm the exact premium with your lender before settlement.
              {lmiResult.warnings?.length > 0 && <div style={{ marginTop: 4, color: 'var(--lmi-text)' }}>{lmiResult.warnings.join(' ')}</div>}
            </div>
          </div>

          {/* ── Full Cost Summary ── */}
          <div className="breakdown-card">
            <h3>Full Cost Summary</h3>
            <div className="lmi-breakdown-row" style={{ fontSize: '0.825rem' }}><span>Purchase Price</span><span>{fmt(pv)}</span></div>
            <div className="lmi-breakdown-row" style={{ fontSize: '0.825rem' }}><span>Stamp Duty</span><span>{fmt(netStampDuty)}</span></div>
            <div className="lmi-breakdown-row" style={{ fontSize: '0.825rem' }}><span>Title Transfer Fee</span><span>${transferFee.toFixed(2)}</span></div>
            <div className="lmi-breakdown-row" style={{ fontSize: '0.825rem' }}><span>Mortgage Registration</span><span>${mortgageReg.toFixed(2)}</span></div>
            <div className="lmi-breakdown-row" style={{ fontSize: '0.825rem' }}><span>Legal &amp; Bank Fees</span><span>{fmt(fees)}</span></div>
            {ratesAdj > 0 && <div className="lmi-breakdown-row" style={{ fontSize: '0.825rem' }}><span>Rates Adjustment</span><span>{fmt(ratesAdj)}</span></div>}
            {!capLMI && lmi > 0 && <div className="lmi-breakdown-row" style={{ fontSize: '0.825rem', color: 'var(--lmi-text)' }}><span>LMI (upfront)</span><span>{fmt(lmi)}</span></div>}
            {fhog > 0 && <div className="lmi-breakdown-row" style={{ fontSize: '0.825rem', color: 'var(--success)' }}><span>First Home Owner Grant</span><span>−{fmt(fhog)}</span></div>}
            <div className="lmi-breakdown-row lmi-total-row" style={{ marginTop: 6 }}><span>Total Funds Required</span><span>{fmt(fundsRequired)}</span></div>
            <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div className="lmi-breakdown-row" style={{ fontSize: '0.825rem' }}><span>Total Loan</span><span>{fmt(totalLoan)}</span></div>
              <div className="lmi-breakdown-row lmi-total-row" style={{ color: 'var(--accent)' }}><span>Cash Required</span><span>{fmt(contribution)}</span></div>
            </div>
          </div>

        </div>
      )}

      {/* ── Summary Table ── */}
      <div className="summary-table-card">
        <div className="summary-table-header">
          <h2>Summary</h2>
          <button className="print-btn" onClick={() => window.print()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print / Save PDF
          </button>
        </div>
        <table className="stbl">
          <thead>
            <tr><th style={{ width: '50%' }}></th><th>Funds Pos {propIndex + 1}</th></tr>
          </thead>
          <tbody>
            <tr><td>Property Value</td><td>{fmt(pv)}</td></tr>
            <tr><td>LVR</td><td>{fmtPct(totalLvr)}</td></tr>
            {lmiActive && <tr><td>LMI Applicable</td><td style={{ color: 'var(--lmi-text)', fontWeight: 600 }}>Yes — {fmt(lmi)}</td></tr>}
            <tr className="row-header"><td colSpan={2}>Funds Required</td></tr>
            <tr><td>Purchase Amount</td><td>{fmt(pv)}</td></tr>
            <tr><td>Government Charges</td><td>{fmt(totalGovt)}</td></tr>
            <tr><td>Legal and Bank Fees</td><td>{fmt(fees)}</td></tr>
            {!capLMI && lmi > 0 && <tr><td>LMI (paid upfront)</td><td>{fmt(lmi)}</td></tr>}
            <tr className="row-total"><td>Total Funds Required</td><td>{fmt(fundsRequired)}</td></tr>
            <tr className="row-header"><td colSpan={2}>Funds Available</td></tr>
            <tr><td>Base Loan Amount</td><td>{fmt(rawBaseLoan)}</td></tr>
            {capLMI && lmi > 0 && <tr><td>LMI (capitalised into loan)</td><td>{fmt(lmi)}</td></tr>}
            <tr><td>Proposed Loan Amount</td><td>{fmt(totalLoan)}</td></tr>
            <tr><td>Contribution Required</td><td className={contribution > 0 ? 'negative' : 'positive'}>{fmt(contribution)}</td></tr>
            <tr className="row-total"><td>Total Funds Available</td><td>{fmt(totalLoan + contribution)}</td></tr>
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════
          PRINT PAGE — hidden on screen, shown only when printing
          Browser: File → Print → Save as PDF
      ══════════════════════════════════════════════════════ */}
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
          {/* Left: Cost breakdown */}
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
              <span className="pp-row-value">${(transferFee + mortgageReg).toFixed(2)}</span>
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

          {/* Right: How it's funded */}
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
    </div>
  );
}
