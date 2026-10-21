// Add / edit / delete expenses for a month, with a category chart.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { currentMonth, formatDate, formatINR, formatMonth, todayISO } from '../format.js';
import CategoryChart from '../components/CategoryChart.jsx';

// New expenses default to today if you're looking at this month,
// otherwise to the 1st of the month you're looking at.
function defaultDate(month) {
  return month === currentMonth() ? todayISO() : `${month}-01`;
}

function emptyForm(month) {
  return { amount: '', category: 'Food', date: defaultDate(month), note: '' };
}

// Fetch the list and the summary for a month in parallel.
async function fetchMonth(month) {
  const [list, summary] = await Promise.all([
    api(`/expenses?month=${month}`),
    api(`/expenses/summary?month=${month}`),
  ]);
  return { expenses: list.expenses, summary };
}

export default function ExpensesPage() {
  const [month, setMonth] = useState(currentMonth());
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(emptyForm(month));
  const [editingId, setEditingId] = useState(null); // null = adding a new expense
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/expenses/categories')
      .then((data) => setCategories(data.categories))
      .catch((err) => setError(err.message));
  }, []);

  // Reload whenever the month changes.
  useEffect(() => {
    let cancelled = false; // ignore late responses if the month changes again
    setError('');
    setEditingId(null);
    setForm(emptyForm(month));
    fetchMonth(month)
      .then((data) => {
        if (cancelled) return;
        setExpenses(data.expenses);
        setSummary(data.summary);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [month]);

  async function refresh() {
    const data = await fetchMonth(month);
    setExpenses(data.expenses);
    setSummary(data.summary);
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function startEdit(expense) {
    setEditingId(expense.id);
    setForm({
      amount: String(expense.amount),
      category: expense.category,
      date: expense.date,
      note: expense.note || '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm(month));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = { ...form, amount: Number(form.amount) };
      if (editingId) {
        await api(`/expenses/${editingId}`, { method: 'PUT', body });
      } else {
        await api('/expenses', { method: 'POST', body });
      }
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(expense) {
    if (!window.confirm(`Delete ${formatINR(expense.amount)} (${expense.category}) on ${formatDate(expense.date)}?`)) {
      return;
    }
    setError('');
    try {
      await api(`/expenses/${expense.id}`, { method: 'DELETE' });
      if (editingId === expense.id) cancelEdit();
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Expenses</h1>
        <label className="inline">
          Month
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </label>
      </div>

      <div className="expense-grid">
        <form className="card" onSubmit={handleSubmit}>
          <h2>{editingId ? 'Edit expense' : 'Add expense'}</h2>
          <label>
            Amount (₹)
            <input type="number" name="amount" min="0.01" step="0.01" value={form.amount} onChange={handleChange} required />
          </label>
          <label>
            Category
            <select name="category" value={form.category} onChange={handleChange}>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" name="date" value={form.date} onChange={handleChange} required />
          </label>
          <label>
            Note <span className="muted">(optional)</span>
            <input name="note" value={form.note} onChange={handleChange} maxLength={255} />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="button-row">
            <button type="submit" disabled={saving}>{editingId ? 'Save changes' : 'Add expense'}</button>
            {editingId && <button type="button" className="secondary" onClick={cancelEdit}>Cancel</button>}
          </div>
        </form>

        <section className="card">
          <h2>
            {formatMonth(month)}
            {summary && <span className="muted">{formatINR(summary.total)} spent</span>}
          </h2>
          {summary && <CategoryChart summary={summary} />}
        </section>
      </div>

      <section className="card">
        <h2>All expenses in {formatMonth(month)}</h2>
        {expenses.length === 0 ? (
          <p className="muted">Nothing logged for this month.</p>
        ) : (
          <div className="table-scroll">
            <table className="expense-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Note</th>
                  <th>Amount</th>
                  <th><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className={expense.id === editingId ? 'editing' : ''}>
                    <td>{formatDate(expense.date)}</td>
                    <td>{expense.category}</td>
                    <td>{expense.note}</td>
                    <td>{formatINR(expense.amount)}</td>
                    <td className="actions">
                      <button type="button" className="link-button" onClick={() => startEdit(expense)}>Edit</button>
                      <button type="button" className="link-button danger" onClick={() => handleDelete(expense)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
