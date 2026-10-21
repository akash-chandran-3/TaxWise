// Income form -> save profile -> show Old vs New comparison.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatINR } from '../format.js';
import Disclaimer from '../components/Disclaimer.jsx';
import RegimeCard from '../components/RegimeCard.jsx';

// Form inputs hold strings (what the user typed); we convert to numbers on submit.
const EMPTY_FORM = {
  grossSalary: '',
  otherIncome: '',
  basicSalary: '',
  hraReceived: '',
  rentPaid: '',
  isMetro: false,
  deduction80C: '',
  deduction80D: '',
};

function profileToForm(p) {
  const text = (n) => (n ? String(n) : ''); // show 0 as an empty box
  return {
    grossSalary: text(p.grossSalary),
    otherIncome: text(p.otherIncome),
    basicSalary: text(p.basicSalary),
    hraReceived: text(p.hraReceived),
    rentPaid: text(p.rentPaid),
    isMetro: p.isMetro,
    deduction80C: text(p.deductions['80C']),
    deduction80D: text(p.deductions['80D']),
  };
}

function formToProfile(f) {
  const num = (s) => Number(s || 0);
  return {
    grossSalary: num(f.grossSalary),
    otherIncome: num(f.otherIncome),
    basicSalary: num(f.basicSalary),
    hraReceived: num(f.hraReceived),
    rentPaid: num(f.rentPaid),
    isMetro: f.isMetro,
    deductions: { '80C': num(f.deduction80C), '80D': num(f.deduction80D) },
  };
}

function AmountInput({ label, name, value, onChange, hint }) {
  return (
    <label>
      {label}
      <input type="number" min="0" step="1" name={name} value={value} onChange={onChange} placeholder="0" />
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

function Recommendation({ comparison }) {
  if (comparison.recommended === 'either') {
    return <p className="banner">Both regimes cost the same for you.</p>;
  }
  const regimeName = comparison.recommended === 'new' ? 'New Regime' : 'Old Regime';
  return (
    <p className="banner">
      You save <strong>{formatINR(comparison.savings)}</strong> with the {regimeName}.
    </p>
  );
}

export default function TaxPage() {
  const [years, setYears] = useState([]);
  const [fy, setFy] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // 1. Load the list of supported years once; pick the latest.
  useEffect(() => {
    api('/tax/years')
      .then((data) => {
        setYears(data.years);
        setFy(data.years[0] || '');
      })
      .catch((err) => setError(err.message));
  }, []);

  // 2. Whenever the year changes, load that year's saved profile (if any) and its comparison.
  useEffect(() => {
    if (!fy) return;
    let cancelled = false; // ignore late responses if the user switches year again
    setError('');
    setComparison(null);

    api(`/profile/${fy}`)
      .then(async (data) => {
        if (cancelled) return;
        setForm(profileToForm(data.profile));
        const result = await api(`/tax/compare/${fy}`);
        if (!cancelled) setComparison(result);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 404) setForm(EMPTY_FORM); // nothing saved yet for this year
        else setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [fy]);

  function handleChange(e) {
    const { name, type, checked, value } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api(`/profile/${fy}`, { method: 'PUT', body: formToProfile(form) });
      setComparison(await api(`/tax/compare/${fy}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Old vs New Regime</h1>
        <label className="inline">
          Financial year
          <select value={fy} onChange={(e) => setFy(e.target.value)}>
            {years.map((y) => (
              <option key={y} value={y}>FY {y}</option>
            ))}
          </select>
        </label>
      </div>

      <Disclaimer />

      <form className="card tax-form" onSubmit={handleSubmit}>
        <fieldset>
          <legend>Income (yearly)</legend>
          <AmountInput label="Gross salary" name="grossSalary" value={form.grossSalary} onChange={handleChange} />
          <AmountInput label="Other income" name="otherIncome" value={form.otherIncome} onChange={handleChange}
            hint="Interest, rent received, etc." />
        </fieldset>

        <fieldset>
          <legend>HRA <span className="muted">(Old Regime only)</span></legend>
          <AmountInput label="Basic salary" name="basicSalary" value={form.basicSalary} onChange={handleChange} />
          <AmountInput label="HRA received" name="hraReceived" value={form.hraReceived} onChange={handleChange} />
          <AmountInput label="Rent paid" name="rentPaid" value={form.rentPaid} onChange={handleChange} />
          <label className="checkbox">
            <input type="checkbox" name="isMetro" checked={form.isMetro} onChange={handleChange} />
            I live in a metro city
          </label>
        </fieldset>

        <fieldset>
          <legend>Deductions <span className="muted">(Old Regime only)</span></legend>
          <AmountInput label="Section 80C" name="deduction80C" value={form.deduction80C} onChange={handleChange}
            hint="PPF, ELSS, EPF, life insurance… (capped)" />
          <AmountInput label="Section 80D" name="deduction80D" value={form.deduction80D} onChange={handleChange}
            hint="Health insurance premium (capped)" />
        </fieldset>

        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={saving || !fy}>{saving ? 'Calculating…' : 'Calculate tax'}</button>
      </form>

      {comparison && (
        <>
          <Recommendation comparison={comparison} />
          <div className="regime-grid">
            <RegimeCard title="Old Regime" result={comparison.old} isRecommended={comparison.recommended === 'old'} />
            <RegimeCard title="New Regime" result={comparison.new} isRecommended={comparison.recommended === 'new'} />
          </div>
        </>
      )}
    </>
  );
}
