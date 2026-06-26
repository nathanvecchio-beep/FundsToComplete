import Toggle from './Toggle';

export function CurrencyField({ label, value, onChange, autoCalc, overrideActive, onToggleOverride, disabled, className }) {
  const fmt = (v) => v === '' || v === null || v === undefined ? '' : String(v);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    onChange(raw === '' ? '' : Number(raw));
  };

  const display = overrideActive || !autoCalc
    ? (value === 0 || value === '' ? '' : String(value))
    : value === 0 ? '$0' : value ? `$${Math.round(Number(value)).toLocaleString()}` : '$0';

  return (
    <div className={`field ${autoCalc ? 'has-toggle' : ''} ${className || ''}`}>
      <label>{label}</label>
      <input
        type={overrideActive || !autoCalc ? 'number' : 'text'}
        value={overrideActive || !autoCalc ? fmt(value) : display}
        onChange={handleChange}
        disabled={autoCalc && !overrideActive}
        placeholder={autoCalc && !overrideActive ? display : '$0'}
        className={overrideActive ? 'active-input' : ''}
      />
      {autoCalc && (
        <div className="field-right">
          {!overrideActive && <span className="autocalc-badge">AUTOCALCULATED</span>}
          <Toggle checked={overrideActive} onChange={onToggleOverride} />
        </div>
      )}
    </div>
  );
}

export function PercentField({ label, value }) {
  return (
    <div className="field has-toggle">
      <label>{label}</label>
      <input type="text" value={value != null ? `${value}%` : '0%'} readOnly />
      <div className="field-right">
        <span className="autocalc-badge">AUTOCALCULATED</span>
        <Toggle checked={false} onChange={() => {}} />
      </div>
    </div>
  );
}

export function SelectField({ label, value, onChange, options }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
      </select>
      <span className="select-arrow">▼</span>
    </div>
  );
}

export function NumberInput({ label, value, onChange, min, max, step = 1, suffix }) {
  return (
    <div className="rep-field">
      <label>{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}
