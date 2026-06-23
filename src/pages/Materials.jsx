import { useState, useEffect, useRef } from 'react';
import { store } from '../store.js';
import { Plus, Search, Edit, Trash2, Eye, Package, Filter, Download, QrCode, X, AlertTriangle, ArrowLeft } from 'lucide-react';
import JsBarcode from 'jsbarcode';


const CATEGORIES = ['Summer Fabric', 'Winter Fabric', 'Accessories'];
const SUB_CATS = {
  'Summer Fabric': ['Plain Cotton', 'Woven', 'Viscose Lining', 'Double Knit', 'Cotton Twill', 'Interlock'],
  'Winter Fabric': ['Rib Knit', 'Polar Fleece', 'Heavy Denim', 'Woolen'],
  'Accessories': ['Plastic Buttons', 'Metal Zippers', 'Threads', 'Labels', 'Elastic'],
};
const UNITS = ['Roll'];

function MaterialForm({ material, suppliers, onSave, onClose }) {
  const [form, setForm] = useState(material ? { ...material, lotNo: material.lotNo || '' } : {
    name: '',
    category: CATEGORIES[0],
    subCategory: SUB_CATS[CATEGORIES[0]][0],
    color: '',
    supplier: '',
    weight: '',
    rolls: '',
    unit: 'Roll',
    location: '',
    status: 'Active',
    lotNo: '',
  });
  const isEdit = !!material?.id;
  const [shelves, setShelves] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([store.getShelves(), store.getRooms()])
      .then(([s, r]) => {
        setShelves(s || []);
        setRooms(r || []);
      })
      .catch(console.error);
  }, []);

  const reqRolls = parseInt(form.rolls) || 0;
  const targetRoom = rooms.find(r => r.category === form.category);
  const recommendedShelves = shelves
    .map(s => {
      const currentMatRolls = (isEdit && material?.location === s.id) ? (material.rolls || 0) : 0;
      const freeSpace = s.capacity - s.used + currentMatRolls;
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

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setError('');
    if (!form.name || !form.category || !form.supplier) {
      setError('Please fill required fields.');
      return;
    }
    const formattedForm = {
      ...form,
      weight: parseFloat(form.weight) || 0,
      rolls: parseInt(form.rolls) || 0,
      stockKg: parseFloat(form.weight) || 0
    };
    try {
      if (isEdit) {
        await store.updateMaterial(material.id, formattedForm);
      } else {
        await store.addMaterial(formattedForm);
      }
      onSave();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title"><Package size={18} /> {isEdit ? 'Edit Material' : 'Add New Material'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
          <div className="form-grid form-grid-3" style={{ gap: 16 }}>
            {isEdit && (
              <div className="form-group">
                <label className="form-label">Material Code</label>
                <input className="form-control" value={form.code || ''} disabled />
              </div>
            )}
            <div className="form-group" style={isEdit ? {} : { gridColumn: 'span 1' }}>
              <label className="form-label">Material Name <span className="required">*</span></label>
              <input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Cotton Fabric" />
            </div>
            <div className="form-group">
              <label className="form-label">Category <span className="required">*</span></label>
              <select className="form-control" value={form.category} onChange={e => { set('category', e.target.value); set('subCategory', SUB_CATS[e.target.value]?.[0] || ''); }}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Sub Category</label>
              <select className="form-control" value={form.subCategory} onChange={e => set('subCategory', e.target.value)}>
                {(SUB_CATS[form.category] || []).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <input className="form-control" value={form.color} onChange={e => set('color', e.target.value)} placeholder="e.g. White, Blue" />
            </div>
            <div className="form-group">
              <label className="form-label">Lot Number</label>
              <input className="form-control" value={form.lotNo} onChange={e => set('lotNo', e.target.value)} placeholder="e.g. LOT-101" />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier <span className="required">*</span></label>
              <select className="form-control" value={form.supplier} onChange={e => set('supplier', parseInt(e.target.value))}>
                <option value="">Select Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Weight (Kg)</label>
              <input className="form-control" type="number" value={form.weight} onChange={e => set('weight', parseFloat(e.target.value))} placeholder="e.g. 250" />
            </div>
            <div className="form-group">
              <label className="form-label">Roll Quantity</label>
              <input className="form-control" type="number" value={form.rolls} onChange={e => set('rolls', parseInt(e.target.value))} placeholder="e.g. 10" />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <select className="form-control" value={form.unit} onChange={e => set('unit', e.target.value)}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 3' }}>
              <label className="form-label">Location</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  className="form-control"
                  value={form.location}
                  onChange={e => set('location', e.target.value)}
                  placeholder="e.g. A03-S02"
                  style={{ flex: 1 }}
                  id="material-location-input"
                />
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
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>
                    Recommended Shelves for {reqRolls} Rolls ({form.category})
                  </div>
                  {recommendedShelves.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      No available shelves found that can fit {reqRolls} rolls in {form.category}.
                    </div>
                  ) : (
                    <div className="recommendations-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: 10 }}>
                      {recommendedShelves.slice(0, 6).map(shelf => (
                        <div
                          key={shelf.id}
                          onClick={() => { set('location', shelf.id); setShowRecommendations(false); }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: `1.5px solid ${form.location === shelf.id ? 'var(--primary)' : 'var(--border)'}`,
                            background: form.location === shelf.id ? 'var(--primary-light)' : 'var(--surface)',
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
              <label className="form-label">Status</label>
              <select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}>
                <option>Active</option>
                <option>Low Stock</option>
                <option>Inactive</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" id="save-material-btn" onClick={handleSave}>{isEdit ? 'Update Material' : 'Add Material'}</button>
        </div>
      </div>
    </div>
  );
}

const printDirectly = (type, data) => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:8765');

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'auth',
        token: 'fabric-print-secret-key-2024'
      }));
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        if (response.type === 'auth_success') {
          ws.send(JSON.stringify({
            type: type,
            data: data
          }));
        } else if (response.type === 'print_result') {
          ws.close();
          if (response.success) {
            resolve(response.message);
          } else {
            reject(new Error(response.message));
          }
        }
      } catch (e) {
        ws.close();
        reject(e);
      }
    };

    ws.onerror = (err) => {
      reject(new Error('Print service offline'));
    };

    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
        reject(new Error('Print request timed out'));
      }
    }, 3000);
  });
};

