import { useState, useMemo } from 'react';
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
function pct(n, dec = 2) {
  if (n == null) return '0%';
  return Number(n).toFixed(dec) + '%';
}

export default function PropertyCalculator({ propIndex }) {
  // Left panel state
  const [state, setState] = useState('New South Wales');
  const [propertyType, setPropertyType] = useState('Established Home');
  const [purpose, setPurpose] = useState('Owner Occupied');
  const [transType, setTransType] = useState('Purchase');
  const [firstHome, setFirstHome] = useState(false);
  const [diffValuation, setDiffValuation] = useState(false);
  const [selfEmployed, setSelfEmployed] = useState(false);
  const [foreignBuyer, setForeignBuyer] = useState(false);

  // LMI waiver
  const [lmiOpen, setLmiOpen] = useState(true);
  const [fhgScheme, setFhgScheme] = useState(false);
  const [profLmi, setProfLmi] = useState(false);
  const [famGuarantor, setFamGuarantor] = useState(false);

  // Right panel
  const [propertyValue, setPropertyValue] = useState(0);
  const [fundsOverride, setFundsOverride] = useState(false);
  const [fundsManual, setFundsManual] = useState(0);
  const [baseLvrOverride, setBaseLvrOverride] = useState(false);
  const [baseLvrManual, setBaseLvrManual] = useState(80);
  const [totalLvrOverride, setTotalLvrOverride] = useState(false);
  const [totalLvrManual, setTotalLvrManual] = useState(80);
  const [baseLoanOverride, setBaseLoanOverride] = useState(false);
  const [baseLoanManual, setBaseLoanManual] = useState(0);
  const [totalLoanOverride, setTotalLoanOverride] = useState(false);
  const [totalLoanManual, setTotalLoanManual] = useState(0);

  // Repayment
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [term, setTerm] = useState(DEFAULT_TERM);
  const [ioTerm, setIoTerm] = useState(0);

  // Breakdown
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [govtChargesOn, setGovtChargesOn] = useState(true);

  // Govt charges manual overrides (breakdown section)
  const [stampDutyOverride, setStampDutyOverride] = useState(false);
  const [stampDutyManual, setStampDutyManual] = useState(0);
  const [stampDutyConcOverride, setStampDutyConcOverride] = useState(false);
  const [stampDutyConcManual, setStampDutyConcManual] = useState(0);

  // Fees
  const [feesOverride, setFeesOverride] = useState(false);
  const [feesManual, setFeesManual] = useState(DEFAULT_FEES);

  // LMI fields
  const [capLMI, setCapLMI] = useState(true);
  const [lmiLender, setLmiLender] = useState('ING');
  const [overrideLMI, setOverrideLMI] = useState(false);
  const [lmiManual, setLmiManual] = useState(0);

  // Funds required breakdown
  const [useDetailedFunds, setUseDetailedFunds] = useState(false);
  const [useDetailedFees, setUseDetailedFees] = useState(false);

  const stateCode = STATE_CODES[state] || 'NSW';
  const lmiWaived = fhgScheme || profLmi || famGuarantor;

  // ── Computed values ──────────────────────────────────────────────────────
  const computed = useMemo(() => {
    const pv = Number(propertyValue) || 0;
    const defaultBaseLvr = 80;
    const baseLvr = baseLvrOverride ? Number(baseLvrManual) : defaultBaseLvr;

    const rawBaseLoan = baseLoanOverride ? Number(baseLoanManual) : Math.round(pv * baseLvr / 100);

    // Stamp duty
    const autoStampDuty = calculateStampDuty(stateCode, pv, firstHome, propertyType);
    const stampDuty = stampDutyOverride ? Number(stampDutyManual) : autoStampDuty;
    const stampDutyConc = stampDutyConcOverride ? Number(stampDutyConcManual) : 0;
    const netStampDuty = Math.max(0, stampDuty - stampDutyConc);

    // Other govt charges
    const transferFee = calculateTransferFee(stateCode, pv);
    const mortgageReg = calculateMortgageRegistration(stateCode, rawBaseLoan);
    const totalGovt = govtChargesOn ? (netStampDuty + transferFee + mortgageReg) : 0;

    // LMI
    const autoLmi = calculateLMI(rawBaseLoan, pv, lmiWaived);
    const lmi = overrideLMI ? Number(lmiManual) : autoLmi;
    const capitalisedLmi = capLMI ? lmi : 0;

    const totalLoan = totalLoanOverride
      ? Number(totalLoanManual)
      : rawBaseLoan + capitalisedLmi;

    const totalLvr = pv > 0 ? (totalLoan / pv * 100) : 0;

    const fees = feesOverride ? Number(feesManual) : DEFAULT_FEES;

    // Funds required = purchase price + govt charges + fees + non-cap LMI - loan
    const totalFundsRequired = pv + totalGovt + fees + (capLMI ? 0 : lmi);
    const fundsRequired = fundsOverride ? Number(fundsManual) : totalFundsRequired;

    const repayment = calculateRepayment(totalLoan, rate, term, ioTerm);

    return {
      pv, baseLvr, rawBaseLoan, totalLoan, totalLvr,
      stampDuty, stampDutyConc, netStampDuty, transferFee, mortgageReg, totalGovt,
      lmi, capitalisedLmi, fees, fundsRequired, totalFundsRequired,
      repayment,
    };
  }, [
    propertyValue, baseLvrOverride, baseLvrManual, baseLoanOverride, baseLoanManual,
    totalLoanOverride, totalLoanManual, fundsOverride, fundsManual,
    stateCode, firstHome, propertyType,
    stampDutyOverride, stampDutyManual, stampDutyConcOverride, stampDutyConcManual,
    govtChargesOn, feesOverride, feesManual,
    capLMI, overrideLMI, lmiManual, lmiWaived,
    rate, term, ioTerm,
  ]);

  const { pv, baseLvr, rawBaseLoan, totalLoan, totalLvr,
    stampDuty, stampDutyConc, netStampDuty, transferFee, mortgageReg, totalGovt,
    lmi, fees, fundsRequired, repayment } = computed;

  // Deposit / contribution required
  const contribution = Math.max(0, fundsRequired - totalLoan);
  const surplus = totalLoan - fundsRequired;

  return (
    <div>
      {/* ── Summary Bar ── */}
      <div className="summary-bar">
        <div className="summary-bar-item">
          <div className="sb-label">Property Value</div>
          <div className="sb-value">{fmt(pv)}</div>
        </div>
        <div className="summary-bar-item">
          <div className="sb-label">Total Loan</div>
          <div className="sb-value">{fmt(totalLoan)}</div>
        </div>
        <div className="summary-bar-item">
          <div className="sb-label">Total LVR</div>
          <div className="sb-value">{pct(totalLvr, 0)}</div>
        </div>
        <div className="summary-bar-item">
          <div className="sb-label">Funds Required</div>
          <div className="sb-value">{fundsRequired > 0 ? fmt(fundsRequired) : 'N/A'}</div>
        </div>
      </div>

      {/* ── Main calculator card ── */}
      <div className="property-card">
        <div className="calc-grid">
          {/* LEFT */}
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

            {/* LMI Waiver collapsible */}
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
                  <span className="info-icon" title="Available for certain professionals: doctors, lawyers, accountants">i</span>
                  <Toggle checked={profLmi} onChange={setProfLmi} />
                </div>
                <div className="bool-item">
                  Family Guarantor
                  <span className="info-icon" title="Family member provides equity in their property as security">i</span>
                  <Toggle checked={famGuarantor} onChange={setFamGuarantor} />
                </div>
              </div>
            )}

            {/* Lender row */}
            <div className="lender-row">
              <div className="lender-logo">ING</div>
              ING
            </div>
          </div>

          {/* RIGHT */}
          <div>
            <CurrencyField
              label="Property Value"
              value={pv}
              onChange={setPropertyValue}
              className="active-input"
            />
            <CurrencyField
              label="Funds Required"
              value={fundsRequired}
              onChange={setFundsManual}
              autoCalc
              overrideActive={fundsOverride}
              onToggleOverride={setFundsOverride}
            />
            <PercentField label="Base LVR" value={pct(baseLvr, 0).replace('%', '')} />
            <PercentField label="Total LVR" value={pct(totalLvr, 2).replace('%', '')} />
            <CurrencyField
              label="Base Loan Amount"
              value={rawBaseLoan}
              onChange={setBaseLoanManual}
              autoCalc
              overrideActive={baseLoanOverride}
              onToggleOverride={setBaseLoanOverride}
            />
            <CurrencyField
              label="Total Loan Amount"
              value={totalLoan}
              onChange={setTotalLoanManual}
              autoCalc
              overrideActive={totalLoanOverride}
              onToggleOverride={setTotalLoanOverride}
            />

            {/* Repayment bar */}
            <div className="repayment-bar">
              <div className="rep-field">
                <label>Rate</label>
                <input
                  type="number"
                  value={rate}
                  onChange={e => setRate(Number(e.target.value))}
                  step="0.05"
                  min="0"
                  className="highlighted"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>
              <div className="rep-field">
                <label>Term</label>
                <input
                  type="number"
                  value={term}
                  onChange={e => setTerm(Number(e.target.value))}
                  min="1"
                  max="30"
                />
              </div>
              <div className="rep-field">
                <label>IO Term</label>
                <input
                  type="number"
                  value={ioTerm}
                  onChange={e => setIoTerm(Number(e.target.value))}
                  min="0"
                  max="10"
                />
              </div>
              <div className="rep-field">
                <label>Repayment</label>
                <input
                  type="text"
                  value={fmt(repayment)}
                  readOnly
                  className="highlighted"
                  style={{ borderColor: 'var(--accent)', width: 120 }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Math Breakdown toggle ── */}
      <button className="breakdown-toggle-btn" onClick={() => setShowBreakdown(v => !v)}>
        ≫ {showBreakdown ? 'Hide' : 'Click to see'} detailed breakdown of the math ≫
      </button>

      {showBreakdown && (
        <div className="breakdown-grid">
          {/* LMI */}
          <div className="breakdown-card">
            <h3>LMI</h3>
            <div className="field">
              <label>LMI Being Applied</label>
              <input type="text" value={fmt(lmi)} readOnly />
            </div>
            <div className="bool-item" style={{ marginBottom: 14 }}>
              Capitalise LMI <Toggle checked={capLMI} onChange={setCapLMI} />
            </div>
            <SelectField label="Which Lender" value={lmiLender} onChange={setLmiLender}
              options={['ING','CBA','ANZ','Westpac','NAB','Macquarie','St George']} />
            <div className="bool-item" style={{ marginBottom: 10 }}>
              Override LMI <Toggle checked={overrideLMI} onChange={setOverrideLMI} />
            </div>
            {overrideLMI && (
              <div className="field">
                <label>Override Amount</label>
                <input type="number" value={lmiManual} onChange={e => setLmiManual(Number(e.target.value))} placeholder="$0" />
              </div>
            )}
          </div>

          {/* Govt Charges */}
          <div className="breakdown-card">
            <h3>Govt Charges</h3>
            <div className="field has-toggle">
              <label>Total</label>
              <input type="text" value={fmt(totalGovt)} readOnly />
              <div className="field-right">
                <Toggle checked={govtChargesOn} onChange={setGovtChargesOn} />
              </div>
            </div>
            <div style={{ marginBottom: 10, fontWeight: 600, fontSize: '0.875rem' }}>Breakdown</div>
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
              <label>Mortgage Registration</label>
              <input type="text" value={fmt(computed.mortgageReg)} readOnly />
            </div>
            <div className="field">
              <label>Transfer Fee</label>
              <input type="text" value={fmt(computed.transferFee)} readOnly />
            </div>
          </div>

          {/* Funds Required */}
          <div className="breakdown-card">
            <h3>Funds Required</h3>
            <div className="field">
              <label>Funds Required</label>
              <input type="text" value={fmt(fundsRequired)} readOnly />
            </div>
            <div className="bool-item" style={{ marginBottom: 10, fontSize: '0.875rem' }}>
              Use Detailed <Toggle checked={useDetailedFunds} onChange={setUseDetailedFunds} />
            </div>
            {useDetailedFunds && (
              <>
                <div className="field">
                  <label>Purchase Amount</label>
                  <input type="text" value={fmt(pv)} readOnly />
                </div>
                <div className="field">
                  <label>Government Charges</label>
                  <input type="text" value={fmt(totalGovt)} readOnly />
                </div>
                <div className="field">
                  <label>Legal &amp; Bank Fees</label>
                  <input type="text" value={fmt(fees)} readOnly />
                </div>
              </>
            )}
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
            <div className="bool-item" style={{ fontSize: '0.875rem' }}>
              Use Detailed <Toggle checked={useDetailedFees} onChange={setUseDetailedFees} />
            </div>
            {useDetailedFees && (
              <>
                <div className="field" style={{ marginTop: 12 }}>
                  <label>Legal Fees</label>
                  <input type="number" defaultValue={1500} />
                </div>
                <div className="field">
                  <label>Bank Fees</label>
                  <input type="number" defaultValue={1000} />
                </div>
                <div className="field">
                  <label>Other</label>
                  <input type="number" defaultValue={500} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Summary Table ── */}
      <div className="summary-table-card">
        <div className="summary-table-header">
          <h2>Summary</h2>
        </div>
        <table className="stbl">
          <thead>
            <tr>
              <th style={{ width: '40%' }}></th>
              <th>Funds Pos {propIndex + 1}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Property Value</td>
              <td>{fmt(pv)}</td>
            </tr>
            <tr>
              <td>LVR</td>
              <td>{pct(totalLvr)}</td>
            </tr>
            <tr className="row-header">
              <td colSpan={2}>Funds Required</td>
            </tr>
            <tr>
              <td>Purchase Amount</td>
              <td>{fmt(pv)}</td>
            </tr>
            <tr>
              <td>Government Charges</td>
              <td>{fmt(totalGovt)}</td>
            </tr>
            <tr>
              <td>Legal and Bank Fees</td>
              <td>{fmt(fees)}</td>
            </tr>
            <tr className="row-total">
              <td>Total Funds Required</td>
              <td>{fmt(fundsRequired)}</td>
            </tr>
            <tr className="row-header">
              <td colSpan={2}>Funds Available</td>
            </tr>
            <tr>
              <td>Proposed Loan Amount</td>
              <td>{fmt(totalLoan)}</td>
            </tr>
            <tr>
              <td>Contribution Required</td>
              <td className={contribution > 0 ? 'negative' : 'positive'}>{fmt(contribution)}</td>
            </tr>
            <tr className="row-total">
              <td>Total Funds Available</td>
              <td>{fmt(totalLoan)}</td>
            </tr>
            <tr className="row-header">
              <td colSpan={2}>Total Funds</td>
            </tr>
            <tr className="row-total">
              <td><strong>Total Funds</strong></td>
              <td>{fmt(fundsRequired)}</td>
            </tr>
            <tr className="row-total">
              <td>Total Funds Surplus/Deficit</td>
              <td className={surplus >= 0 ? 'positive' : 'negative'}>
                {surplus >= 0 ? fmt(surplus) : `-${fmt(Math.abs(surplus))}`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
