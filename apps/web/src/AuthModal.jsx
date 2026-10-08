import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound, X } from 'lucide-react';
import { api } from './api.js';

export default function AuthModal({ onClose, onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', workspaceName: '' });

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const result = await api(endpoint, { method: 'POST', body: mode === 'login' ? { email: form.email, password: form.password } : form });
      onAuthenticated(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
    <button type="button" className="icon-button auth-close" aria-label="Close sign in" onClick={onClose}><X size={18}/></button>
    <div className="auth-logo"><span className="brand-mark"><span/><span/><span/><span/></span></div>
    <span className="modal-kicker">YOUR TEAM, IN FLOW</span>
    <h2 id="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your workspace'}</h2>
    <p className="auth-subtitle">{mode === 'login' ? 'Sign in to pick up where your team left off.' : 'Set up your account and bring your team together.'}</p>
    <form onSubmit={submit}>
      {mode === 'register' && <><label className="form-label">Your name<span className="input-with-icon"><UserRound size={15}/><input autoComplete="name" required minLength={2} maxLength={80} placeholder="Rachit Tripathi" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></span></label><label className="form-label">Workspace name<input required minLength={2} maxLength={80} placeholder="Acme Studio" value={form.workspaceName} onChange={(event) => setForm({ ...form, workspaceName: event.target.value })}/></label></>}
      <label className="form-label">Work email<span className="input-with-icon"><Mail size={15}/><input autoComplete="email" required type="email" placeholder="you@company.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></span></label>
      <label className="form-label">Password<span className="input-with-icon"><LockKeyhole size={15}/><input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? 1 : 10} maxLength={72} type={showPassword ? 'text' : 'password'} placeholder={mode === 'login' ? 'Your password' : 'At least 10 characters'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })}/><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}</button></span></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="button button-primary auth-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}{!busy && <ArrowRight size={15}/>}</button>
    </form>
    <div className="auth-switch">{mode === 'login' ? 'New to TaskFlow Pro?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></div>
  </section></div>;
}
