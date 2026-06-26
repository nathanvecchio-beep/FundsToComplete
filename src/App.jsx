import { useState } from 'react';
import PropertyCalculator from './components/PropertyCalculator';

// Hunter Galloway house-with-arch logo mark as inline SVG
function HGLogoMark({ size = 36, darkBg = true }) {
  const fill = darkBg ? '#F5A41F' : '#1a1a1a';
  return (
    <svg className="hg-logo-mark" width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* House body */}
      <rect x="10" y="45" width="80" height="50" rx="3" fill={fill} />
      {/* Roof triangle */}
      <polygon points="50,5 95,48 5,48" fill={fill} />
      {/* Arch cutout (door) */}
      <path d="M35 95 L35 68 Q35 55 50 55 Q65 55 65 68 L65 95 Z" fill={darkBg ? '#1a1a1a' : 'white'} />
    </svg>
  );
}

export default function App() {
  const [properties, setProperties] = useState([{ id: 1, label: 'Property 1' }]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeTab, setActiveTab] = useState('calculator');

  const addProperty = () => {
    const next = { id: Date.now(), label: `Property ${properties.length + 1}` };
    setProperties(p => [...p, next]);
    setActiveIdx(properties.length);
  };

  return (
    <div>
      <header className="app-header">
        <div className="app-header-left">
          <div className="hg-logo">
            <HGLogoMark size={36} darkBg={true} />
            <div className="hg-logo-text">
              <span className="hg-logo-eyebrow">Mortgage Broker Brisbane</span>
              <span className="hg-logo-name">Hunter <span>Galloway</span></span>
            </div>
          </div>
          <h1>Funds to Complete</h1>
        </div>
        <div className="app-header-right">huntergalloway.com.au</div>
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

        {/* Render all calculators — only show active one. Never unmount so inputs are preserved. */}
        {properties.map((p, i) => (
          <div key={p.id} style={{ display: activeTab === 'calculator' && i === activeIdx ? 'block' : 'none' }}>
            <PropertyCalculator propIndex={i} label={p.label} />
          </div>
        ))}

        {activeTab === 'summary' && (
          <div className="property-card" style={{ textAlign: 'center', padding: 48 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
              Add properties in the Calculator tab — their combined summary will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
