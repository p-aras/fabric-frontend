import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { store } from '../store.js';
import { Mail, Lock, ArrowRight, Warehouse, Sun, Moon, AlertCircle } from 'lucide-react';

export default function LoginPage({ setUser }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('twms_dark') === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('twms_dark', darkMode);
  }, [darkMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await store.login(email.trim(), password);
      
      if (res.token && res.user) {
        // Save session locally and redirect
        localStorage.setItem('twms_token', res.token);
        localStorage.setItem('twms_user', JSON.stringify(res.user));
        setUser(res.user);
        navigate('/materials');
      }
    } catch (err) {
      setError(err.message || 'Failed to login. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`auth-container ${darkMode ? 'dark' : ''}`}>
      {/* Theme Toggle Button */}
      <button 
        type="button"
        onClick={() => setDarkMode(!darkMode)} 
        className="auth-theme-toggle" 
        title="Toggle Theme"
      >
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Background Animated Blobs */}
      <div className="auth-blob blob-1"></div>
      <div className="auth-blob blob-2"></div>
      <div className="auth-blob blob-3"></div>

      <div className="auth-card">
        <div className="auth-logo-section">
          <div className="auth-logo-icon">
            <Warehouse size={28} />
          </div>
          <h2>Textile Warehouse</h2>
          <p>Management System</p>
        </div>

        <div className="auth-header-text">
          <h3>Welcome Back</h3>
          <p>Sign in to manage warehouse assets and movements</p>
        </div>

        {error && (
          <div className="auth-alert alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field-group">
            <label className="auth-label">Email Address</label>
            <div className="auth-input-wrapper">
              <Mail size={18} className="auth-input-icon" />
              <input
                type="email"
                className="auth-input"
                placeholder="operator@textile.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="auth-field-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="auth-label">Password</label>
              <Link to="/forgot-password" style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }} className="auth-forgot-link">Forgot Password?</Link>
            </div>
            <div className="auth-input-wrapper">
              <Lock size={18} className="auth-input-icon" />
              <input
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <button type="submit" className="auth-btn btn-primary" disabled={loading}>
            {loading ? (
              <span className="spinner"></span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer-link">
          Don't have an account? <Link to="/register">Register here</Link>
        </div>
      </div>
    </div>
  );
}

