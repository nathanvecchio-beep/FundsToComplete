import { useState, useMemo, useRef } from 'react';
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

export default function PropertyCalculator({ propIndex }) {
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
  const [feesOverride, setFeesOverride] = useState(false);
  const [feesManual, setFeesManual] = useState(DEFAULT_FEES);
  const [useDetailedFees, setUseDetailedFees] = useState(false);
  const [useDetailedFunds, setUseDetailedFunds] = useState(false);

  const stateCode = STATE_CODES[state] || 'NSW';
  const lmiWaived = fhgScheme || profLmi || famGuarantor;

  // ── All computation in one memo ──────────────────────────────────────────
  const C = useMemo(() => {
    const pv = Number(propertyValue) || 0;

    // Base LVR
    const baseLvr = baseLvrOverride ? Number(baseLvrManual) : 80;

    // Base loan (before LMI)
    const rawBaseLoan = baseLoanOverride
      ? Number(baseLoanManual)
      : totalLoanOverride
        ? Number(totalLoanManual)   // if user typed total loan directly, treat as base loan until LMI is known
        : Math.round(pv * baseLvr / 100);

    // Stamp duty
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
    const mortgageReg = calculateMortgageRegistration(stateCode, rawBaseLoan);
    const totalGovt = govtChargesOn ? (netStampDuty + transferFee + mortgageReg) : 0;

    // LMI — derived from rawBaseLoan vs propertyValue
    const lmiResult = calculateLMI(rawBaseLoan, pv, lmiWaived, stateCode);
    const lmiAuto = lmiResult.lmi;
    const lmi = overrideLMI ? Number(lmiManualAmt) : lmiAuto;
    const capitalisedLmi = capLMI ? lmi : 0;

    // Total loan — baseLoan + capitalised LMI (unless user has directly overridden total loan AND also overridden base loan)
    const totalLoan = (totalLoanOverride && baseLoanOverride)
      ? Number(totalLoanManual)
      : rawBaseLoan + capitalisedLmi;

    // LVRs
    const baseLvrCalc = pv > 0 ? (rawBaseLoan / pv * 100) : 0;
    const totalLvr    = pv > 0 ? (totalLoan / pv * 100) : 0;

    // Fees & funds
    const fees = feesOverride ? Number(feesManual) : DEFAULT_FEES;
    const totalFundsRequired = pv + totalGovt + fees + (capLMI ? 0 : lmi);
    const fundsRequired = fundsOverride ? Number(fundsManual) : totalFundsRequired;

    const repayment = calculateRepayment(totalLoan, rate, term, ioTerm);

    return {
      pv, baseLvr, baseLvrCalc, rawBaseLoan, totalLoan, totalLvr,
      stampDuty, stampDutyConc, netStampDuty, transferFee, mortgageReg, totalGovt,
      lmi, lmiResult, capitalisedLmi, fees, fundsRequired, repayment,
      lmiActive: lmi > 0 && !lmiWaived,
    };
  }, [
    propertyValue,
    baseLvrOverride, baseLvrManual,
    baseLoanOverride, baseLoanManual,
    totalLoanOverride, totalLoanManual,
    fundsOverride, fundsManual,
    stateCode, firstHome, propertyType, purpose, foreignBuyer,
    stampDutyOverride, stampDutyManual, stampDutyConcOverride, stampDutyConcManual,
    govtChargesOn, feesOverride, feesManual,
    capLMI, overrideLMI, lmiManualAmt, lmiWaived,
    rate, term, ioTerm,
  ]);

  const { pv, baseLvr, baseLvrCalc, rawBaseLoan, totalLoan, totalLvr,
    stampDuty, stampDutyConc, netStampDuty, transferFee, mortgageReg, totalGovt,
    lmi, lmiResult, capitalisedLmi, fees, fundsRequired, repayment, lmiActive } = C;

  const contribution = Math.max(0, fundsRequired - totalLoan);
  const surplus = totalLoan - fundsRequired;

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
          {/* LEFT — loan scenario options */}
          <div>
            <SelectField label="Property State" value={state} onChange={setState}
              options={STATES.map(s => ({ value: s, label: s }))} />
            <SelectField label="Property Type" value={propertyType} onChange={setPropertyType}
              options={PROPERTY_TYPES} />
            <SelectField label="Investment / Owner Occupied" value={purpose} onChange={setPurpose}
              options={PURPOSES} />
            <SelectField label="Transaction Type" value={transType} onChange={setTransType}
              options={TRANS_TYPES} />

            <div className="bool-list" style={{ marginTop: 16 }}>
              <div className="bool-item">First Home Buyer <Toggle checked={firstHome} onChange={setFirstHome} /></div>
              <div className="bool-item">Different Contract Price/Valuation <Toggle checked={diffValuation} onChange={setDiffValuation} /></div>
              <div className="bool-item">Self Employed <Toggle checked={selfEmployed} onChange={setSelfEmployed} /></div>
              <div className="bool-item">Foreign Buyer <Toggle checked={foreignBuyer} onChange={setForeignBuyer} /></div>
            </div>

            <div className="collapsible-header" onClick={() => setLmiOpen(v => !v)}>
              <span className={`chevron ${lmiOpen ? 'open' : ''}`}>▲</span>
              Apply LMI Waiver Policy
            </div>
            {lmiOpen && (
              <div className="bool-list" style={{ marginTop: 10 }}>
                <div className="bool-item" style={{ color: firstHome ? undefined : '#bbb' }}>
                  First Home Guarantee Scheme
                  <span className="info-icon" title="Only available for first home buyers">i</span>
                  <Toggle checked={fhgScheme} onChange={setFhgScheme} disabled={!firstHome} />
                </div>
                <div className="bool-item">
                  Professional LMI Waiver
                  <span className="info-icon" title="Doctors, lawyers, accountants may qualify for LMI waiver at 90% LVR">i</span>
                  <Toggle checked={profLmi} onChange={setProfLmi} />
                </div>
                <div className="bool-item">
                  Family Guarantor
                  <span className="info-icon" title="Family member provides equity in their property as security">i</span>
                  <Toggle checked={famGuarantor} onChange={setFamGuarantor} />
                </div>
              </div>
            )}
            <div className="lender-row">
              <div className="lender-logo">ING</div>
              ING
            </div>
          </div>

          {/* RIGHT — calculated loan figures */}
          <div>
            {/* Property Value */}
            <CurrencyField label="Property Value" value={pv} onChange={setPropertyValue} />

            {/* Funds Required */}
            <CurrencyField
              label="Funds Required"
              value={fundsRequired}
              onChange={setFundsManual}
              autoCalc overrideActive={fundsOverride}
              onToggleOverride={setFundsOverride}
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

            {/* Total Loan */}
            <CurrencyField
              label="Total Loan Amount"
              value={totalLoan}
              onChange={v => { setTotalLoanOverride(true); setBaseLoanOverride(true); setTotalLoanManual(v); setBaseLoanManual(v); }}
              autoCalc
              overrideActive={totalLoanOverride && baseLoanOverride}
              onToggleOverride={v => { setTotalLoanOverride(v); setBaseLoanOverride(v); }}
            />

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
          {/* LMI */}
          <div className="breakdown-card">
            <h3>LMI</h3>
            {lmiWaived && <div className="lmi-waived-badge">✓ LMI Waived</div>}
            {!lmiWaived && lmi === 0 && pv > 0 && <div className="lmi-none-badge">✓ No LMI — LVR ≤ 80%</div>}
            {lmiActive && (
              <div className="lmi-active-breakdown">
                <div className="lmi-breakdown-row">
                  <span>Base Loan</span><span>{fmt(rawBaseLoan)}</span>
                </div>
                <div className="lmi-breakdown-row">
                  <span>LVR</span><span>{fmtPct(totalLvr, 2)}</span>
                </div>
                <div className="lmi-breakdown-row lmi-highlight-row">
                  <span>Base Premium ({(lmiResult.rate * 100).toFixed(4)}%)</span>
                  <span>{fmt(lmiResult.basePremium)}</span>
                </div>
                {lmiResult.dutyOnPremium > 0 && (
                  <div className="lmi-breakdown-row">
                    <span>Stamp Duty on Premium ({stateCode})</span>
                    <span>{fmt(lmiResult.dutyOnPremium)}</span>
                  </div>
                )}
                {capLMI && (
                  <div className="lmi-breakdown-row lmi-total-row">
                    <span>Total Loan (inc. LMI)</span><span>{fmt(totalLoan)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="field" style={{ marginTop: 10 }}>
              <label>Total LMI Cost</label>
              <input type="text" value={fmt(lmi)} readOnly />
            </div>
            <div className="bool-item" style={{ marginBottom: 10 }}>
              Capitalise LMI into Loan <Toggle checked={capLMI} onChange={setCapLMI} />
            </div>
            <SelectField label="Which Lender" value={lmiLender} onChange={setLmiLender}
              options={['ING','CBA','ANZ','Westpac','NAB','Macquarie','St George']} />
            <div className="bool-item" style={{ marginBottom: 10 }}>
              Override LMI <Toggle checked={overrideLMI} onChange={setOverrideLMI} />
            </div>
            {overrideLMI && (
              <div className="field">
                <label>Override Amount</label>
                <input type="number" value={lmiManualAmt} onChange={e => setLmiManualAmt(Number(e.target.value))} placeholder="$0" />
              </div>
            )}

            {/* Disclaimer */}
            <div className="lmi-disclaimer">
              <strong>Estimate only.</strong> LMI premiums are not publicly disclosed by individual banks. This uses an industry-representative rate table — actual premium may differ. Obtain a formal quote from your lender at application.
              {lmiResult.warnings?.length > 0 && <div style={{ marginTop: 4, color: 'var(--lmi-text)' }}>{lmiResult.warnings.join(' ')}</div>}
            </div>
          </div>

          {/* Govt Charges */}
          <div className="breakdown-card">
            <h3>
              Govt Charges
              {stateCode === 'NT' && <span className="info-icon" style={{ marginLeft: 6 }} title="NT fees approximate — verify with NT Land Titles Office">i</span>}
              {stateCode === 'VIC' && <span className="info-icon" style={{ marginLeft: 6 }} title="VIC transfer fee approximate — confirm via Land Use Victoria">i</span>}
            </h3>
            <div className="field has-toggle">
              <label>Total Govt Charges</label>
              <input type="text" value={fmt(totalGovt)} readOnly />
              <div className="field-right"><Toggle checked={govtChargesOn} onChange={setGovtChargesOn} /></div>
            </div>
            <div className="field">
              <label>Base Stamp Duty</label>
              <input
                type={stampDutyOverride ? 'number' : 'text'}
                value={stampDutyOverride ? stampDutyManual : fmt(stampDuty)}
                onChange={e => setStampDutyManual(Number(e.target.value))}
                readOnly={!stampDutyOverride}
              />
            </div>
            <div className="field">
              <label>Stamp Duty Concession</label>
              <input
                type={stampDutyConcOverride ? 'number' : 'text'}
                value={stampDutyConcOverride ? stampDutyConcManual : fmt(stampDutyConc)}
                onChange={e => setStampDutyConcManual(Number(e.target.value))}
                readOnly={!stampDutyConcOverride}
              />
            </div>
            <div className="field">
              <label>Transfer (Title Registration) Fee</label>
              <input type="text" value={`$${C.transferFee.toFixed(2)}`} readOnly />
            </div>
            <div className="field">
              <label>Mortgage Registration Fee</label>
              <input type="text" value={`$${C.mortgageReg.toFixed(2)}`} readOnly />
            </div>
          </div>

          {/* Funds Required */}
          <div className="breakdown-card">
            <h3>Funds Required</h3>
            <div className="field">
              <label>Total Funds Required</label>
              <input type="text" value={fmt(fundsRequired)} readOnly />
            </div>
            <div className="bool-item" style={{ marginBottom: 10, fontSize: '0.875rem' }}>
              Use Detailed <Toggle checked={useDetailedFunds} onChange={setUseDetailedFunds} />
            </div>
            {useDetailedFunds && (<>
              <div className="field"><label>Purchase Amount</label><input type="text" value={fmt(pv)} readOnly /></div>
              <div className="field"><label>Government Charges</label><input type="text" value={fmt(totalGovt)} readOnly /></div>
              <div className="field"><label>Legal &amp; Bank Fees</label><input type="text" value={fmt(fees)} readOnly /></div>
              {!capLMI && lmi > 0 && <div className="field"><label>LMI (upfront)</label><input type="text" value={fmt(lmi)} readOnly /></div>}
            </>)}
          </div>

          {/* Fees */}
          <div className="breakdown-card">
            <h3>Fees</h3>
            <div className="field">
              <label>Total Fees</label>
              <input
                type={feesOverride ? 'number' : 'text'}
                value={feesOverride ? feesManual : fmt(fees)}
                onChange={e => setFeesManual(Number(e.target.value))}
                readOnly={!feesOverride}
                style={feesOverride ? { borderColor: 'var(--accent)' } : {}}
              />
            </div>
            <div className="bool-item" style={{ fontSize: '0.875rem', marginBottom: 10 }}>
              Use Detailed <Toggle checked={useDetailedFees} onChange={setUseDetailedFees} />
            </div>
            {useDetailedFees && (<>
              <div className="field" style={{ marginTop: 8 }}><label>Legal Fees</label><input type="number" defaultValue={1500} /></div>
              <div className="field"><label>Bank Fees</label><input type="number" defaultValue={1000} /></div>
              <div className="field"><label>Other</label><input type="number" defaultValue={500} /></div>
            </>)}
          </div>
        </div>
      )}

      {/* ── Summary Table ── */}
      <div className="summary-table-card">
        <div className="summary-table-header"><h2>Summary</h2></div>
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
            <tr className="row-header"><td colSpan={2}>Total Funds</td></tr>
            <tr className="row-total"><td><strong>Total Funds</strong></td><td>{fmt(fundsRequired)}</td></tr>
            <tr className="row-total">
              <td>Total Funds Surplus/Deficit</td>
              <td className={surplus >= 0 ? 'positive' : 'negative'}>
                {surplus >= 0 ? fmt(surplus) : `−${fmt(Math.abs(surplus))}`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
