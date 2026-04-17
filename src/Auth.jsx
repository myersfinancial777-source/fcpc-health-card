import { useState } from 'react';
import { supabase } from './supabase.js';
import logoUrl from '/logo.png?url';

var NAVY = '#0B2545';
var TEAL = '#1B8A8C';
var TEAL_MED = '#A8DCD9';
var DARK_GRAY = '#333333';
var MED_GRAY = '#666666';
var LIGHT_GRAY = '#F0F4F5';
var BORDER_GRAY = '#D0D8DA';
var F = { fontFamily: "'DM Sans', sans-serif" };

export function AuthScreen() {
  var [mode, setMode] = useState('login');
  var [email, setEmail] = useState('');
  var [password, setPassword] = useState('');
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState('');
  var [success, setSuccess] = useState('');

  async function handleSubmit() {
    if (!email || !password) { setError('Enter email and password.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'login') {
        var result = await supabase.auth.signInWithPassword({ email: email, password: password });
        if (result.error) throw result.error;
      } else {
        var result2 = await supabase.auth.signUp({ email: email, password: password });
        if (result2.error) throw result2.error;
        if (result2.data.user && !result2.data.session) {
          setSuccess('Account created! Check your email to confirm, then log in.');
          setMode('login');
          setPassword('');
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
    }
    setLoading(false);
  }

  async function handleReset() {
    if (!email) { setError('Enter your email first.'); return; }
    setLoading(true);
    setError('');
    try {
      var result = await supabase.auth.resetPasswordForEmail(email);
      if (result.error) throw result.error;
      setSuccess('Password reset email sent. Check your inbox.');
    } catch (err) {
      setError(err.message || 'Could not send reset email.');
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, ' + NAVY + ', #153060)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, ...F }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src={logoUrl} alt="Logo" style={{ height: 64, borderRadius: 8, marginBottom: 12 }} />
          <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', fontFamily: "'Playfair Display', serif" }}>First Coast</div>
          <div style={{ fontSize: 12, color: TEAL_MED, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase' }}>Property Care</div>
          <div style={{ fontSize: 10, color: TEAL_MED, fontStyle: 'italic', marginTop: 6, opacity: 0.8 }}>"We Handle the Small Things Before They Become Big Problems."</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </div>
          <div style={{ fontSize: 12, color: MED_GRAY, marginBottom: 20 }}>
            {mode === 'login' ? 'Sign in to your account' : 'Sign up to view your property inspections'}
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#DC2626', fontWeight: 600, marginBottom: 14 }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#22C55E', fontWeight: 600, marginBottom: 14 }}>
              {success}
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={function(e) { setEmail(e.target.value); setError(''); }}
              placeholder="you@email.com"
              style={S.input}
            />
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={function(e) { setPassword(e.target.value); setError(''); }}
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
              onKeyDown={function(e) { if (e.key === 'Enter') handleSubmit(); }}
              style={S.input}
            />
          </div>

          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginBottom: 16 }}>
              <button onClick={handleReset} style={{ background: 'none', border: 'none', color: TEAL, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, ...F }}>
                Forgot password?
              </button>
            </div>
          )}

          {mode === 'signup' && <div style={{ height: 12 }} />}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? MED_GRAY : 'linear-gradient(135deg, ' + TEAL + ', #1a9e8e)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: 14,
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              ...F,
              boxShadow: '0 4px 14px ' + TEAL + '44',
              marginBottom: 16,
            }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <div style={{ textAlign: 'center', fontSize: 13, color: MED_GRAY }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={function() { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setSuccess(''); }}
              style={{ background: 'none', border: 'none', color: TEAL, fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 13, ...F }}
            >
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          First Coast Property Care LLC
        </div>
      </div>
    </div>
  );
}

var S = {
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1.5px solid ' + BORDER_GRAY,
    fontSize: 14,
    color: DARK_GRAY,
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    boxSizing: 'border-box',
    background: LIGHT_GRAY,
  },
};