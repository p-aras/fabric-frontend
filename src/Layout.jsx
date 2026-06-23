import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { store } from './store.js';
import {
  Package, Warehouse, PackagePlus, PackageMinus,
  ArrowLeftRight, BarChart3, Settings, ChevronDown,
  Search, Bell, Sun, Moon, Menu, LogOut, ChevronRight,
  Printer, Sparkles, Droplets, Grid, History, AlertCircle
} from 'lucide-react';

const NAV = [
  { path: '/materials', icon: Package, label: 'Material Master' },
  { path: '/fabric-sticker', icon: Printer, label: 'Material Add' },
  { path: '/dyeing-material', icon: Droplets, label: 'Dyeing Material' },
  { path: '/recommendation', icon: Sparkles, label: 'Storage Recommendation' },
  { path: '/warehouse', icon: Warehouse, label: 'Warehouse' },
  { path: '/grn', icon: PackagePlus, label: 'Material Receive (GRN)' },
  { path: '/issue', icon: PackageMinus, label: 'Material Issue' },
  { path: '/transfer', icon: ArrowLeftRight, label: 'Material Transfer' },
  { path: '/parta', icon: Grid, label: 'Job Order Matrix (Parta)' },
  { path: '/fabric-receiving-history', icon: History, label: 'Fabric Returns Log' },
  { path: '/parta-pending', icon: AlertCircle, label: 'Pending info in Parta' },
  { path: '/reports', icon: BarChart3, label: 'Reports' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout({ children, darkMode, toggleDark, currentUser, handleLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState({});
  const [search, setSearch] = useState('');
  const [showNotifs, setShowNotifs] = useState(false);
  const [stats, setStats] = useState({ rooms: 0, racks: 0, capacity: 0 });
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [materials, setMaterials] = useState([]);

  const loadPendingData = async () => {
    try {
      const [transfersData, matsData] = await Promise.all([
        store.getTransfers(),
        store.getMaterials()
      ]);
      setPendingTransfers((transfersData || []).filter(t => t.status === 'Pending'));
      setMaterials(matsData || []);
    } catch (e) {
      console.error('Error loading pending data:', e);
    }
  };

  useEffect(() => {
    loadPendingData();
    const interval = setInterval(loadPendingData, 10000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  const handleApprove = async (id) => {
    try {
      await store.approveTransfer(id);
      loadPendingData();
    } catch (e) {
      alert(e.message || 'Error approving transfer');
    }
  };

  const handleReject = async (id) => {
    try {
      await store.rejectTransfer(id);
      loadPendingData();
    } catch (e) {
      alert(e.message || 'Error rejecting transfer');
    }
  };

  const getMaterialName = (id) => {
    return materials.find(m => m.id === id)?.name || '—';
  };

  const filteredNav = NAV.filter(item => {
    if (item.path === '/parta-pending') {
      return currentUser?.role !== 'Admin';
    }
    if (item.path === '/reports' || item.path === '/settings') {
      return currentUser?.role === 'Admin';
    }
    return true;
  });

  useEffect(() => {
    let active = true;
    const loadStats = async () => {
      try {
        const [loadedRooms, loadedRacks, shelves] = await Promise.all([
          store.getRooms(),
          store.getRacks(),
          store.getShelves()
        ]);
        if (!active) return;
        const capacity = (shelves || []).reduce((sum, s) => sum + (s.capacity || 0), 0);
        setStats({
          rooms: (loadedRooms || []).length,
          racks: (loadedRacks || []).length,
          capacity
        });
      } catch (e) {
        console.error(e);
      }
    };
    loadStats();
    return () => { active = false; };
  }, [location.pathname]);

  const toggleMenu = (label) => setOpenMenus(o => ({ ...o, [label]: !o[label] }));

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className={`app-layout ${darkMode ? 'dark' : ''}`}>
      {/* SIDEBAR */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">TW</div>
          {!collapsed && (
            <div className="logo-text">
              <div className="logo-title">Textile Warehouse</div>
              <div className="logo-sub">Management System</div>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {!collapsed && <div className="nav-section-label">Main Menu</div>}
          {filteredNav.map(item => {
            if (item.children) {
              const open = openMenus[item.label];
              const active = item.children.some(c => location.pathname.startsWith(c.path)) || location.pathname.startsWith(item.path);
              return (
                <div key={item.label}>
                  <div
                    className={`nav-item ${active ? 'active' : ''} ${open ? 'open' : ''}`}
                    onClick={() => toggleMenu(item.label)}
                    title={collapsed ? item.label : ''}
                  >
                    <span className="nav-icon"><item.icon size={17} /></span>
                    {!collapsed && <span>{item.label}</span>}
                    {!collapsed && <ChevronDown size={14} className="nav-chevron" />}
                  </div>
                  {open && !collapsed && (
                    <div className="nav-submenu">
                      {item.children.map(child => (
                        <div
                          key={child.path}
                          className={`nav-item ${location.pathname === child.path ? 'active' : ''}`}
                          onClick={() => navigate(child.path)}
                          style={{ fontSize: 13 }}
                        >
                          <span className="nav-icon"><ChevronRight size={13} /></span>
                          <span>{child.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div
                key={item.path}
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
                title={collapsed ? item.label : ''}
              >
                <span className="nav-icon"><item.icon size={17} /></span>
                {!collapsed && <span>{item.label}</span>}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && (
            <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.04)', fontSize: 12 }}>
              <div style={{ color: '#94a3b8', marginBottom: 4 }}>Warehouse Summary</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0', fontSize: 12, marginBottom: 3 }}>
                <span>Total Rooms</span><span style={{ fontWeight: 700 }}>{stats.rooms}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0', fontSize: 12, marginBottom: 3 }}>
                <span>Total Racks</span><span style={{ fontWeight: 700 }}>{stats.racks}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0', fontSize: 12, marginBottom: 3 }}>
                <span>Capacity</span><span style={{ fontWeight: 700, color: '#10b981' }}>{stats.capacity.toLocaleString()} Rolls</span>
              </div>
            </div>
          )}
          <div
            className="nav-item"
            style={{ marginTop: 8 }}
            onClick={handleLogout}
            title="Logout"
          >
            <span className="nav-icon"><LogOut size={17} /></span>
            {!collapsed && <span>Logout</span>}
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main-content">
        {/* TOPBAR */}
        <header className="topbar">
          <button className="topbar-toggle" onClick={() => setCollapsed(c => !c)} id="sidebar-toggle-btn">
            <Menu size={18} />
          </button>

          <div className="topbar-search">
            <Search size={15} className="search-icon" />
            <input
              id="global-search-input"
              placeholder="Search materials, codes, locations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="topbar-actions">
            <button className="topbar-btn" onClick={toggleDark} id="dark-mode-toggle" title="Toggle Dark Mode">
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <div style={{ position: 'relative' }}>
              <button className="topbar-btn" id="notifications-btn" title="Notifications" onClick={() => setShowNotifs(s => !s)}>
                <Bell size={17} />
                {pendingTransfers.length > 0 && <span className="notification-badge" />}
              </button>

              {showNotifs && (
                <div 
                  className="notifications-dropdown card" 
                  style={{ 
                    position: 'absolute', 
                    top: '44px', 
                    right: '0px', 
                    width: '320px', 
                    zIndex: 1000, 
                    boxShadow: 'var(--shadow-lg)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)'
                  }}
                >
                  <div className="card-header" style={{ padding: '10px 14px', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Pending Approvals</div>
                    <span className="badge badge-primary" style={{ fontSize: 10, fontWeight: 700 }}>
                      {pendingTransfers.length}
                    </span>
                  </div>
                  <div className="card-body" style={{ padding: 0, maxHeight: '280px', overflowY: 'auto' }}>
                    {pendingTransfers.length === 0 ? (
                      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                        No pending transfer requests.
                      </div>
                    ) : (
                      pendingTransfers.map(t => (
                        <div key={t.id} style={{ padding: 12, borderBottom: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {t.transferredBy} requested:
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            Material: <strong>{getMaterialName(t.materialId)}</strong>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            Qty: <strong>{t.rolls} Rolls</strong>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            Route: <span className="badge badge-secondary" style={{ padding: '2px 4px', fontSize: 10 }}>{t.fromLocation}</span> → <span className="badge badge-primary" style={{ padding: '2px 4px', fontSize: 10 }}>{t.toLocation}</span>
                          </div>
                          {currentUser?.role === 'Admin' ? (
                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                              <button 
                                className="btn btn-success btn-sm" 
                                style={{ flex: 1, padding: '4px 8px', fontSize: 11 }} 
                                onClick={() => handleApprove(t.id)}
                              >
                                Yes (Approve)
                              </button>
                              <button 
                                className="btn btn-danger btn-sm" 
                                style={{ flex: 1, padding: '4px 8px', fontSize: 11 }} 
                                onClick={() => handleReject(t.id)}
                              >
                                No (Reject)
                              </button>
                            </div>
                          ) : (
                            <div style={{ fontSize: 10, color: 'var(--warning)', fontWeight: 650 }}>
                              Waiting for Admin Approval
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button className="user-avatar" id="user-profile-btn">
              <div className="avatar-circle">{currentUser?.avatar || 'AU'}</div>
              <div className="user-info">
                <div className="user-name">{currentUser?.name || 'Admin User'}</div>
                <div className="user-role">{currentUser?.role || 'Administrator'}</div>
              </div>
            </button>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
