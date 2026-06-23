import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../store.js';
import { KeyRound, ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, Sun, Moon } from 'lucide-react';

export default function VerifyOtpPage({ setUser }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [authType, setAuthType] = useState('login');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
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
    const storedType = sessionStorage.getItem('twms_auth_type') || 'login';

    if (!storedEmail) {
      navigate('/login');
      return;
    }

    setEmail(storedEmail);
    setAuthType(storedType);

    // Input autofocus first element
    if (inputRefs[0].current) {
      inputRefs[0].current.focus();
    }
  }, [navigate]);

  // Cooldown timer for resending OTP
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleInputChange = (index, value) => {
    // Only accept numeric digits
    if (value && !/^\d$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);

    // Auto-focus next input if filled
    if (value && index < 5 && inputRefs[index + 1].current) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Shift focus on backspace
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
    if (!/^\d{6}$/.test(pastedData)) return; // Reject non-6-digit codes

    const digits = pastedData.split('');
    setOtpDigits(digits);
    
    // Focus last input
    if (inputRefs[5].current) {
      inputRefs[5].current.focus();
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      setError('Please enter the complete 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let res;
      if (authType === 'register') {
        res = await store.verifyRegisterOtp(email, fullOtp);
      } else {
        res = await store.verifyLoginOtp(email, fullOtp);
      }

      setSuccess('OTP verified successfully! Logging you in...');
      
      // Store JWT token and User session
      localStorage.setItem('twms_token', res.token);
      localStorage.setItem('twms_user', JSON.stringify(res.user));

      // Clear session auth states
      sessionStorage.removeItem('twms_auth_email');
      sessionStorage.removeItem('twms_auth_type');
      sessionStorage.removeItem('twms_dev_otp');

      setTimeout(() => {
        setUser(res.user);
        navigate('/materials');
      }, 1200);

    } catch (err) {
      setError(err.message || 'Verification failed. Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when 6 digits are typed
  useEffect(() => {
    if (otpDigits.every(digit => digit !== '')) {
      handleSubmit();
    }
  }, [otpDigits]);

  const handleResend = async () => {
    if (cooldown > 0) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await store.resendOtp(email, authType);
      
      setSuccess('A new OTP has been sent to your email.');
      setCooldown(30);
      setOtpDigits(['', '', '', '', '', '']);
      if (inputRefs[0].current) {
        inputRefs[0].current.focus();
      }
    } catch (err) {
      setError(err.message || 'Failed to resend OTP. Please try again.');
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
        <button className="auth-back-btn" onClick={() => navigate('/login')} title="Back to Login">
          <ArrowLeft size={16} />
          <span>Back to login</span>
        </button>

        <div className="auth-logo-section" style={{ marginTop: 15 }}>
          <div className="auth-logo-icon">
            <KeyRound size={28} />
          </div>
          <h2>Verify Security Code</h2>
          <p>We've sent a 6-digit OTP code to</p>
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

        <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: 24 }}>
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

          <button type="submit" className="auth-btn btn-primary" style={{ marginTop: 30 }} disabled={loading || otpDigits.some(d => !d)}>
            {loading ? <span className="spinner"></span> : 'Verify Code'}
          </button>
        </form>

        <div className="auth-resend-section">
          <p>Didn't receive the email code?</p>
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

