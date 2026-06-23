import { useState, useEffect, useRef } from 'react';
import { store } from '../store.js';
import { PackagePlus, Save, QrCode, Printer, X, CheckCircle, MapPin, AlertTriangle, ArrowLeft } from 'lucide-react';
import JsBarcode from 'jsbarcode';


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

export default function GRNPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({
    supplier: '', poNumber: '', materialName: '', category: 'Summer Fabric',
    weight: '', rolls: '', invoiceNo: '', receivedDate: new Date().toISOString().slice(0, 10),
    receivedBy: 'Admin User', location: '',
  });
  const [grns, setGRNs] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [saved, setSaved] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [hiddenQr, setHiddenQr] = useState(null);
  const [shelves, setShelves] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [error, setError] = useState('');

  const findBestLocation = (categoryVal, rollsCount = 0, currentShelves = shelves, currentRooms = rooms) => {
    const room = (currentRooms || []).find(r => r.category === categoryVal) || (currentRooms || [])[0];
    if (!room) return 'A01-S01';
    const roomShelves = (currentShelves || []).filter(s => s.room === room.id);
    const available = roomShelves.find(s => (s.capacity - s.used) >= rollsCount);
    if (available) return available.id;
    if (roomShelves.length > 0) return roomShelves[0].id;
    return 'A01-S01';
  };

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const [sups, grnList, mats, shelvesList, roomsList] = await Promise.all([
          store.getSuppliers(),
          store.getGRNs(),
          store.getMaterials(),
          store.getShelves(),
          store.getRooms()
        ]);
        if (!active) return;
        setSuppliers(sups || []);
        setGRNs((grnList || []).slice().reverse());
        setMaterials(mats || []);
        setShelves(shelvesList || []);
        setRooms(roomsList || []);

        const bestLoc = findBestLocation('Summer Fabric', 0, shelvesList, roomsList);
        setForm(f => ({ ...f, location: bestLoc }));
      } catch (e) {
        console.error(e);
      }
    };
    loadData();
    return () => { active = false; };
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCategoryChange = (categoryVal) => {
    const bestLoc = findBestLocation(categoryVal, parseInt(form.rolls) || 0);
    setForm(f => ({ ...f, category: categoryVal, location: bestLoc }));
  };

  const handleRollsChange = (rollsVal) => {
    const reqRolls = parseInt(rollsVal) || 0;
    const currentShelf = shelves.find(s => s.id === form.location);
    const currentFree = currentShelf ? (currentShelf.capacity - currentShelf.used) : 0;
    let bestLoc = form.location;
    if (!form.location || currentFree < reqRolls) {
      bestLoc = findBestLocation(form.category, reqRolls);
    }
    setForm(f => ({ ...f, rolls: rollsVal, location: bestLoc }));
  };

  const reqRolls = parseInt(form.rolls) || 0;
  const targetRoom = rooms.find(r => r.category === form.category);
  const recommendedShelves = shelves
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

  const getSupplierName = (id) => suppliers.find(s => s.id == id)?.name || '—';
  const getMaterialName = (id) => materials.find(m => m.id == id)?.name || '—';

  const handleSubmit = async () => {
    setError('');
    if (!form.supplier || !form.materialName || !form.rolls) {
      setError('Please fill Supplier, Material Name and Roll Qty.');
      return;
    }
    try {
      const savedGRN = await store.addGRN({
        supplier: parseInt(form.supplier),
        poNumber: form.poNumber,
        materialName: form.materialName,
        category: form.category,
        weight: parseFloat(form.weight) || 0,
        rolls: parseInt(form.rolls) || 0,
        invoiceNo: form.invoiceNo,
        receivedDate: form.receivedDate,
        receivedBy: form.receivedBy,
        location: form.location
      });

      setSaved(savedGRN);

      const [updatedGRNs, updatedMats] = await Promise.all([
        store.getGRNs(),
        store.getMaterials()
      ]);
      setGRNs(updatedGRNs.slice().reverse());
      setMaterials(updatedMats);

      const bestLoc = findBestLocation('Summer Fabric', 0);
      setForm({
        supplier: '', poNumber: '', materialName: '', category: 'Summer Fabric',
        weight: '', rolls: '', invoiceNo: '', receivedDate: new Date().toISOString().slice(0, 10),
        receivedBy: 'Admin User',
        location: bestLoc,
      });
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (hiddenQr) {
      const timer = setTimeout(() => {
        const barcodeContainer = document.getElementById('hidden-grn-barcode');
        const barcodeHtml = barcodeContainer ? barcodeContainer.innerHTML : '';

        // Create or get hidden iframe for printing
        let iframe = document.getElementById('print-fallback-iframe');
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.id = 'print-fallback-iframe';
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = 'none';
          document.body.appendChild(iframe);
        }

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
          <html>
            <head>
              <title>Print Label</title>
              <style>
                @page {
                  size: auto;
                  margin: 0mm;
                }
                html, body {
                  margin: 0;
                  padding: 0;
                  width: 2.40in;
                  height: 1.60in;
                  overflow: hidden;
                  font-family: Arial, sans-serif;
                  background: white;
                  color: black;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                .barcode-label {
                  width: 2.40in;
                  height: 1.60in;
                  padding: 6px 8px;
                  box-sizing: border-box;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                  border: none !important;
                  margin: 0;
                  background: white;
                }
                .barcode-label-header {
                  text-align: center;
                  font-weight: bold;
                  font-size: 7pt;
                  line-height: 1.1;
                  border-bottom: 1px solid #000;
                  padding-bottom: 2px;
                  margin-bottom: 4px;
                  color: #000;
                }
                .barcode-label-body {
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                  flex: 1;
                }
                .barcode-grid {
                  display: grid;
                  grid-template-columns: 1.1fr 0.9fr;
                  row-gap: 2px;
                  column-gap: 6px;
                }
                .barcode-field {
                  display: flex;
                  flex-direction: column;
                }
                .barcode-field-label {
                  font-size: 5pt;
                  color: #555;
                  text-transform: uppercase;
                  font-weight: bold;
                  line-height: 1;
                }
                .barcode-field-value {
                  font-size: 7.5pt;
                  font-weight: bold;
                  color: #000;
                  line-height: 1.1;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                }
                .barcode-svg-container {
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  margin-top: 2px;
                }
                .barcode-svg-container svg {
                  width: 2.10in !important;
                  height: 0.40in !important;
                  display: block;
                }
                .barcode-footer {
                  text-align: center;
                  font-size: 5pt;
                  color: #555;
                  border-top: 1px solid #000;
                  padding-top: 2px;
                  margin-top: 2px;
                  line-height: 1;
                }
              </style>
            </head>
            <body>
              <div class="barcode-label">
                <div class="barcode-label-header">TEXTILE WAREHOUSE MANAGEMENT</div>
                <div class="barcode-label-body">
                  <div class="barcode-grid">
                    <div class="barcode-field">
                      <div class="barcode-field-label">Material Code</div>
                      <div class="barcode-field-value">${hiddenQr.matCode}</div>
                    </div>
                    <div class="barcode-field">
                      <div class="barcode-field-label">Material Name</div>
                      <div class="barcode-field-value">${hiddenQr.matName}</div>
                    </div>
                    <div class="barcode-field">
                      <div class="barcode-field-label">Weight/Rolls</div>
                      <div class="barcode-field-value">${hiddenQr.weight} Kg | ${hiddenQr.rolls} Roll(s)</div>
                    </div>
                    <div class="barcode-field">
                      <div class="barcode-field-label">Location | GRN</div>
                      <div class="barcode-field-value">${hiddenQr.location} | ${hiddenQr.grnNo}</div>
                    </div>
                  </div>
                  <div class="barcode-svg-container">
                    ${barcodeHtml}
                  </div>
                </div>
                <div class="barcode-footer">Scan Barcode for details</div>
              </div>
            </body>
          </html>
        `);
        doc.close();

        // Print iframe content
        setTimeout(() => {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          }
          setHiddenQr(null);
        }, 300);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hiddenQr]);

  const handlePrintLabel = async (grnItem) => {
    setError('');
    const mat = materials.find(m => m.id == grnItem.materialId);
    if (!mat) {
      setError('Print failed: Material not found in database for this GRN entry.');
      return;
    }
    try {
      await printDirectly('print_grn', {
        matCode: mat.code,
        matName: mat.name,
        weight: mat.weight,
        rolls: grnItem.rolls,
        location: grnItem.location || mat.location,
        grnNo: grnItem.grnNo
      });
    } catch (err) {
      console.warn('Direct print failed, falling back to browser print:', err);
      setHiddenQr({
        matCode: mat.code,
        matName: mat.name,
        weight: mat.weight,
        rolls: grnItem.rolls,
        location: grnItem.location || mat.location,
        grnNo: grnItem.grnNo
      });
    }
  };

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
            <div className="breadcrumb"><span>Home</span><span>/</span><span>Material Receive (GRN)</span></div>
            <h1 style={{ margin: 0 }}>Material Receive — GRN</h1>
            <p style={{ margin: '4px 0 0 0' }}>Record incoming materials and auto-assign warehouse locations.</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20 }}>
        {/* GRN Form */}
        <div>
          <div className="card">
            <div className="card-header">
              <div className="card-title"><PackagePlus size={15} /> New GRN Entry</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {error && (
                <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <AlertTriangle size={15} />
                  <span>{error}</span>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Supplier <span className="required">*</span></label>
                <select className="form-control" id="grn-supplier" value={form.supplier} onChange={e => set('supplier', e.target.value)}>
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">PO Number</label>
                <input className="form-control" id="grn-po" placeholder="e.g. PO-2025-0123" value={form.poNumber} onChange={e => set('poNumber', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Material Name <span className="required">*</span></label>
                <input className="form-control" id="grn-material-name" placeholder="e.g. Cotton Fabric" value={form.materialName} onChange={e => set('materialName', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-control" id="grn-category" value={form.category} onChange={e => handleCategoryChange(e.target.value)}>
                  <option>Summer Fabric</option>
                  <option>Winter Fabric</option>
                  <option>Accessories</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Roll Qty <span className="required">*</span></label>
                  <input className="form-control" id="grn-rolls" type="number" placeholder="e.g. 10" value={form.rolls} onChange={e => handleRollsChange(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Weight (Kg)</label>
                  <input className="form-control" id="grn-weight" type="number" placeholder="e.g. 250" value={form.weight} onChange={e => set('weight', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Location (Shelf) <span className="required">*</span></label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    className="form-control"
                    id="grn-location"
                    placeholder="e.g. A01-S01"
                    value={form.location || ''}
                    onChange={e => set('location', e.target.value)}
                    style={{ flex: 1 }}
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
                      <div className="recommendations-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
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
                <label className="form-label">Invoice Number</label>
                <input className="form-control" id="grn-invoice" placeholder="e.g. INV-8845" value={form.invoiceNo} onChange={e => set('invoiceNo', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Received Date</label>
                  <input className="form-control" id="grn-date" type="date" value={form.receivedDate} onChange={e => set('receivedDate', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Received By</label>
                  <input className="form-control" id="grn-received-by" value={form.receivedBy} onChange={e => set('receivedBy', e.target.value)} />
                </div>
              </div>

              <div className="alert alert-info" style={{ fontSize: 12 }}>
                <MapPin size={14} />
                <div>
                  <b>Location Assignment:</b> System auto-selects the best shelf. You can override it by using the Recommendation helper above.
                </div>
              </div>

              <button className="btn btn-primary btn-lg" id="save-grn-btn" onClick={handleSubmit}>
                <Save size={16} /> Save GRN & Generate QR
              </button>
            </div>
          </div>

          {/* Success Panel */}
          {saved && (
            <div className="card" style={{ marginTop: 16, border: '2px solid var(--success)', borderRadius: 'var(--radius-lg)' }}>
              <div className="card-header" style={{ background: '#ecfdf5' }}>
                <div className="card-title" style={{ color: 'var(--success)' }}>
                  <CheckCircle size={16} /> GRN Saved Successfully
                </div>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSaved(null)}><X size={16} /></button>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>GRN No.</div>
                    <div style={{ fontWeight: 700 }}>{saved.grnNo}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Material Code</div>
                    <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{saved.material?.code}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Assigned Location</div>
                    <div style={{ fontWeight: 700 }}>{saved.location}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Roll Qty</div>
                    <div style={{ fontWeight: 700 }}>{saved.rolls} Roll(s)</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="btn btn-secondary btn-sm" id="view-qr-btn" onClick={() => setShowQR(saved)}>
                    <QrCode size={13} /> View QR Code
                  </button>
                  <button className="btn btn-primary btn-sm" id="print-grn-label-btn" onClick={() => handlePrintLabel(saved)}>
                    <Printer size={13} /> Print Label
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* GRN History */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">GRN History</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{grns.length} records</span>
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div className="table-wrap" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>GRN No.</th>
                    <th>Material</th>
                    <th>Supplier</th>
                    <th>Roll Qty</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {grns.slice(0, 20).map(grn => (
                    <tr key={grn.id}>
                      <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>{grn.grnNo}</td>
                      <td style={{ fontSize: 12 }}>
                        <div>{getMaterialName(grn.materialId)}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>PO: {grn.poNumber || '—'}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{getSupplierName(grn.supplier)}</td>
                      <td style={{ fontWeight: 600 }}>{grn.rolls} Roll(s)</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{grn.receivedDate}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '4px 8px' }}
                          id={`print-grn-${grn.id}`}
                          onClick={() => handlePrintLabel(grn)}>
                          <Printer size={12} /> Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode Modal */}
      {showQR && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <style>{`
              .barcode-label {
                width: 2.40in;
                height: 1.60in;
                padding: 8px 10px;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                background: white;
                color: black;
                font-family: Arial, sans-serif;
              }
              .barcode-label-header {
                text-align: center;
                font-weight: bold;
                font-size: 7.5pt;
                line-height: 1.1;
                border-bottom: 1px solid #000;
                padding-bottom: 2px;
                margin-bottom: 4px;
                color: #000;
              }
              .barcode-label-body {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                flex: 1;
              }
              .barcode-grid {
                display: grid;
                grid-template-columns: 1.1fr 0.9fr;
                row-gap: 2px;
                column-gap: 6px;
              }
              .barcode-field {
                display: flex;
                flex-direction: column;
              }
              .barcode-field-label {
                font-size: 5.5pt;
                color: #555;
                text-transform: uppercase;
                font-weight: bold;
                line-height: 1;
              }
              .barcode-field-value {
                font-size: 7.5pt;
                font-weight: bold;
                color: #000;
                line-height: 1.1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .barcode-svg-container {
                display: flex;
                justify-content: center;
                align-items: center;
                margin-top: 2px;
              }
              .barcode-svg-container svg {
                width: 2.0in !important;
                height: 0.40in !important;
                display: block;
              }
              .barcode-footer {
                text-align: center;
                font-size: 5.5pt;
                color: #555;
                border-top: 1px solid #000;
                padding-top: 2px;
                margin-top: 2px;
                line-height: 1;
              }
            `}</style>
            <div className="modal-header">
              <div className="modal-title"><QrCode size={18} /> Barcode Label — {showQR.grnNo}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowQR(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="barcode-label" style={{ border: '1px solid var(--border)' }}>
                <div className="barcode-label-header">TEXTILE WAREHOUSE MANAGEMENT</div>
                <div className="barcode-label-body">
                  <div className="barcode-grid">
                    <div className="barcode-field">
                      <div className="barcode-field-label">GRN No.</div>
                      <div className="barcode-field-value" style={{ color: 'var(--primary)' }}>{showQR.grnNo}</div>
                    </div>
                    <div className="barcode-field">
                      <div className="barcode-field-label">Material</div>
                      <div className="barcode-field-value">{showQR.material?.name}</div>
                    </div>
                    <div className="barcode-field">
                      <div className="barcode-field-label">Roll Qty</div>
                      <div className="barcode-field-value">{showQR.rolls} Roll(s)</div>
                    </div>
                    <div className="barcode-field">
                      <div className="barcode-field-label">Location</div>
                      <div className="barcode-field-value">{showQR.location}</div>
                    </div>
                  </div>
                  <div className="barcode-svg-container" style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
                    <Barcode value={showQR.grnNo} width={1.8} height={32} displayValue={true} />
                  </div>
                </div>
                <div className="barcode-footer" style={{ textAlign: 'center', fontSize: 7, color: '#666', borderTop: '1px solid #ccc', paddingTop: 4, marginTop: 4 }}>
                  Scan Barcode for details
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowQR(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => { handlePrintLabel(showQR); setShowQR(false); }}>🖨️ Print Sticker</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Barcode for background printing serialization */}
      <div style={{ display: 'none' }} id="hidden-grn-barcode">
        {hiddenQr && <Barcode value={hiddenQr.grnNo} width={1.8} height={32} displayValue={true} />}
      </div>
    </div>
  );
}
