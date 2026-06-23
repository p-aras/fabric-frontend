import { useState, useEffect } from 'react';
import { store } from '../store.js';
import { BarChart3, Download, FileText, TrendingUp, Package, Warehouse, Users, Grid } from 'lucide-react';
import Parta from './Parta.jsx';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const PIE_COLORS = ['#1a56db', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function exportCSV(data, filename) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const csv = [keys.join(','), ...data.map(row => keys.map(k => `"${row[k] ?? ''}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [tab, setTab] = useState('stock');
  const [materials, setMaterials] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [grns, setGRNs] = useState([]);
  const [issues, setIssues] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const [mats, shvs, grnList, iss, trfs, sups, rms] = await Promise.all([
          store.getMaterials(),
          store.getShelves(),
          store.getGRNs(),
          store.getIssues(),
          store.getTransfers(),
          store.getSuppliers(),
          store.getRooms()
        ]);
        if (!active) return;
        setMaterials(mats || []);
        setShelves(shvs || []);
        setGRNs(grnList || []);
        setIssues(iss || []);
        setTransfers(trfs || []);
        setSuppliers(sups || []);
        setRooms(rms || []);
      } catch (e) {
        console.error(e);
      }
    };
    loadData();
    return () => { active = false; };
  }, []);

  const getSupplierName = (id) => suppliers.find(s => s.id === id)?.name || '—';

  // Stock Report Data
  const stockData = materials.map(m => ({
    name: m.name, code: m.code, category: m.category, color: m.color,
    stock: m.rolls,
    location: m.location, status: m.status,
  }));

  const categoryStock = Object.entries(
    materials.reduce((acc, m) => { acc[m.category] = (acc[m.category] || 0) + m.rolls; return acc; }, {})
  ).map(([cat, val]) => ({ name: cat, value: val }));

  // Warehouse Report
  const roomData = rooms.map(room => {
    const r = room.id;
    const rs = shelves.filter(s => s.room === r);
    const total = rs.reduce((a, s) => a + s.capacity, 0);
    const used = rs.reduce((a, s) => a + s.used, 0);
    return { room: room.name, category: room.category, total, used, free: total - used, pct: total > 0 ? Math.round((used / total) * 100) : 0 };
  });

  // Movement Report
  const movementByDate = {};
  grns.forEach(g => {
    movementByDate[g.receivedDate] = movementByDate[g.receivedDate] || { date: g.receivedDate, received: 0, issued: 0 };
    movementByDate[g.receivedDate].received += g.rolls || 0;
  });
  issues.forEach(i => {
    movementByDate[i.date] = movementByDate[i.date] || { date: i.date, received: 0, issued: 0 };
    movementByDate[i.date].issued += i.rolls || 0;
  });
  const movementData = Object.values(movementByDate).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);

  // Supplier Report
  const supplierData = suppliers.map(s => {
    const sGrns = grns.filter(g => g.supplier === s.id);
    const totalRolls = sGrns.reduce((a, g) => a + (g.rolls || 0), 0);
    return { name: s.name, contact: s.contact, city: s.city, deliveries: sGrns.length, totalRolls, status: s.status };
  });

  const TABS = [
    { id: 'stock', label: 'Stock Report', icon: Package },
    { id: 'warehouse', label: 'Warehouse Report', icon: Warehouse },
    { id: 'movement', label: 'Movement Report', icon: TrendingUp },
    { id: 'supplier', label: 'Supplier Report', icon: Users },
    { id: 'parta', label: 'Parta Matrix', icon: Grid },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div className="page-title-block">
          <div className="breadcrumb"><span>Home</span><span>/</span><span>Reports</span></div>
          <h1>Reports & Analytics</h1>
          <p>Comprehensive reports for stock, warehouse utilization and material movements.</p>
        </div>
        {tab !== 'parta' && (
          <div className="page-actions">
            <button className="btn btn-secondary btn-sm" id="export-report-btn"
              onClick={() => {
                const dataMap = { stock: stockData, warehouse: roomData, movement: movementData, supplier: supplierData };
                exportCSV(dataMap[tab], `${tab}-report.csv`);
              }}>
              <Download size={14} /> Export CSV
            </button>
            <button className="btn btn-primary btn-sm" id="print-report-btn" onClick={() => window.print()}>
              <FileText size={14} /> Print Report
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* STOCK REPORT */}
      {tab === 'stock' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card">
              <div className="card-header"><div className="card-title">Stock by Category (Rolls)</div></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={categoryStock}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#1a56db" radius={[4, 4, 0, 0]} name="Stock (Rolls)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><div className="card-title">Stock Distribution</div></div>
              <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={categoryStock} cx="50%" cy="50%" outerRadius={75} dataKey="value">
                      {categoryStock.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => `${v} Rolls`} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {categoryStock.map((d, i) => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i], flexShrink: 0 }} />
                      <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{d.name}</span>
                      <span style={{ fontWeight: 700 }}>{d.value} Rolls</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Stock Details</div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stockData.length} materials</span>
            </div>
            <div className="table-wrap" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Code</th>
                    <th>Material Name</th>
                    <th>Category</th>
                    <th>Color</th>
                    <th>Stock (Rolls)</th>
                    <th>Location</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stockData.map((m, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>{m.code}</td>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td><span className="badge badge-primary" style={{ fontSize: 11 }}>{m.category}</span></td>
                      <td>{m.color}</td>
                      <td style={{ fontWeight: 700 }}>{m.stock} Rolls</td>
                      <td><span className="tag" style={{ fontSize: 11 }}>{m.location}</span></td>
                      <td>
                        <span className={`badge ${m.status === 'Active' ? 'badge-success' : m.status === 'Low Stock' ? 'badge-warning' : 'badge-secondary'}`}>
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* WAREHOUSE REPORT */}
      {tab === 'warehouse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="grid grid-3">
            {roomData.map(r => (
              <div key={r.room} className="card card-hover">
                <div className="card-body">
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{r.room}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{r.category}</div>
                  <div className="progress-bar" style={{ marginBottom: 8 }}>
                    <div className={`progress-fill ${r.pct >= 90 ? 'red' : r.pct >= 50 ? 'yellow' : 'green'}`} style={{ width: `${r.pct}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Used: <b style={{ color: 'var(--text-primary)' }}>{r.used.toLocaleString()} Rolls</b></span>
                    <span style={{ fontWeight: 700, color: r.pct >= 90 ? 'var(--danger)' : r.pct >= 50 ? '#d97706' : 'var(--success)' }}>{r.pct}%</span>
                    <span style={{ color: 'var(--text-muted)' }}>Free: <b style={{ color: 'var(--success)' }}>{r.free.toLocaleString()} Rolls</b></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Room Utilization Comparison</div></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={roomData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="room" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="used" fill="#1a56db" radius={[4, 4, 0, 0]} name="Used (Rolls)" />
                  <Bar dataKey="free" fill="#10b981" radius={[4, 4, 0, 0]} name="Free (Rolls)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* MOVEMENT REPORT */}
      {tab === 'movement' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">Daily Material Movement (Rolls)</div></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={movementData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="received" stroke="#1a56db" strokeWidth={2} dot={{ r: 4 }} name="Received (Rolls)" />
                  <Line type="monotone" dataKey="issued" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="Issued (Rolls)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card">
              <div className="card-header"><div className="card-title">GRN Records</div></div>
              <div className="table-wrap" style={{ border: 'none' }}>
                <table>
                  <thead><tr><th>GRN No.</th><th>Supplier</th><th>Roll Qty</th><th>Date</th></tr></thead>
                  <tbody>
                    {grns.slice(0, 10).map(g => (
                      <tr key={g.id}>
                        <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>{g.grnNo}</td>
                        <td style={{ fontSize: 12 }}>{getSupplierName(g.supplier)}</td>
                        <td style={{ fontWeight: 600 }}>{g.rolls} Roll(s)</td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.receivedDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><div className="card-title">Issue Records</div></div>
              <div className="table-wrap" style={{ border: 'none' }}>
                <table>
                  <thead><tr><th>Issue No.</th><th>Department</th><th>Roll Qty</th><th>Date</th></tr></thead>
                  <tbody>
                    {issues.slice(0, 10).map(i => (
                      <tr key={i.id}>
                        <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>{i.issueNo}</td>
                        <td><span className="badge badge-info" style={{ fontSize: 11 }}>{i.department}</span></td>
                        <td style={{ fontWeight: 600, color: 'var(--danger)' }}>{i.rolls} Roll(s)</td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{i.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIER REPORT */}
      {tab === 'supplier' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">Supplier Performance</div></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={supplierData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalRolls" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Total Received (Rolls)" />
                  <Bar dataKey="deliveries" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="No. of Deliveries" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Supplier Summary</div></div>
            <div className="table-wrap" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr><th>#</th><th>Supplier Name</th><th>Contact</th><th>City</th><th>Deliveries</th><th>Total Rolls</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {supplierData.map((s, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ fontWeight: 700 }}>{s.name}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.contact}</td>
                      <td style={{ fontSize: 12 }}>{s.city}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.deliveries}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.totalRolls} Rolls</td>
                      <td>
                        <span className={`badge ${s.status === 'Active' ? 'badge-success' : 'badge-secondary'}`}>{s.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PARTA MATRIX REPORT */}
      {tab === 'parta' && (
        <Parta />
      )}
    </div>
  );
}
