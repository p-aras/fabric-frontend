import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { store } from '../store.js';
import { User, Mail, Lock, ArrowRight, Warehouse, Briefcase, Sun, Moon, AlertCircle } from 'lucide-react';

export default function RegisterPage({ setUser }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Store Operator',
    department: 'Warehouse'
  });
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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, password } = formData;
    if (!name || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await store.register({
        name: name.trim(),
        email: email.trim(),
        password,
        role: formData.role,
        department: formData.department
      });

      if (res.token && res.user) {
        localStorage.setItem('twms_token', res.token);
        localStorage.setItem('twms_user', JSON.stringify(res.user));
        setUser(res.user);
        navigate('/materials');
      } else {
        setError('Registration successful, but login session was not returned.');
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Try again.');
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

      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-logo-section">
          <div className="auth-logo-icon">
            <Warehouse size={28} />
          </div>
          <h2>Textile Warehouse</h2>
          <p>Management System</p>
        </div>

        <div className="auth-header-text">
          <h3>Create Account</h3>
          <p>Register as a team member to request system credentials</p>
        </div>

        {error && (
          <div className="auth-alert alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field-group">
            <label className="auth-label">Full Name</label>
            <div className="auth-input-wrapper">
              <User size={18} className="auth-input-icon" />
              <input
                type="text"
                name="name"
                className="auth-input"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="auth-field-group">
            <label className="auth-label">Email Address</label>
            <div className="auth-input-wrapper">
              <Mail size={18} className="auth-input-icon" />
              <input
                type="email"
                name="email"
                className="auth-input"
                placeholder="johndoe@textile.com"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="auth-field-group">
            <label className="auth-label">Password</label>
            <div className="auth-input-wrapper">
              <Lock size={18} className="auth-input-icon" />
              <input
                type="password"
                name="password"
                className="auth-input"
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-grid form-grid-2" style={{ gap: 12, margin: 0, padding: 0 }}>
            <div className="auth-field-group">
              <label className="auth-label">Role</label>
              <div className="auth-input-wrapper">
                <Briefcase size={16} className="auth-input-icon" />
                <select
                  name="role"
                  className="auth-input"
                  style={{ paddingLeft: 38 }}
                  value={formData.role}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="Store Operator">Store Operator</option>
                  <option value="Store Manager">Store Manager</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="auth-field-group">
              <label className="auth-label">Department</label>
              <div className="auth-input-wrapper">
                <Briefcase size={16} className="auth-input-icon" />
                <select
                  name="department"
                  className="auth-input"
                  style={{ paddingLeft: 38 }}
                  value={formData.department}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="Warehouse">Warehouse</option>
                  <option value="Management">Management</option>
                  <option value="Production">Production</option>
                  <option value="Cutting">Cutting</option>
                  <option value="Sewing">Sewing</option>
                  <option value="Quality Control">Quality Control</option>
                </select>
              </div>
            </div>
          </div>

          <button type="submit" className="auth-btn btn-primary" disabled={loading} style={{ marginTop: 10 }}>
            {loading ? (
              <span className="spinner"></span>
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer-link">
          Already have an account? <Link to="/login">Login here</Link>
        </div>
      </div>
    </div>
  );
}

