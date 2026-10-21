// One form for both login and register; `mode` decides which.
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { token, login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (token) return <Navigate to="/tax" replace />;

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const body = isRegister ? form : { email: form.email, password: form.password };
      const data = await api(`/auth/${mode}`, { method: 'POST', body });
      login(data.token, data.user);
      navigate('/tax');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card auth-card">
      <h1>{isRegister ? 'Create an account' : 'Log in'}</h1>
      <form onSubmit={handleSubmit}>
        {isRegister && (
          <label>
            Name
            <input name="name" value={form.name} onChange={handleChange} required maxLength={100} />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={handleChange} required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
            minLength={isRegister ? 8 : undefined}
            maxLength={72}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Please wait…' : isRegister ? 'Sign up' : 'Log in'}
        </button>
      </form>
      <p className="muted">
        {isRegister ? 'Already have an account? ' : 'New here? '}
        <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Log in' : 'Create an account'}</Link>
      </p>
    </div>
  );
}
