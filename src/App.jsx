import { useState, useCallback, useEffect } from 'react';
import PropertyCalculator from './components/PropertyCalculator';

// Hunter Galloway logo mark — accurate recreation of the HG house icon
function HGMark({ size = 38, fillColour = '#1a1a1a', cutColour = 'white' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* House silhouette: peak slightly left of centre, rectangular notch on right */}
      <path d="M8 95 L8 46 L47 7 L92 46 L92 95 Z" fill={fillColour} />
      {/* Rectangular cutout on right side — tall door/window shape */}
      <rect x="57" y="52" width="23" height="43" fill={cutColour} />
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

function CopyLinkButton({ summaries, properties }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const payload = properties.map((p, i) => {
      const s = summaries[p.id];
      if (!s) return { label: p.label };
      return {
        label: p.label,
        ...(s.inputState || {}),
      };
    });
    const encoded = btoa(JSON.stringify(payload));
    const url = `${window.location.origin}${window.location.pathname}?share=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button className="header-copy-btn" onClick={handleCopy}>
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  );
}

export default function App() {
  const [properties, setProperties] = useState([{ id: 1, label: 'Property 1' }]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeTab, setActiveTab] = useState('calculator');
  const [summaries, setSummaries] = useState({});
  const [initialValues, setInitialValues] = useState([]);
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingLabel, setEditingLabel] = useState('');

  // Parse URL share param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('share');
    if (encoded) {
      try {
        const data = JSON.parse(atob(encoded));
        if (Array.isArray(data) && data.length > 0) {
          setProperties(data.map((d, i) => ({ id: i + 1, label: d.label || `Property ${i + 1}` })));
          setInitialValues(data);
        }
      } catch(e) {}
    }
  }, []);

  // Set data-active-tab on body for print style switching
  useEffect(() => {
    document.body.setAttribute('data-active-tab', activeTab);
  }, [activeTab]);

  const addProperty = () => {
    const next = { id: Date.now(), label: `Property ${properties.length + 1}` };
    setProperties(p => [...p, next]);
    setActiveIdx(properties.length);
  };

  const renameProperty = useCallback((id, newLabel) => {
    setProperties(p => p.map(prop => prop.id === id ? { ...prop, label: newLabel.trim() || prop.label } : prop));
    setEditingTabId(null);
  }, []);

  const startEditTab = (e, p, i) => {
    e.stopPropagation();
    setActiveIdx(i);
    setEditingTabId(p.id);
    setEditingLabel(p.label);
  };

  const handleSummaryUpdate = useCallback((id, data) => {
    setSummaries(prev => ({ ...prev, [id]: data }));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <header className="app-header">
        <div className="app-header-left">
          <div className="hg-logo">
            <img src="/hg-logo.png" alt="Hunter Galloway" className="hg-logo-img" />
          </div>
          <h1>Funds to Complete</h1>
        </div>
        <div className="app-header-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CopyLinkButton summaries={summaries} properties={properties} />
          <button className="header-pdf-btn" onClick={() => window.print()}>
            Save PDF →
          </button>
        </div>
      </header>

      {/* Property tabs bar */}
      <div className="property-tabs-bar">
        <div className="property-tabs">
          {activeTab === 'calculator' && properties.map((p, i) => (
            <div key={p.id} className={`prop-tab ${i === activeIdx ? 'active' : ''}`} onClick={() => setActiveIdx(i)}>
              {editingTabId === p.id ? (
                <input
                  className="prop-tab-input"
                  autoFocus
                  value={editingLabel}
                  onChange={e => setEditingLabel(e.target.value)}
                  onBlur={() => renameProperty(p.id, editingLabel)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') renameProperty(p.id, editingLabel);
                    if (e.key === 'Escape') setEditingTabId(null);
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <>
                  <span>{p.label}</span>
                  <span className="prop-tab-edit" title="Rename" onClick={e => startEditTab(e, p, i)}>✎</span>
                </>
              )}
            </div>
          ))}
          {activeTab === 'calculator' && (
            <button className="prop-tab-add" onClick={addProperty} title="Add property">+</button>
          )}
        </div>
        <button
          className={`compare-all-btn ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab(activeTab === 'summary' ? 'calculator' : 'summary')}
        >
          {activeTab === 'summary' ? '← Back' : 'Compare All →'}
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {/* All calculators stay mounted — only active one is visible — preserves inputs */}
        {properties.map((p, i) => (
          <div key={p.id} style={{ display: activeTab === 'calculator' && i === activeIdx ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
            <PropertyCalculator
              propIndex={i}
              label={p.label}
              onSummaryUpdate={(data) => handleSummaryUpdate(p.id, data)}
              initialValues={initialValues[i]}
            />
          </div>
        ))}

        {/* Summary tab */}
        {activeTab === 'summary' && (
          <div className="app-body" style={{ height: '100%', overflowY: 'auto' }}>
            <SummaryView properties={properties} summaries={summaries} />
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryView({ properties, summaries }) {
  const allCols = properties.map(p => summaries[p.id]).filter(Boolean);

  // For Copy Link we need access to properties + summaries
  const [copied, setCopied] = useState(false);
  const handleCopyLink = () => {
    const payload = properties.map((p) => {
      const s = summaries[p.id];
      if (!s) return { label: p.label };
      return { label: p.label, ...(s.inputState || {}) };
    });
    const encoded = btoa(JSON.stringify(payload));
    const url = `${window.location.origin}${window.location.pathname}?share=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (allCols.length === 0) {
    return (
      <div className="property-card" style={{ textAlign: 'center', padding: 48 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
          Enter a property value in the Calculator tab to see the summary here.
        </p>
      </div>
    );
  }

  const cols = allCols.slice(0, 4);

  const tableRows = [
    { section: 'Property Details' },
    { label: 'Property Value',      key: d => fmt(d.pv) },
    { label: 'State / Purpose',     key: d => `${d.stateCode} · ${d.purpose}` },
    { label: 'Property Type',       key: d => d.propertyType },
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
    { label: 'LVR',                 key: d => fmtPct(d.totalLvr), highlight: d => d.lmiActive },
    { label: 'Est. Monthly Repayment', key: d => `${fmt(d.repayment)}/mo` },
  ];

  return (
    <div>
      {/* ── Property Cards ── */}
      <div className="summary-header-row">
        <h2 className="summary-title">Property Comparison</h2>
        <div className="summary-header-actions">
          <button className="print-btn copy-link-btn" onClick={handleCopyLink}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button className="print-btn" onClick={() => window.print()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print / Save PDF
          </button>
        </div>
      </div>

      <div className={`summary-cards-grid summary-cards-${cols.length}`}>
        {cols.map((c, i) => (
          <div key={i} className="summary-prop-card">
            <div className="spc-label">{c.label}</div>
            <div className="spc-meta">{c.stateCode} · {c.purpose}</div>
            <div className="spc-cash">{fmt(c.contribution)}</div>
            <div className="spc-cash-label">Cash Required</div>
            <div className="spc-funds-req">Total Funds Required: {fmt(c.fundsRequired)}</div>
            <div className="spc-stats">
              <div className="spc-stat">
                <div className="spc-stat-label">Property Value</div>
                <div className="spc-stat-value">{fmt(c.pv)}</div>
              </div>
              <div className="spc-stat">
                <div className="spc-stat-label">Loan Amount</div>
                <div className="spc-stat-value">{fmt(c.totalLoan)}</div>
              </div>
              <div className="spc-stat">
                <div className="spc-stat-label">LVR</div>
                <div className={`spc-stat-value ${c.lmiActive ? 'spc-stat-warn' : ''}`}>{fmtPct(c.totalLvr)}</div>
              </div>
            </div>
            {c.lmiActive
              ? <div className="spc-lmi-badge spc-lmi-active">⚠ LMI — {fmt(c.lmi)}</div>
              : c.pv > 0 ? <div className="spc-lmi-badge spc-lmi-clear">✓ No LMI</div> : null
            }
          </div>
        ))}
      </div>

      {/* ── Detailed Comparison Table ── */}
      <div className="summary-table-card">
        <div className="summary-table-header"><h2>Detailed Comparison</h2></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="stbl">
            <thead>
              <tr>
                <th style={{ width: '30%' }}></th>
                {cols.map((c, i) => <th key={i}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, ri) => {
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

      {/* ── Summary Print Page (shown only when printing from Summary tab) ── */}
      <div className="summary-print-page">
        <div className="pp-header">
          <div className="pp-logo">
            <img src="/hg-logo.png" alt="Hunter Galloway" style={{ height: 44, width: 'auto' }} />
          </div>
          <div className="pp-header-right">
            <div className="pp-doc-title">Property Comparison</div>
            <div className="pp-doc-sub">Prepared {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
        </div>

        <div className="spp-cards-row">
          {cols.map((c, i) => (
            <div key={i} className="spp-card">
              <div className="spp-card-label">{c.label}</div>
              <div className="spp-card-meta">{c.stateCode} · {c.purpose}</div>
              <div className="spp-cash">{fmt(c.contribution)}</div>
              <div className="spp-cash-label">Cash Required</div>
              <div className="spp-funds-req">Total Funds: {fmt(c.fundsRequired)}</div>
              <div className="spp-stats">
                <div><span>Property Value</span><strong>{fmt(c.pv)}</strong></div>
                <div><span>Loan Amount</span><strong>{fmt(c.totalLoan)}</strong></div>
                <div><span>LVR</span><strong className={c.lmiActive ? 'spp-warn' : ''}>{fmtPct(c.totalLvr)}</strong></div>
              </div>
              {c.lmiActive
                ? <div className="spp-badge spp-badge-lmi">⚠ LMI — {fmt(c.lmi)}</div>
                : c.pv > 0 ? <div className="spp-badge spp-badge-ok">✓ No LMI</div> : null
              }
            </div>
          ))}
        </div>

        <table className="spp-table">
          <thead>
            <tr>
              <th></th>
              {cols.map((c, i) => <th key={i}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, ri) => {
              if (row.section) {
                return (
                  <tr key={ri} className="spp-section-row">
                    <td colSpan={cols.length + 1}>{row.section}</td>
                  </tr>
                );
              }
              return (
                <tr key={ri} className={row.bold ? 'spp-total-row' : ''}>
                  <td>{row.label}</td>
                  {cols.map((c, ci) => (
                    <td key={ci} style={row.highlight?.(c) ? { color: '#c2410c', fontWeight: 700 } : row.bold ? { color: '#F5A41F', fontWeight: 700 } : {}}>
                      {row.key(c)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="pp-footer" style={{ marginTop: 20 }}>
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
