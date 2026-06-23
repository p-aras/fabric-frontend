import { useState, useEffect } from 'react';
import { store } from '../store.js';
import { ArrowLeftRight, Save, CheckCircle, X, ArrowRight, ArrowLeft } from 'lucide-react';

export default function TransferPage() {
  const [materials, setMaterials] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [form, setForm] = useState({
    materialId: '', fromLocation: '', toLocation: '', rolls: '',
    reason: '', date: new Date().toISOString().slice(0,10), transferredBy: 'Admin User',
  });
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    store.getMaterials().then(setMaterials).catch(console.error);
    store.getTransfers().then(trfs => setTransfers((trfs || []).slice().reverse())).catch(console.error);
    store.getShelves().then(setShelves).catch(console.error);
    store.getRooms().then(setRooms).catch(console.error);
  };
  useEffect(load, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selectedMat = materials.find(m => m.id == form.materialId);

  const availableShelves = shelves
    .filter(s => (s.capacity - s.used) > 0 && s.id !== form.fromLocation)
    .map(s => ({ ...s, free: s.capacity - s.used }));

  const reqRolls = parseInt(form.rolls) || 0;
  const targetRoom = rooms.find(r => r.category === selectedMat?.category);
  const recommendedShelves = shelves
    .filter(s => s.id !== form.fromLocation)
    .map(s => {
      const freeSpace = s.capacity - s.used;
      const roomMatch = targetRoom ? s.room === targetRoom.id : false;
      return { ...s, freeSpace, roomMatch };
    })
    .filter(s => s.freeSpace >= reqRolls)
    .sort((a, b) => {
      if (a.roomMatch !== b.roomMatch) {
        return a.roomMatch ? -1 : 1;
      }
      return a.freeSpace - b.freeSpace;
    });

  const handleMaterialSelect = (id) => {
    const mat = materials.find(m => m.id == id);
    setForm(f => ({
      ...f,
      materialId: id,
      fromLocation: mat ? mat.location : '',
      rolls: mat ? mat.rolls : ''
    }));
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.materialId || !form.toLocation || !form.rolls) { setError('Please select material, enter rolls, and select destination.'); return; }
    if (form.fromLocation === form.toLocation) { setError('Source and destination cannot be the same.'); return; }
    const rollsVal = parseInt(form.rolls);
    if (isNaN(rollsVal) || rollsVal <= 0) { setError('Rolls must be greater than 0.'); return; }
    if (selectedMat && rollsVal > selectedMat.rolls) { setError(`Insufficient stock. Available: ${selectedMat.rolls} Rolls`); return; }
    
    const dest = shelves.find(s => s.id === form.toLocation);
    if (dest && (dest.capacity - dest.used) < rollsVal) {
      setError(`Destination shelf cannot fit ${rollsVal} rolls. Free capacity: ${dest.capacity - dest.used} rolls.`);
      return;
    }
    
    try {
      const trf = await store.addTransfer({ ...form, materialId: parseInt(form.materialId), rolls: rollsVal });
      setSaved({ ...trf, materialName: selectedMat?.name });
      load();
      setForm({ materialId: '', fromLocation: '', toLocation: '', rolls: '', reason: '', date: new Date().toISOString().slice(0,10), transferredBy: 'Admin User' });
    } catch (e) {
      setError(e.message || 'Error processing transfer');
    }
  };

  const getMaterialName = (id) => materials.find(m => m.id == id)?.name || '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div className="page-title-block" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <button 
            onClick={() => window.history.back()} 
            className="btn btn-secondary btn-icon btn-sm"
            style={{ borderRadius: '50%', width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}
            title="Go Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="breadcrumb"><span>Home</span><span>/</span><span>Material Transfer</span></div>
            <h1 style={{ margin: 0 }}>Material Transfer</h1>
            <p style={{ margin: '4px 0 0 0' }}>Move materials between locations and track all movements.</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20 }}>
        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title"><ArrowLeftRight size={15} /> New Transfer</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {error && <div className="alert alert-danger" style={{ fontSize: 12 }}>{error}</div>}

              <div className="form-group">
                <label className="form-label">Material <span className="required">*</span></label>
                <select className="form-control" id="transfer-material" value={form.materialId} onChange={e => handleMaterialSelect(e.target.value)}>
                  <option value="">Select Material</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.code} — {m.name} ({m.rolls} Rolls)</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Rolls to Transfer <span className="required">*</span></label>
                <input
                  className="form-control"
                  id="transfer-rolls"
                  type="number"
                  placeholder="e.g. 20"
                  value={form.rolls}
                  onChange={e => set('rolls', e.target.value)}
                  max={selectedMat?.rolls || 999999}
                />
                {selectedMat && form.rolls && (
                  <div className="form-hint" style={{ color: parseInt(form.rolls) > selectedMat.rolls ? 'var(--danger)' : 'var(--success)' }}>
                    Remaining in current location: {Math.max(0, selectedMat.rolls - parseInt(form.rolls))} Rolls
                  </div>
                )}
              </div>

              {/* Transfer Visualization */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0' }}>
                <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 'var(--radius-md)', padding: '10px 14px', border: '2px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>From Location</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{form.fromLocation || '—'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <ArrowRight size={22} style={{ color: 'var(--primary)' }} />
                  {form.rolls && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>{form.rolls} Rolls</span>}
                </div>
                <div style={{
                  flex: 1, background: form.toLocation ? 'var(--primary-light)' : 'var(--bg)',
                  borderRadius: 'var(--radius-md)', padding: '10px 14px',
                  border: `2px solid ${form.toLocation ? 'var(--primary)' : 'var(--border)'}`,
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>To Location</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: form.toLocation ? 'var(--primary)' : 'var(--text-primary)' }}>{form.toLocation || '—'}</div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Destination Shelf <span className="required">*</span></label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <select className="form-control" id="transfer-to" value={form.toLocation} onChange={e => set('toLocation', e.target.value)} style={{ flex: 1 }}>
                    <option value="">Select Destination</option>
                    {availableShelves.map(s => (
                      <option key={s.id} value={s.id}>{s.id} — Free: {s.free} Rolls</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setShowRecommendations(!showRecommendations)}
                    id="recommend-location-btn"
                  >
                    💡 Recommend Space
                  </button>
                </div>

                {showRecommendations && (
                  <div 
                    className="recommendations-container" 
                    style={{ 
                      marginTop: 10, 
                      padding: 16, 
                      background: 'var(--bg)', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border)',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>
                      Recommended Shelves for {reqRolls} Rolls ({selectedMat?.category || 'No Category'})
                    </div>
                    {recommendedShelves.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        No available shelves found that can fit {reqRolls} rolls.
                      </div>
                    ) : (
                      <div className="recommendations-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                        {recommendedShelves.slice(0, 6).map(shelf => (
                          <div
                            key={shelf.id}
                            onClick={() => { set('toLocation', shelf.id); setShowRecommendations(false); }}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 'var(--radius-md)',
                              border: `1.5px solid ${form.toLocation === shelf.id ? 'var(--primary)' : 'var(--border)'}`,
                              background: form.toLocation === shelf.id ? 'var(--primary-light)' : 'var(--surface)',
                              cursor: 'pointer',
                              transition: 'var(--transition)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4
                            }}
                            className="shelf-rec-card"
                            id={`rec-shelf-${shelf.id}`}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{shelf.id}</span>
                              <span className={`badge ${shelf.roomMatch ? 'badge-primary' : 'badge-secondary'}`} style={{ fontSize: 9, padding: '1px 5px' }}>
                                {shelf.roomMatch ? 'Category Room' : 'Other Room'}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              Free: <strong style={{ color: 'var(--success)' }}>{shelf.freeSpace}</strong> / {shelf.capacity} Rolls
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Reason</label>
                <input className="form-control" id="transfer-reason" placeholder="e.g. Reorganization, Better space utilization" value={form.reason} onChange={e => set('reason', e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Transfer Date</label>
                  <input className="form-control" id="transfer-date" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Transferred By</label>
                  <input className="form-control" id="transfer-by" value={form.transferredBy} onChange={e => set('transferredBy', e.target.value)} />
                </div>
              </div>

              <button className="btn btn-primary btn-lg" id="save-transfer-btn" onClick={handleSubmit}>
                <Save size={16} /> Execute Transfer
              </button>
            </div>
          </div>

          {saved && (
            <div className="card" style={{ border: `2px solid ${saved.status === 'Pending' ? 'var(--warning)' : 'var(--success)'}` }}>
              <div className="card-header" style={{ background: saved.status === 'Pending' ? '#fffbeb' : '#ecfdf5' }}>
                <div className="card-title" style={{ color: saved.status === 'Pending' ? '#d97706' : 'var(--success)' }}>
                  {saved.status === 'Pending' ? '💡 Transfer Requested' : <><CheckCircle size={16} /> Transfer Completed</>}
                </div>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSaved(null)}><X size={16} /></button>
              </div>
              <div className="card-body" style={{ fontSize: 13 }}>
                {saved.status === 'Pending' && (
                  <div style={{ marginBottom: 12, fontWeight: 600, color: '#d97706' }}>
                    This transfer request has been submitted to the Admin for approval.
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div><div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Transfer No.</div><div style={{ fontWeight: 700 }}>{saved.transferNo}</div></div>
                  <div><div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Material</div><div style={{ fontWeight: 700 }}>{saved.materialName}</div></div>
                  <div><div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Rolls to Transfer</div><div style={{ fontWeight: 700, color: 'var(--primary)' }}>{saved.rolls} Roll(s)</div></div>
                  <div><div style={{ color: 'var(--text-muted)', fontSize: 11 }}>From</div><div style={{ fontWeight: 700, color: 'var(--danger)' }}>{saved.fromLocation}</div></div>
                  <div><div style={{ color: 'var(--text-muted)', fontSize: 11 }}>To</div><div style={{ fontWeight: 700, color: 'var(--success)' }}>{saved.toLocation}</div></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Transfer History */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Transfer History</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{transfers.length} records</span>
          </div>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Transfer No.</th>
                  <th>Material</th>
                  <th>Rolls</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                  <th>By</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr><td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><ArrowLeftRight size={28} /></div>
                      <h3>No Transfers Yet</h3>
                    </div>
                  </td></tr>
                ) : transfers.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>{t.transferNo}</td>
                    <td style={{ fontSize: 12 }}>{getMaterialName(t.materialId)}</td>
                    <td style={{ fontWeight: 600 }}>{t.rolls || 'All'} Roll(s)</td>
                    <td><span className="tag" style={{ fontSize: 11 }}>{t.fromLocation}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                        <span className="tag" style={{ fontSize: 11, color: 'var(--primary)', borderColor: 'var(--primary)' }}>{t.toLocation}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.reason || '—'}</td>
                    <td style={{ fontSize: 12 }}>{t.transferredBy}</td>
                    <td>
                      <span className={`badge ${t.status === 'Completed' ? 'badge-success' : t.status === 'Pending' ? 'badge-warning' : 'badge-danger'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
