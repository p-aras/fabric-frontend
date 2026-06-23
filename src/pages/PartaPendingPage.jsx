import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const BASE_URL = 'http://localhost:5001/api';

const STATUS_COLORS = {
  Missing: { bg: '#FEF2F2', border: '#FCA5A5', text: '#991B1B', dot: '#EF4444' },
  Saved: { bg: '#F0FDF4', border: '#86EFAC', text: '#166534', dot: '#22C55E' },
  Corrupt: { bg: '#FFF7ED', border: '#FED7AA', text: '#9A3412', dot: '#F97316' },
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Lots' },
  { value: 'missing', label: 'Missing Parta' },
  { value: 'kharcha', label: 'Pending Kharcha' },
  { value: 'vapsi', label: 'Pending Kapda Wapsi' },
  { value: 'unchecked', label: 'Not Confirmed' },
];

export default function PartaPendingPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/parta/pending-report`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to load report');
      setReports(json.reports || []);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err.message || 'Unable to load pending report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const stats = useMemo(() => {
    const total = reports.length;
    const missing = reports.filter(r => r.status === 'Missing').length;
    const pendingKharcha = reports.filter(r => r.kharchaPending).length;
    const pendingVapsi = reports.filter(r => r.vapsiPending).length;
    const unchecked = reports.filter(r => r.checkedBySahilSir !== 'yes').length;
    const fullyComplete = reports.filter(
      r => r.status === 'Saved' && !r.kharchaPending && !r.vapsiPending && r.checkedBySahilSir === 'yes'
    ).length;
    return { total, missing, pendingKharcha, pendingVapsi, unchecked, fullyComplete };
  }, [reports]);

  const filteredReports = useMemo(() => {
    let filtered = [...reports];
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      filtered = filtered.filter(r => String(r.lotNumber).toLowerCase().includes(s) || r.fabricName?.toLowerCase().includes(s));
    }
    if (filter === 'missing') filtered = filtered.filter(r => r.status === 'Missing');
    else if (filter === 'kharcha') filtered = filtered.filter(r => r.kharchaPending);
    else if (filter === 'vapsi') filtered = filtered.filter(r => r.vapsiPending);
    else if (filter === 'unchecked') filtered = filtered.filter(r => r.checkedBySahilSir !== 'yes');
    return filtered;
  }, [reports, search, filter]);

  const handleGoToParta = (lotNumber) => {
    navigate(`/parta?lot=${encodeURIComponent(lotNumber)}`);
  };

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const pendingBadge = (label, pending, value = null, colorPending = '#DC2626', colorOk = '#16A34A') => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.2,
      background: pending ? '#FEF2F2' : '#F0FDF4',
      color: pending ? colorPending : colorOk,
      border: `1px solid ${pending ? '#FCA5A5' : '#86EFAC'}`,
    }}>
      <span style={{ fontSize: 10 }}>{pending ? '⚠' : '✓'}</span>
      {label}{value !== null && !pending ? `: ${value}` : ''}
    </span>
  );

  return (
    <div style={{ minHeight: '100vh', padding: '28px 32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Page Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1E1B4B', margin: 0, letterSpacing: -0.5 }}>
              ⚠️ Pending Info in Parta
            </h1>
            <p style={{ fontSize: 13, color: '#64748B', marginTop: 6, marginBottom: 0 }}>
              Live audit of lot numbers with missing or incomplete Parta data in the database
              {lastRefreshed && (
                <span style={{ marginLeft: 8, color: '#94A3B8', fontSize: 12 }}>
                  · Last refreshed at {formatTime(lastRefreshed)}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 10, border: 'none',
              background: loading ? '#E2E8F0' : 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              color: loading ? '#94A3B8' : '#fff', fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(79,70,229,0.3)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: 16 }}>{loading ? '⏳' : '🔄'}</span>
            {loading ? 'Refreshing...' : 'Refresh Report'}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12,
          padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10,
          color: '#991B1B', fontWeight: 600, fontSize: 14,
        }}>
          <span style={{ fontSize: 18 }}>❌</span>
          {error}
          <button onClick={fetchReport} style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#fff', color: '#991B1B', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
            Retry
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Lots Tracked', value: stats.total, icon: '📦', color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE' },
          { label: 'Fully Complete', value: stats.fullyComplete, icon: '✅', color: '#16A34A', bg: '#F0FDF4', border: '#86EFAC' },
          { label: 'Missing Parta', value: stats.missing, icon: '🚫', color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' },
          { label: 'Pending Kharcha', value: stats.pendingKharcha, icon: '💰', color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
          { label: 'Pending Kapda Wapsi', value: stats.pendingVapsi, icon: '🔄', color: '#0891B2', bg: '#F0F9FF', border: '#BAE6FD' },
          { label: 'Not Confirmed', value: stats.unchecked, icon: '⏳', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
        ].map(card => (
          <div key={card.label} style={{
            background: card.bg, border: `1.5px solid ${card.border}`, borderRadius: 14,
            padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4,
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${card.border}66`; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
          >
            <div style={{ fontSize: 22 }}>{card.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: card.color, lineHeight: 1 }}>{loading ? '—' : card.value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: card.color, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#94A3B8' }}>🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Lot Number or Fabric..."
            style={{
              width: '100%', padding: '9px 12px 9px 36px', border: '1.5px solid #E2E8F0',
              borderRadius: 10, fontSize: 13, color: '#1E293B', outline: 'none',
              background: '#fff', boxSizing: 'border-box',
              transition: 'border-color 0.2s ease',
            }}
            onFocus={e => e.target.style.borderColor = '#4F46E5'}
            onBlur={e => e.target.style.borderColor = '#E2E8F0'}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: filter === opt.value ? '1.5px solid #4F46E5' : '1.5px solid #E2E8F0',
                background: filter === opt.value ? '#4F46E5' : '#fff',
                color: filter === opt.value ? '#fff' : '#64748B',
                transition: 'all 0.15s ease',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8', fontWeight: 600, whiteSpace: 'nowrap' }}>
          Showing {filteredReports.length} of {reports.length} lots
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16,
        overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
      }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ fontSize: 40, marginBottom: 12, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Loading pending report...</div>
          </div>
        ) : filteredReports.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', marginBottom: 6 }}>
              {search || filter !== 'all' ? 'No lots match your filter' : 'No pending items found!'}
            </div>
            <div style={{ fontSize: 13 }}>
              {search || filter !== 'all' ? 'Try adjusting your search or filter criteria.' : 'All tracked lots have complete Parta information.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)' }}>
                  {['Lot Number', 'Fabric / Brand', 'Parta Status', 'Kharcha', 'Kapda Wapsi (Total KG)', 'Confirmed by Sahil Sir', 'Action'].map((header, i) => (
                    <th key={i} style={{
                      padding: '13px 16px', textAlign: 'left', color: '#C7D2FE',
                      fontWeight: 700, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase',
                      whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.1)',
                    }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report, idx) => {
                  const sc = STATUS_COLORS[report.status] || STATUS_COLORS.Saved;
                  return (
                    <tr
                      key={report.lotNumber}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        background: idx % 2 === 0 ? '#FAFBFC' : '#fff',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#EEF2FF'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#FAFBFC' : '#fff'}
                    >
                      {/* Lot Number */}
                      <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                          <span style={{ fontWeight: 800, color: '#1E1B4B', fontSize: 14 }}>
                            {report.lotNumber}
                          </span>
                        </div>
                      </td>

                      {/* Fabric / Brand */}
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#374151', fontSize: 12 }}>
                          {report.fabricName || <span style={{ color: '#CBD5E1' }}>—</span>}
                        </div>
                        {report.brand && (
                          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{report.brand}</div>
                        )}
                      </td>

                      {/* Parta Status */}
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 10px', borderRadius: 20,
                          background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                          fontSize: 11, fontWeight: 700,
                        }}>
                          {report.status === 'Missing' ? '🚫' : report.status === 'Corrupt' ? '⚠️' : '💾'}
                          {report.status}
                        </span>
                      </td>

                      {/* Kharcha */}
                      <td style={{ padding: '13px 16px' }}>
                        {pendingBadge(
                          report.kharchaPending ? 'Pending' : 'Done',
                          report.kharchaPending,
                          !report.kharchaPending ? report.kharchaValue : null
                        )}
                      </td>

                      {/* Kapda Wapsi */}
                      <td style={{ padding: '13px 16px' }}>
                        {pendingBadge(
                          report.vapsiPending ? 'Pending' : `${parseFloat(report.vapsiValue || 0).toFixed(2)} KG`,
                          report.vapsiPending,
                          null,
                          '#0891B2',
                          '#0891B2'
                        )}
                      </td>

                      {/* Confirmed */}
                      <td style={{ padding: '13px 16px' }}>
                        {report.checkedBySahilSir === 'yes' ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC',
                          }}>✓ Confirmed</span>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE',
                          }}>⏳ Pending</span>
                        )}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '13px 16px' }}>
                        <button
                          onClick={() => handleGoToParta(report.lotNumber)}
                          style={{
                            padding: '6px 14px', borderRadius: 8, border: 'none',
                            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                            color: '#fff', fontWeight: 700, fontSize: 11,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                            boxShadow: '0 2px 8px rgba(79,70,229,0.25)',
                            transition: 'all 0.15s ease',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                          onMouseLeave={e => e.currentTarget.style.transform = ''}
                          title={`Open Lot ${report.lotNumber} in Parta editor`}
                        >
                          <span>🔗</span> Open Lot
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer */}
        {!loading && filteredReports.length > 0 && (
          <div style={{
            padding: '12px 20px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
          }}>
            <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
              📊 {filteredReports.length} lot(s) displayed · {stats.missing} missing entirely · {stats.pendingKharcha} pending Kharcha · {stats.pendingVapsi} pending Kapda Wapsi
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {stats.fullyComplete > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', background: '#F0FDF4', border: '1px solid #86EFAC', padding: '3px 10px', borderRadius: 20 }}>
                  ✅ {stats.fullyComplete} complete
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 20, padding: '14px 20px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>Legend:</span>
        {[
          { icon: '🚫', label: 'Missing: No Parta saved for this lot', color: '#DC2626' },
          { icon: '💾', label: 'Saved: Parta exists in database', color: '#16A34A' },
          { icon: '⚠️', label: 'Corrupt: Parta data is unreadable', color: '#F97316' },
          { icon: '⚠', label: 'Pending: Info is absent or blank', color: '#D97706' },
          { icon: '✓', label: 'Done: Info is filled', color: '#16A34A' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748B' }}>
            <span style={{ fontSize: 13 }}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
