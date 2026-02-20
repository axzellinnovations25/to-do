import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, UserPlus } from 'lucide-react';

export const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-container">
      <h2 className="setup-title">Collaborative To-Do</h2>
      <p className="setup-subtitle">{isLogin ? 'Log in' : 'Create an account'} to sync tasks</p>
      
      <form onSubmit={handleAuth} className="setup-form">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label className="input-label">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-input"
            required
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          <label className="input-label">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="text-input"
            required
            minLength={6}
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="action-row" style={{ marginTop: '16px' }}>
          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-primary"
          >
            {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
            {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
          </button>
        </div>

        <div className="divider">
          <span>or switch to</span>
        </div>

        <button 
          type="button" 
          onClick={() => setIsLogin(!isLogin)} 
          className="btn btn-secondary"
          style={{ width: '100%' }}
        >
          {isLogin ? 'Create an account instead' : 'Log in to existing account'}
        </button>
      </form>
    </div>
  );
};
