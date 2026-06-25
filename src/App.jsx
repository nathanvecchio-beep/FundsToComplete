import { useState } from 'react';
import PropertyCalculator from './components/PropertyCalculator';

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
        <span style={{ fontSize: '1.4rem' }}>🏠</span>
        <h1>Property Deposit Calculator — Funds to Complete</h1>
      </header>

      <div className="app-body">
        <div className="tabs">
          <button className={`tab-btn ${activeTab === 'calculator' ? 'active' : ''}`} onClick={() => setActiveTab('calculator')}>Calculator</button>
          <button className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>Summary</button>
        </div>

        {activeTab === 'calculator' && (
          <>
            <div className="property-tabs">
              {properties.map((p, i) => (
                <button key={p.id} className={`prop-tab ${i === activeIdx ? 'active' : ''}`} onClick={() => setActiveIdx(i)}>
                  {p.label}
                </button>
              ))}
              <button className="prop-tab-add" onClick={addProperty} title="Add property">+</button>
              <button className="prop-tab-link" title="Link properties">🔗</button>
            </div>
            <PropertyCalculator key={properties[activeIdx]?.id} propIndex={activeIdx} />
          </>
        )}

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
