import { useState, useCallback } from 'react';
import PropertyCalculator from './components/PropertyCalculator';

// Hunter Galloway logo mark — house silhouette with arch doorway cutout
function HGMark({ size = 38, fillColour = '#F5A41F', cutColour = '#1a1a1a' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Full house silhouette: roof peak at top-centre, walls down to base */}
      <path d="M50 6 L94 46 L94 94 L6 94 L6 46 Z" fill={fillColour} />
      {/* Arch doorway cut-out — rectangle with semicircle top */}
      <path d="M37 94 L37 65 A13 13 0 0 1 63 65 L63 94 Z" fill={cutColour} />
    </svg>
  );
}

function fmt(n) {
  if (!n) return '$0';
  return '$' + Math.round(Number(n)).toLocaleString();
}
function fmtPct(n, dec = 1) {
  if (!n) return '0.0%';
  return Number(n).toFixed(dec) + '%';
}

export default function App() {
  const [properties, setProperties] = useState([{ id: 1, label: 'Property 1' }]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeTab, setActiveTab] = useState('calculator');
  // Holds the live summary data from each PropertyCalculator
  const [summaries, setSummaries] = useState({});

  const addProperty = () => {
    const next = { id: Date.now(), label: `Property ${properties.length + 1}` };
    setProperties(p => [...p, next]);
    setActiveIdx(properties.length);
  };

  const handleSummaryUpdate = useCallback((id, data) => {
    setSummaries(prev => ({ ...prev, [id]: data }));
  }, []);

  return (
    <div>
      <header className="app-header">
        <div className="app-header-left">
          <div className="hg-logo">
            <HGMark size={38} fillColour="#F5A41F" cutColour="#1a1a1a" />
            <div className="hg-logo-text">
              <span className="hg-logo-eyebrow">Mortgage Broker Brisbane</span>
              <span className="hg-logo-name">Hunter <span>Galloway</span></span>
            </div>
          </div>
          <h1>Funds to Complete</h1>
        </div>
        <div className="app-header-right">huntergalloway.com.au &nbsp;·&nbsp; 1300 088 065</div>
      </header>

      <div className="app-body">
        <div className="tabs">
          <button className={`tab-btn ${activeTab === 'calculator' ? 'active' : ''}`} onClick={() => setActiveTab('calculator')}>Calculator</button>
          <button className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>Summary</button>
        </div>

        {activeTab === 'calculator' && (
          <div className="property-tabs">
            {properties.map((p, i) => (
              <button key={p.id} className={`prop-tab ${i === activeIdx ? 'active' : ''}`} onClick={() => setActiveIdx(i)}>
                {p.label}
              </button>
            ))}
            <button className="prop-tab-add" onClick={addProperty} title="Add property">+</button>
          </div>
        )}

        {/* All calculators stay mounted — only active one is visible — preserves inputs */}
        {properties.map((p, i) => (
          <div key={p.id} style={{ display: activeTab === 'calculator' && i === activeIdx ? 'block' : 'none' }}>
            <PropertyCalculator
              propIndex={i}
              label={p.label}
              onSummaryUpdate={(data) => handleSummaryUpdate(p.id, data)}
            />
          </div>
        ))}

        {/* Summary tab */}
        {activeTab === 'summary' && (
          <SummaryView properties={properties} summaries={summaries} />
        )}
      </div>
    </div>
  );
}

function SummaryView({ properties, summaries }) {
  const cols = properties.map(p => summaries[p.id]).filter(Boolean);

  if (cols.length === 0) {
    return (
      <div className="property-card" style={{ textAlign: 'center', padding: 48 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
          Enter a property value in the Calculator tab to see the summary here.
        </p>
      </div>
    );
  }

  const rows = [
    { section: 'Property Details' },
    { label: 'Property Value',      key: d => fmt(d.pv) },
    { label: 'State / Purpose',     key: d => `${d.stateCode} · ${d.purpose}` },
    { label: 'Loan Amount',         key: d => fmt(d.totalLoan) },
    { label: 'LVR',                 key: d => fmtPct(d.totalLvr), highlight: d => d.lmiActive },
    { label: 'LMI Applicable',      key: d => d.lmiActive ? `Yes — ${fmt(d.lmi)}` : 'No', highlight: d => d.lmiActive },
    { section: 'Cost Breakdown' },
    { label: 'Stamp Duty',          key: d => fmt(d.netStampDuty) },
    { label: 'Transfer & Reg Fees', key: d => `$${(d.transferFee + d.mortgageReg).toFixed(2)}` },
    { label: 'Legal & Bank Fees',   key: d => fmt(d.fees) },
    { label: 'Total Govt Charges',  key: d => fmt(d.totalGovt) },
    { label: 'Total Funds Required',key: d => fmt(d.fundsRequired), bold: true },
    { section: 'Loan Summary' },
    { label: 'Base Loan',           key: d => fmt(d.rawBaseLoan) },
    { label: 'LMI (capitalised)',   key: d => d.lmiActive && d.capLMI ? fmt(d.lmi) : '—' },
    { label: 'Total Loan',          key: d => fmt(d.totalLoan), bold: true },
    { section: 'Cash Required' },
    { label: 'Cash Deposit Required', key: d => fmt(d.contribution), bold: true, highlight: () => true },
    { label: 'Est. Monthly Repayment',key: d => `${fmt(d.repayment)}/mo` },
  ];

  return (
    <div className="summary-table-card">
      <div className="summary-table-header"><h2>Summary</h2></div>
      <div style={{ overflowX: 'auto' }}>
        <table className="stbl">
          <thead>
            <tr>
              <th style={{ width: '30%' }}></th>
              {cols.map((c, i) => <th key={i}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              if (row.section) {
                return (
                  <tr key={ri} className="row-header">
                    <td colSpan={cols.length + 1}>{row.section}</td>
                  </tr>
                );
              }
              return (
                <tr key={ri} className={row.bold ? 'row-total' : ''}>
                  <td>{row.label}</td>
                  {cols.map((c, ci) => (
                    <td key={ci} style={row.highlight?.(c) ? { color: 'var(--lmi-text)', fontWeight: 700 } : row.bold ? { color: 'var(--accent)', fontWeight: 700 } : {}}>
                      {row.key(c)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
