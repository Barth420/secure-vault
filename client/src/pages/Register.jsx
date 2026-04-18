import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate     = useNavigate();
  const [form, setForm]     = useState({ email: '', password: '', confirm: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    if (form.password.length < 8)       return setError('Password must be at least 8 characters.');
    setLoading(true);
    try {
      await register(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const strength = (() => {
    const p = form.password;
    if (!p)        return null;
    if (p.length < 8)  return { label: 'Too short',  color: 'bg-danger',  w: 'w-1/4' };
    if (p.length < 12) return { label: 'Weak',        color: 'bg-warning', w: 'w-2/4' };
    if (!/[^a-zA-Z0-9]/.test(p)) return { label: 'Medium', color: 'bg-warning', w: 'w-3/4' };
    return { label: 'Strong', color: 'bg-success', w: 'w-full' };
  })();

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 mb-4">
            <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">SecureVault</h1>
          <p className="text-muted text-sm mt-1">Create your encrypted vault</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-2">Create your account</h2>

          <div className="bg-warning/5 border border-warning/20 rounded-lg p-3 mb-6">
            <p className="text-xs text-slate-400 leading-relaxed">
              <strong className="text-warning">⚠ Important:</strong> Your password generates your encryption key. If you forget it, <strong className="text-slate-200">your files cannot be recovered</strong>. There is no password reset.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input type="email" className="input" placeholder="you@example.com"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required autoComplete="email" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <input type="password" className="input" placeholder="Minimum 8 characters"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required autoComplete="new-password" />
              {strength && (
                <div className="mt-2">
                  <div className="w-full bg-panel rounded-full h-1">
                    <div className={`${strength.color} ${strength.w} h-1 rounded-full transition-all duration-300`} />
                  </div>
                  <p className="text-xs text-muted mt-1">{strength.label}</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm password</label>
              <input type="password" className="input" placeholder="Repeat your password"
                value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                required autoComplete="new-password" />
            </div>

            {error && (
              <div className="bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-sm text-danger">{error}</div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Creating vault…
                </span>
              ) : 'Create Vault'}
            </button>
          </form>

          <p className="text-center text-sm text-muted mt-5">
            Already have a vault?{' '}
            <Link to="/login" className="text-accent hover:text-accent-hover transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
