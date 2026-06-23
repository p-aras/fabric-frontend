import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../store.js';
import { KeyRound, ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, Lock, Sun, Moon } from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cooldown, setCooldown] = useState(30);

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

  // Refs for the OTP inputs
  const inputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null)
  ];

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('twms_auth_email');
    if (!storedEmail) {
      navigate('/forgot-password');
      return;
    }
    setEmail(storedEmail);

    if (inputRefs[0].current) {
      inputRefs[0].current.focus();
    }
  }, [navigate]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleInputChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);

    if (value && index < 5 && inputRefs[index + 1].current) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0 && inputRefs[index - 1].current) {
        inputRefs[index - 1].current.focus();
      } else {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (!/^\d{6}$/.test(pastedData)) return;

    const digits = pastedData.split('');
    setOtpDigits(digits);
    
    if (inputRefs[5].current) {
      inputRefs[5].current.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await store.resetPassword(email, fullOtp, newPassword);
      setSuccess('Password reset successful! Redirecting to login...');
      
      sessionStorage.removeItem('twms_auth_email');
      
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await store.forgotPassword(email);
      setSuccess('A new password reset OTP has been sent.');
      setCooldown(30);
      setOtpDigits(['', '', '', '', '', '']);
      if (inputRefs[0].current) {
        inputRefs[0].current.focus();
      }
    } catch (err) {
      setError(err.message || 'Failed to resend OTP. Try again.');
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

      <div className="auth-card" style={{ maxWidth: 450 }}>
        <button className="auth-back-btn" onClick={() => navigate('/forgot-password')} title="Back">
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <div className="auth-logo-section" style={{ marginTop: 15 }}>
          <div className="auth-logo-icon">
            <Lock size={28} />
          </div>
          <h2>Set New Password</h2>
          <p>Reset credentials for account</p>
          <div className="auth-email-display">{email}</div>
        </div>

        {error && (
          <div className="auth-alert alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="auth-alert alert-success">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: 20 }}>
          <div className="auth-field-group">
            <label className="auth-label">Enter 6-Digit OTP Code</label>
            <div className="auth-otp-grid">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={inputRefs[index]}
                  type="text"
                  maxLength={1}
                  className="auth-otp-input"
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  disabled={loading}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                />
              ))}
            </div>
          </div>

          <div className="auth-field-group" style={{ marginTop: 10 }}>
            <label className="auth-label">New Password</label>
            <div className="auth-input-wrapper">
              <Lock size={18} className="auth-input-icon" />
              <input
                type="password"
                className="auth-input"
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <button type="submit" className="auth-btn btn-primary" style={{ marginTop: 24 }} disabled={loading || otpDigits.some(d => !d) || !newPassword}>
            {loading ? <span className="spinner"></span> : 'Reset Password'}
          </button>
        </form>

        <div className="auth-resend-section">
          <p>Didn't receive the OTP code?</p>
          <button 
            onClick={handleResend} 
            disabled={cooldown > 0 || loading} 
            className={`auth-resend-btn ${cooldown > 0 ? 'disabled' : ''}`}
          >
            {cooldown > 0 ? (
              <span>Resend in {cooldown}s</span>
            ) : (
              <>
                <RefreshCw size={13} />
                <span>Resend Code</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