function Barcode({ value, width = 1.5, height = 35, displayValue = false }) {
  const svgRef = useRef(null);
  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          width: width,
          height: height,
          displayValue: displayValue,
          margin: 0,
          background: "transparent",
          fontSize: 10,
          textMargin: 2
        });
      } catch (e) {
        console.error("Barcode generation error:", e);
      }
    }
  }, [value, width, height, displayValue]);

  return <svg ref={svgRef}></svg>;
}

function BarcodeModal({ material, onClose }) {
  const [lotNumber, setLotNumber] = useState(material.lotNo || material.code || '');
  const [billNumber, setBillNumber] = useState(material.billNumber || '');
  const [weight, setWeight] = useState(material.weight || '0.00');
  const [receivedDate, setReceivedDate] = useState(material.receivedDate || new Date().toISOString().split('T')[0]);
  const [receivedPerson, setReceivedPerson] = useState(material.receivedPerson || '');
  const [authorizedPerson, setAuthorizedPerson] = useState(material.authorizedPerson || '');

  const formatDateForDisplay = (dateStr) => {
    try {
      if (!dateStr || dateStr === '—') return '—';
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  const handlePrint = async () => {
    try {
      await printDirectly('print_material', {
        code: material.code,
        name: material.name,
        category: material.category,
        subCategory: material.subCategory || '',
        color: material.color || '',
        weight: weight,
        location: material.location,
        receivedDate: receivedDate,
        billNumber: billNumber,
        lotNumber: lotNumber,
        receivedPerson: receivedPerson,
        authorizedPerson: authorizedPerson
      });
      alert('✓ Sticker print request sent to Python print service!');
    } catch (err) {
      console.error('Direct print failed:', err);
      alert(`❌ Print Failed: Print service is offline.\n\nPlease start the Python print service by running:\npython python_service/print-service/print_service.py`);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-md">
        <style>{`
          .barcode-label {
            width: 2.40in;
            height: 1.60in;
            padding: 4px 6px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: white;
            color: black;
            font-family: Arial, sans-serif;
          }
          .sticker-table {
            width: 100%;
            border-collapse: collapse;
            font-family: Arial, sans-serif;
            font-size: 5.5pt;
            border: 1px solid black;
          }
          .sticker-table td {
            border: 1px solid black;
            padding: 1px 2px;
            line-height: 1.1;
          }
          .label-cell {
            font-weight: bold;
            width: 30%;
          }
          .val-cell {
            width: 70%;
          }
          .barcode-svg-container {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-top: 2px;
          }
          .barcode-svg-container svg {
            width: 2.10in !important;
            height: 0.35in !important;
            display: block;
          }
          .barcode-footer {
            text-align: center;
            font-size: 5pt;
            color: #555;
            border-top: 1px solid #000;
            padding-top: 1px;
            margin-top: 1px;
            line-height: 1;
          }
        `}</style>
        <div className="modal-header">
          <div className="modal-title"><QrCode size={18} /> Barcode Label — {material.code}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', gap: '20px', flexDirection: 'row', flexWrap: 'wrap', maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Form Inputs (Left Column) */}
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '280px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '12px' }}>Lot Number</label>
              <input className="form-control" style={{ padding: '8px 12px' }} value={lotNumber} onChange={e => setLotNumber(e.target.value)} placeholder="e.g. LOT-4509" />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '12px' }}>Bill Number</label>
              <input className="form-control" style={{ padding: '8px 12px' }} value={billNumber} onChange={e => setBillNumber(e.target.value)} placeholder="e.g. BILL-9921" />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '12px' }}>Weight (Kg)</label>
              <input className="form-control" style={{ padding: '8px 12px' }} type="number" step="0.01" value={weight} onChange={e => setWeight(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '12px' }}>Received Date</label>
              <input className="form-control" style={{ padding: '8px 12px' }} type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '12px' }}>Received By</label>
              <input className="form-control" style={{ padding: '8px 12px' }} value={receivedPerson} onChange={e => setReceivedPerson(e.target.value)} placeholder="e.g. John Doe" />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '12px' }}>Authorized Person</label>
              <input className="form-control" style={{ padding: '8px 12px' }} value={authorizedPerson} onChange={e => setAuthorizedPerson(e.target.value)} placeholder="e.g. Sarah Smith" />
            </div>
          </div>

          {/* Sticker Preview (Right Column) */}
          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: 'auto' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sticker Live Preview</div>
            <div id="barcode-print-area">
              <div className="barcode-label" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <table className="sticker-table">
                  <tbody>
                    <tr>
                      <td className="label-cell">BARCODE ID</td>
                      <td className="val-cell" style={{ fontWeight: 'bold', textAlign: 'center', backgroundColor: '#fef3c7' }}>{material.code}</td>
                    </tr>
                    <tr>
                      <td className="label-cell">CMP</td>
                      <td className="val-cell">{material.category || '—'}</td>
                    </tr>
                    <tr>
                      <td className="label-cell">FABRIC</td>
                      <td className="val-cell">{material.name || '—'}</td>
                    </tr>
                    <tr>
                      <td className="label-cell">GROUP</td>
                      <td className="val-cell">{material.subCategory || '—'}</td>
                    </tr>
                    <tr>
                      <td className="label-cell">SHADE</td>
                      <td className="val-cell">
                        <table style={{ width: '100%', border: 'none', borderCollapse: 'collapse', margin: 0, padding: 0 }}>
                          <tbody>
                            <tr style={{ border: 'none' }}>
                              <td style={{ border: 'none', padding: 0, fontWeight: 'bold', width: '45%' }}>{material.color || '—'}</td>
                              <td style={{ border: 'none', borderLeft: '1px solid black', padding: '0 0 0 4px', fontWeight: 'bold', width: '55%' }}>LOCATION: {material.location || '—'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td className="label-cell">WEIGHT</td>
                      <td className="val-cell">
                        <table style={{ width: '100%', border: 'none', borderCollapse: 'collapse', margin: 0, padding: 0 }}>
                          <tbody>
                            <tr style={{ border: 'none' }}>
                              <td style={{ border: 'none', padding: 0, fontWeight: 'bold', width: '45%' }}>{weight} Kg</td>
                              <td style={{ border: 'none', borderLeft: '1px solid black', padding: '0 0 0 4px', width: '55%' }}>BILL NO: {billNumber || '—'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td className="label-cell">DATE</td>
                      <td className="val-cell">{receivedDate ? formatDateForDisplay(receivedDate) : '—'}</td>
                    </tr>
                    <tr>
                      <td className="label-cell">LOT NO</td>
                      <td className="val-cell" style={{ fontWeight: 'bold' }}>{lotNumber || '—'}</td>
                    </tr>
                    <tr>
                      <td className="label-cell">RECEIVED BY</td>
                      <td className="val-cell">{receivedPerson || '—'}</td>
                    </tr>
                    <tr>
                      <td className="label-cell">AUTHORIZED</td>
                      <td className="val-cell">{authorizedPerson || '—'}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="barcode-svg-container" style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
                  <Barcode value={material.code} width={1.8} height={32} displayValue={true} />
                </div>
                <div className="barcode-footer">
                  Scan Barcode for details
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" id="print-label-btn" onClick={handlePrint}>🖨️ Print Sticker</button>
        </div>
      </div>
    </div>
  );
}

