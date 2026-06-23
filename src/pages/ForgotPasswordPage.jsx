import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { store } from '../store.js';
import { Mail, ArrowRight, Warehouse, Sun, Moon, AlertCircle, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await store.forgotPassword(email.trim());
      setSuccess('Verification code sent! Redirecting to reset page...');
      
      sessionStorage.setItem('twms_auth_email', email.trim());
      
      setTimeout(() => {
        navigate('/reset-password');
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to request password reset. Check your email address.');
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

      <div className="auth-card" style={{ maxWidth: 440 }}>
        <button className="auth-back-btn" onClick={() => navigate('/login')} title="Back to Login">
          <ArrowLeft size={16} />
          <span>Back to login</span>
        </button>

        <div className="auth-logo-section" style={{ marginTop: 15 }}>
          <div className="auth-logo-icon">
            <Warehouse size={28} />
          </div>
          <h2>Reset Password</h2>
          <p>Textile Warehouse Management</p>
        </div>

        <div className="auth-header-text">
          <h3>Forgot Password?</h3>
          <p>Enter your email to receive a 6-digit OTP verification code</p>
        </div>

        {error && (
          <div className="auth-alert alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="auth-alert alert-success">
            <AlertCircle size={16} style={{ transform: 'rotate(180deg)' }} />
            <span>{success}</span>
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

          <button type="submit" className="auth-btn btn-primary" disabled={loading} style={{ marginTop: 10 }}>
            {loading ? (
              <span className="spinner"></span>
            ) : (
              <>
                <span>Send Reset OTP</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer-link">
          Remember password? <Link to="/login">Login here</Link>
        </div>
      </div>
    </div>
  );
}