export default function Materials() {
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editMat, setEditMat] = useState(null);
  const [showQR, setShowQR] = useState(null);

  const load = () => {
    store.getMaterials().then(setMaterials).catch(console.error);
    store.getSuppliers().then(setSuppliers).catch(console.error);
  };
  useEffect(load, []);

  const filtered = materials.filter(m => {
    const q = search.toLowerCase();
    const matchQ = !q || m.name?.toLowerCase().includes(q) || m.code?.toLowerCase().includes(q) || m.location?.toLowerCase().includes(q);
    const matchCat = catFilter === 'All' || m.category === catFilter;
    const matchStatus = statusFilter === 'All' || m.status === statusFilter;
    return matchQ && matchCat && matchStatus;
  });

  const handleDelete = async (id) => {
    if (!confirm('Delete this material?')) return;
    try {
      await store.deleteMaterial(id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleExport = () => {
    try {
      const headers = ['Code', 'Material Name', 'Category', 'Color', 'Lot Number', 'Weight (Kg)', 'Stock (Rolls)', 'Location', 'Status'];
      const rows = filtered.map(m => [
        m.code,
        m.name,
        m.category,
        m.color || '—',
        m.lotNo || '—',
        m.weight,
        m.rolls,
        m.location,
        m.status
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `material_master_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert(`Export failed: ${e.message}`);
    }
  };

  const getSupplierName = (id) => suppliers.find(s => s.id === id)?.name || '—';

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
            <div className="breadcrumb"><span>Home</span><span>/</span><span>Material Master</span></div>
            <h1 style={{ margin: 0 }}>Material Master</h1>
            <p style={{ margin: '4px 0 0 0' }}>Manage fabric materials, colors, rolls, and warehouse placement.</p>
          </div>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" id="export-materials-btn" onClick={handleExport}><Download size={14} /> Export</button>
          {/* <button className="btn btn-primary btn-sm" id="add-material-btn" onClick={() => { setEditMat(null); setShowForm(true); }}><Plus size={14} /> Add Material</button> */}
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body" style={{ padding: '14px 18px' }}>
          <div className="filter-row">
            <div className="search-bar" style={{ maxWidth: 320 }}>
              <Search size={14} className="icon" />
              <input id="material-search" placeholder="Search by name, code, location..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-control" style={{ width: 160 }} value={catFilter} onChange={e => setCatFilter(e.target.value)} id="category-filter">
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select className="form-control" style={{ width: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} id="status-filter">
              <option value="All">All Status</option>
              <option>Active</option>
              <option>Low Stock</option>
              <option>Inactive</option>
            </select>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>{filtered.length} items</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Material Name</th>
                <th>Category</th>
                <th>Color</th>
                <th>Lot Number</th>
                <th>Supplier</th>
                <th>Weight (Kg)</th>
                <th>Stock (Rolls)</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><Package size={28} /></div>
                    <h3>No Materials Found</h3>
                    <p>Try adjusting your search or add a new material.</p>
                  </div>
                </td></tr>
              ) : filtered.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>{m.code}</td>
                  <td style={{ fontWeight: 600 }}>{m.name}</td>
                  <td><span className="badge badge-primary" style={{ fontSize: 11 }}>{m.category}</span></td>
                  <td>{m.color || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{m.lotNo || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{getSupplierName(m.supplier)}</td>
                  <td>{m.weight} Kg</td>
                  <td style={{ fontWeight: 700 }}>{m.rolls}</td>
                  <td><span className="tag" style={{ fontSize: 11 }}>{m.location}</span></td>
                  <td>
                    <span className={`badge ${m.status === 'Active' ? 'badge-success' : m.status === 'Low Stock' ? 'badge-warning' : 'badge-secondary'}`}>
                      {m.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" title="View QR" id={`qr-btn-${m.id}`} onClick={() => setShowQR(m)}><QrCode size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Edit" id={`edit-mat-${m.id}`} onClick={() => { setEditMat(m); setShowForm(true); }}><Edit size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Delete" id={`del-mat-${m.id}`} onClick={() => handleDelete(m.id)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <MaterialForm
          material={editMat}
          suppliers={suppliers}
          onSave={() => { load(); setShowForm(false); }}
          onClose={() => setShowForm(false)}
        />
      )}
      {showQR && <BarcodeModal material={showQR} onClose={() => setShowQR(null)} />}
    </div>
  );
}
