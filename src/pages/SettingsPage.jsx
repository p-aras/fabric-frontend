import { useState, useEffect } from 'react';
import { store } from '../store.js';
import { Settings, Warehouse, Plus, Edit, Trash2, Save, X, Building2, Package, Bell, Moon, Sun, Globe, Lock, History, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SettingsPage({ darkMode, toggleDark }) {
  const [tab, setTab] = useState('warehouse');
  const [rooms, setRooms] = useState([]);
  const [floors, setFloors] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [racks, setRacks] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [editRoom, setEditRoom] = useState(null);
  const [editSupplier, setEditSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact: '', phone: '', email: '', city: '', country: '', category: 'Cotton Fabric', status: 'Active' });
  const [showSupForm, setShowSupForm] = useState(false);
  const [rackRoom, setRackRoom] = useState('');
  const [shelfRack, setShelfRack] = useState('');
  const [shelfCap, setShelfCap] = useState(500);
  const [deleteRackId, setDeleteRackId] = useState('');
  const [deleteShelfId, setDeleteShelfId] = useState('');
  const [appSettings, setAppSettings] = useState({
    companyName: 'Textile Factory Ltd.',
    warehouseAddress: '123 Industrial Zone, Karachi',
    lowStockAlert: 50,
    emailNotifications: true,
    language: 'English',
  });

  // Dynamic Room and Floor settings states
  const [newRoomForm, setNewRoomForm] = useState({ id: '', name: '', category: 'Summer Fabric', description: '', color: '#3b82f6', floor: '' });
  const [editRoomForm, setEditRoomForm] = useState(null);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');
  const [renamingFloor, setRenamingFloor] = useState(null);
  const [renameFloorInput, setRenameFloorInput] = useState('');
  const [deleteConfirmFloor, setDeleteConfirmFloor] = useState(null);
  const [alertPopup, setAlertPopup] = useState(null);
  const [confirmPopup, setConfirmPopup] = useState(null);

  const load = () => {
    let active = true;
    const loadSettings = async () => {
      try {
        const [loadedRooms, loadedSuppliers, loadedAudit, loadedFloors, loadedRacks, loadedShelves] = await Promise.all([
          store.getRooms(),
          store.getSuppliers(),
          store.getAuditLog(),
          store.getFloors(),
          store.getRacks(),
          store.getShelves()
        ]);
        if (!active) return;
        setRooms(loadedRooms || []);
        setSuppliers(loadedSuppliers || []);
        setAuditLog(loadedAudit || []);
        setFloors(loadedFloors || []);
        setRacks(loadedRacks || []);
        setShelves(loadedShelves || []);

        if (loadedRooms && loadedRooms.length > 0 && !rackRoom) {
          setRackRoom(loadedRooms[0].id);
        }
        if (loadedFloors && loadedFloors.length > 0) {
          setNewRoomForm(f => ({ ...f, floor: f.floor || loadedFloors[0] }));
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadSettings();
    return () => { active = false; };
  };
  useEffect(load, []);

  const handleSaveRoom = async () => {
    if (!newRoomForm.id || newRoomForm.id.length !== 1) {
      return setAlertPopup({ title: 'Validation Error', message: 'Hall Code must be a single uppercase letter (A-Z).', type: 'danger' });
    }
    const code = newRoomForm.id.toUpperCase();
    if (!/^[A-Z]$/.test(code)) {
      return setAlertPopup({ title: 'Validation Error', message: 'Hall Code must be a single uppercase letter (A-Z).', type: 'danger' });
    }
    if (!newRoomForm.name) {
      return setAlertPopup({ title: 'Validation Error', message: 'Hall Name is required.', type: 'danger' });
    }
    if (!newRoomForm.floor) {
      return setAlertPopup({ title: 'Validation Error', message: 'Please select or add a floor first.', type: 'danger' });
    }
    try {
      await store.addRoom({
        ...newRoomForm,
        id: code
      });
      setAlertPopup({
        title: 'Work Done',
        message: `Successfully added Room ${newRoomForm.name} (${code})!`,
        type: 'success'
      });
      setNewRoomForm({ id: '', name: '', category: 'Summer Fabric', description: '', color: '#3b82f6', floor: floors[0] || '' });
      setShowRoomForm(false);
      load();
    } catch (err) {
      setAlertPopup({ title: 'Operation Failed', message: err.message, type: 'danger' });
    }
  };

  const handleUpdateRoom = async () => {
    if (!editRoomForm.name) {
      return setAlertPopup({ title: 'Validation Error', message: 'Hall Name is required.', type: 'danger' });
    }
    try {
      await store.updateRoom(editRoomForm.id, editRoomForm);
      setAlertPopup({
        title: 'Work Done',
        message: `Successfully updated Hall ${editRoomForm.id}!`,
        type: 'success'
      });
      setEditRoomForm(null);
      load();
    } catch (err) {
      setAlertPopup({ title: 'Operation Failed', message: err.message, type: 'danger' });
    }
  };

  const handleDeleteRoom = (id) => {
    setConfirmPopup({
      title: 'Delete Hall',
      message: `Are you sure you want to delete Hall ${id}? This will also fail if it contains racks.`,
      onConfirm: async () => {
        try {
          await store.deleteRoom(id);
          setAlertPopup({
            title: 'Work Done',
            message: `Successfully deleted Hall ${id}.`,
            type: 'success'
          });
          load();
        } catch (err) {
          setAlertPopup({ title: 'Operation Failed', message: err.message, type: 'danger' });
        }
      }
    });
  };

  const handleAddFloor = async () => {
    if (!newFloorName.trim()) {
      return setAlertPopup({ title: 'Validation Error', message: 'Floor name cannot be empty.', type: 'danger' });
    }
    try {
      await store.addFloor(newFloorName.trim());
      setAlertPopup({
        title: 'Work Done',
        message: `Floor "${newFloorName.trim()}" added successfully.`,
        type: 'success'
      });
      setNewFloorName('');
      load();
    } catch (err) {
      setAlertPopup({ title: 'Operation Failed', message: err.message, type: 'danger' });
    }
  };

  const handleDeleteFloor = (name) => {
    setConfirmPopup({
      title: 'Delete Floor',
      message: `Are you sure you want to delete floor "${name}"?`,
      onConfirm: async () => {
        try {
          await store.deleteFloor(name);
          setAlertPopup({
            title: 'Work Done',
            message: `Floor "${name}" deleted successfully.`,
            type: 'success'
          });
          load();
        } catch (err) {
          setAlertPopup({ title: 'Operation Failed', message: err.message, type: 'danger' });
        }
      }
    });
  };

  const handleRenameFloor = async (oldName) => {
    if (!renameFloorInput.trim()) {
      return setAlertPopup({ title: 'Validation Error', message: 'Floor name cannot be empty.', type: 'danger' });
    }
    try {
      await store.renameFloor(oldName, renameFloorInput.trim());
      setAlertPopup({
        title: 'Work Done',
        message: `Floor "${oldName}" renamed to "${renameFloorInput.trim()}" successfully.`,
        type: 'success'
      });
      setRenamingFloor(null);
      load();
    } catch (err) {
      setAlertPopup({ title: 'Operation Failed', message: err.message, type: 'danger' });
    }
  };

  const handleAddRack = async () => {
    try {
      const existingRacks = await store.getRacksByRoom(rackRoom);
      const nextNum = existingRacks.length + 1;
      const newRack = {
        id: `${rackRoom}${String(nextNum).padStart(2, '0')}`,
        room: rackRoom,
        number: nextNum,
        name: `Hall ${String(nextNum).padStart(2, '0')}`
      };
      await store.addRack(newRack);
      setAlertPopup({
        title: 'Work Done',
        message: `Successfully added Rack ${newRack.id} to ${rooms.find(r => r.id === rackRoom)?.name || rackRoom}!`,
        type: 'success'
      });
      load();
    } catch (err) {
      setAlertPopup({ title: 'Operation Failed', message: err.message, type: 'danger' });
    }
  };

  const handleAddShelf = async () => {
    if (!shelfRack) return;
    try {
      const existingShelves = await store.getShelvesForRack(shelfRack);
      const nextNum = existingShelves.length + 1;
      const newShelf = {
        id: `${shelfRack}-S${String(nextNum).padStart(2, '0')}`,
        rack: shelfRack,
        room: shelfRack.charAt(0),
        number: nextNum,
        name: `Shelf S${String(nextNum).padStart(2, '0')}`,
        capacity: parseInt(shelfCap) || 500,
        used: 0
      };
      await store.addShelf(newShelf);
      setAlertPopup({
        title: 'Work Done',
        message: `Successfully added Shelf ${newShelf.id} to Rack ${shelfRack}!`,
        type: 'success'
      });
      load();
    } catch (err) {
      setAlertPopup({ title: 'Operation Failed', message: err.message, type: 'danger' });
    }
  };

  const handleRemoveRack = () => {
    if (!deleteRackId) return;
    setConfirmPopup({
      title: 'Remove Rack',
      message: `Are you sure you want to remove Rack ${deleteRackId} and all its shelves? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await store.deleteRack(deleteRackId);
          setAlertPopup({
            title: 'Work Done',
            message: `Successfully removed Rack ${deleteRackId}.`,
            type: 'success'
          });
          setDeleteRackId('');
          load();
        } catch (err) {
          setAlertPopup({ title: 'Operation Failed', message: err.message, type: 'danger' });
        }
      }
    });
  };

  const handleRemoveShelf = () => {
    if (!deleteShelfId) return;
    setConfirmPopup({
      title: 'Remove Shelf',
      message: `Are you sure you want to remove Shelf ${deleteShelfId}? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await store.deleteShelf(deleteShelfId);
          setAlertPopup({
            title: 'Work Done',
            message: `Successfully removed Shelf ${deleteShelfId}.`,
            type: 'success'
          });
          setDeleteShelfId('');
          load();
        } catch (err) {
          setAlertPopup({ title: 'Operation Failed', message: err.message, type: 'danger' });
        }
      }
    });
  };

  const handleSaveSupplier = async () => {
    if (!supplierForm.name) {
      return setAlertPopup({ title: 'Validation Error', message: 'Supplier name is required.', type: 'danger' });
    }
    try {
      if (editSupplier?.id) {
        await store.updateSupplier(editSupplier.id, supplierForm);
        setAlertPopup({
          title: 'Work Done',
          message: `Supplier "${supplierForm.name}" updated successfully.`,
          type: 'success'
        });
      } else {
        await store.addSupplier(supplierForm);
        setAlertPopup({
          title: 'Work Done',
          message: `Supplier "${supplierForm.name}" added successfully.`,
          type: 'success'
        });
      }
      setShowSupForm(false);
      setEditSupplier(null);
      setSupplierForm({ name: '', contact: '', phone: '', email: '', city: '', country: '', category: 'Cotton Fabric', status: 'Active' });
      load();
    } catch (err) {
      setAlertPopup({ title: 'Operation Failed', message: err.message, type: 'danger' });
    }
  };

  const handleDeleteSupplier = (id) => {
    setConfirmPopup({
      title: 'Delete Supplier',
      message: 'Are you sure you want to delete this supplier?',
      onConfirm: async () => {
        try {
          await store.deleteSupplier(id);
          setAlertPopup({
            title: 'Work Done',
            message: 'Supplier deleted successfully.',
            type: 'success'
          });
          load();
        } catch (err) {
          setAlertPopup({ title: 'Operation Failed', message: err.message, type: 'danger' });
        }
      }
    });
  };

  const TABS = [
    { id: 'warehouse', label: 'Warehouse Setup', icon: Warehouse },
    { id: 'suppliers', label: 'Suppliers', icon: Building2 },
    { id: 'notifications', label: 'App Settings', icon: Settings },
    { id: 'audit', label: 'Audit Log', icon: History },
  ];

  const LOG_COLORS = { receive: '#10b981', issue: '#ef4444', transfer: '#f59e0b', create: '#1a56db', auth: '#8b5cf6', delete: '#dc2626' };
  const LOG_ICONS = { receive: '📦', issue: '📤', transfer: '🔄', create: '✨', auth: '🔑', delete: '🗑️' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div className="page-title-block">
          <div className="breadcrumb"><span>Home</span><span>/</span><span>Settings</span></div>
          <h1>Settings</h1>
          <p>Configure warehouse setup, suppliers and system preferences.</p>
        </div>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button key={t.id} id={`settings-tab-${t.id}`}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* WAREHOUSE SETUP */}
      {tab === 'warehouse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 10 }}>
            <button className="btn btn-primary" onClick={() => {
              setNewRoomForm({ id: '', name: '', category: 'Summer Fabric', description: '', color: '#3b82f6', floor: floors[0] || '' });
              setShowRoomForm(!showRoomForm);
            }}>
              <Plus size={16} /> {showRoomForm ? 'Cancel' : 'Add New Hall'}
            </button>
          </div>

          {showRoomForm && (
            <div className="card" style={{ marginBottom: 10 }}>
              <div className="card-header">
                <div className="card-title"><Building2 size={15} /> Add New Room/Hall</div>
              </div>
              <div className="card-body">
                <div className="form-grid form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Hall Code (Single letter A-Z) <span className="required">*</span></label>
                    <input className="form-control" value={newRoomForm.id} maxLength={1}
                      onChange={e => setNewRoomForm({ ...newRoomForm, id: e.target.value.toUpperCase() })} placeholder="e.g. D" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hall Name <span className="required">*</span></label>
                    <input className="form-control" value={newRoomForm.name}
                      onChange={e => setNewRoomForm({ ...newRoomForm, name: e.target.value })} placeholder="e.g. Hall 4" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Designated Floor <span className="required">*</span></label>
                    <select className="form-control" value={newRoomForm.floor}
                      onChange={e => setNewRoomForm({ ...newRoomForm, floor: e.target.value })}>
                      <option value="">-- Select Floor --</option>
                      {floors.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-control" value={newRoomForm.category}
                      onChange={e => setNewRoomForm({ ...newRoomForm, category: e.target.value })}>
                      <option>Summer Fabric</option>
                      <option>Winter Fabric</option>
                      <option>Accessories</option>
                      <option>Cotton Fabric</option>
                      <option>Polyester Fabric</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Theme Color</label>
                    <select className="form-control" value={newRoomForm.color}
                      onChange={e => setNewRoomForm({ ...newRoomForm, color: e.target.value })}>
                      <option value="#3b82f6">Blue</option>
                      <option value="#8b5cf6">Purple</option>
                      <option value="#f59e0b">Yellow</option>
                      <option value="#10b981">Green</option>
                      <option value="#ef4444">Red</option>
                      <option value="#ec4899">Pink</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <input className="form-control" value={newRoomForm.description}
                      onChange={e => setNewRoomForm({ ...newRoomForm, description: e.target.value })} placeholder="Brief description..." />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button className="btn btn-secondary" onClick={() => setShowRoomForm(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSaveRoom}><Save size={14} /> Add Hall</button>
                </div>
              </div>
            </div>
          )}

          {editRoomForm && (
            <div className="modal-overlay">
              <div className="modal" style={{ maxWidth: 500, flexDirection: 'column' }}>
                <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="card-title"><Edit size={16} /> Edit Hall: {editRoomForm.id}</div>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditRoomForm(null)}><X size={16} /></button>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Hall Code (Cannot be changed)</label>
                    <input className="form-control" value={editRoomForm.id} disabled />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hall Name <span className="required">*</span></label>
                    <input className="form-control" value={editRoomForm.name}
                      onChange={e => setEditRoomForm({ ...editRoomForm, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Designated Floor <span className="required">*</span></label>
                    <select className="form-control" value={editRoomForm.floor}
                      onChange={e => setEditRoomForm({ ...editRoomForm, floor: e.target.value })}>
                      {floors.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-control" value={editRoomForm.category}
                      onChange={e => setEditRoomForm({ ...editRoomForm, category: e.target.value })}>
                      <option>Summer Fabric</option>
                      <option>Winter Fabric</option>
                      <option>Accessories</option>
                      <option>Cotton Fabric</option>
                      <option>Polyester Fabric</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Theme Color</label>
                    <select className="form-control" value={editRoomForm.color}
                      onChange={e => setEditRoomForm({ ...editRoomForm, color: e.target.value })}>
                      <option value="#3b82f6">Blue</option>
                      <option value="#8b5cf6">Purple</option>
                      <option value="#f59e0b">Yellow</option>
                      <option value="#10b981">Green</option>
                      <option value="#ef4444">Red</option>
                      <option value="#ec4899">Pink</option>
                    </select>
                  </div>
                </div>
                <div className="card-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => setEditRoomForm(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleUpdateRoom}><Save size={14} /> Save Changes</button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-3">
            {rooms.map(r => {
              const rackCount = racks.filter(rk => rk.room === r.id).length;
              const shelfCount = shelves.filter(s => s.room === r.id).length;
              return (
                <div key={r.id} className="card" style={{ borderTop: `3px solid ${r.color}` }}>
                  <div className="card-header">
                    <div className="card-title" style={{ color: r.color }}><Warehouse size={15} /> {r.name}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ width: 28, height: 28, padding: 0 }}
                        onClick={() => setEditRoomForm(r)} title="Edit Hall">
                        <Edit size={12} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ width: 28, height: 28, padding: 0, color: 'var(--danger)' }}
                        onClick={() => handleDeleteRoom(r.id)} title="Delete Hall">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: r.color }}>{rackCount}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Racks</div>
                      </div>
                      <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: r.color }}>{shelfCount}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Shelves</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Floor:</span>
                        <span style={{ fontWeight: 600 }}>{r.floor || 'No Floor'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Category:</span>
                        <span style={{ fontWeight: 600 }}>{r.category}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Capacity:</span>
                        <span style={{ fontWeight: 600, color: 'var(--success)' }}>{(shelfCount * 500).toLocaleString()} Rolls</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 10px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                      Location format: <b>{r.id}01-S01</b> to <b>{r.id}{String(rackCount).padStart(2, '0')}-S{String(shelves.filter(s => s.room === r.id && s.rack === `${r.id}01`).length).padStart(2, '0')}</b>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* EXPAND WAREHOUSE FORM */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Plus size={15} /> Expand Warehouse (Manage Racks & Shelves)</div>
            </div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Add Rack Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius-md)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Warehouse size={16} /> Add New Rack</h3>
                <div className="form-group">
                  <label className="form-label">Select Room / Hall</label>
                  <select className="form-control" value={rackRoom} onChange={e => setRackRoom(e.target.value)}>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.category})</option>)}
                  </select>
                </div>
                <button className="btn btn-primary" onClick={handleAddRack} style={{ marginTop: 8 }}>
                  <Plus size={14} /> Add Rack
                </button>
              </div>

              {/* Add Shelf Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius-md)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Package size={16} /> Add New Shelf</h3>
                <div className="form-group">
                  <label className="form-label">Select Rack</label>
                  <select className="form-control" value={shelfRack} onChange={e => setShelfRack(e.target.value)}>
                    <option value="">-- Choose Rack --</option>
                    {racks.map(r => {
                      const roomName = rooms.find(rm => rm.id === r.room)?.name || r.room;
                      return <option key={r.id} value={r.id}>{roomName} — Rack {r.id}</option>;
                    })}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Shelf Capacity (Rolls)</label>
                  <input className="form-control" type="number" value={shelfCap} onChange={e => setShelfCap(e.target.value)} placeholder="e.g. 500" />
                </div>
                <button className="btn btn-primary" onClick={handleAddShelf} style={{ marginTop: 8 }} disabled={!shelfRack}>
                  <Plus size={14} /> Add Shelf
                </button>
              </div>

              {/* Remove Rack Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius-md)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)' }}><Trash2 size={16} /> Remove Rack</h3>
                <div className="form-group">
                  <label className="form-label">Select Rack to Remove</label>
                  <select className="form-control" value={deleteRackId} onChange={e => setDeleteRackId(e.target.value)}>
                    <option value="">-- Choose Rack --</option>
                    {racks.map(r => {
                      const roomName = rooms.find(rm => rm.id === r.room)?.name || r.room;
                      return <option key={r.id} value={r.id}>{roomName} — Rack {r.id}</option>;
                    })}
                  </select>
                </div>
                <button className="btn btn-danger" onClick={handleRemoveRack} style={{ marginTop: 8 }} disabled={!deleteRackId}>
                  <Trash2 size={14} /> Remove Rack
                </button>
              </div>

              {/* Remove Shelf Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius-md)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)' }}><Trash2 size={16} /> Remove Shelf</h3>
                <div className="form-group">
                  <label className="form-label">Select Shelf to Remove</label>
                  <select className="form-control" value={deleteShelfId} onChange={e => setDeleteShelfId(e.target.value)}>
                    <option value="">-- Choose Shelf --</option>
                    {shelves.map(s => {
                      const roomName = rooms.find(rm => rm.id === s.room)?.name || s.room;
                      return <option key={s.id} value={s.id}>{roomName} — {s.id} (Used: {s.used}/{s.capacity})</option>;
                    })}
                  </select>
                </div>
                <button className="btn btn-danger" onClick={handleRemoveShelf} style={{ marginTop: 8 }} disabled={!deleteShelfId}>
                  <Trash2 size={14} /> Remove Shelf
                </button>
              </div>
            </div>
          </div>

          {/* MANAGE FLOORS */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Building2 size={15} /> Manage Floors</div>
            </div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20 }}>
              {/* Add Floor Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius-md)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={16} /> Add New Floor</h3>
                <div className="form-group">
                  <label className="form-label">Floor Name</label>
                  <input className="form-control" value={newFloorName} onChange={e => setNewFloorName(e.target.value)} placeholder="e.g. 3rd Floor" />
                </div>
                <button className="btn btn-primary" onClick={handleAddFloor} style={{ marginTop: 8 }}>
                  <Plus size={14} /> Add Floor
                </button>
              </div>

              {/* Floors List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius-md)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Building2 size={16} /> Existing Floors</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                  {floors.map(f => {
                    const roomsOnFloor = rooms.filter(r => r.floor === f);
                    const isUsed = roomsOnFloor.length > 0;
                    return (
                      <div key={f} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)'
                      }}>
                        {renamingFloor === f ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
                            <input
                              className="form-control"
                              style={{ padding: '4px 8px', fontSize: 13, height: 32, flex: 1 }}
                              value={renameFloorInput}
                              onChange={e => setRenameFloorInput(e.target.value)}
                            />
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ padding: '4px 8px', height: 32 }}
                              onClick={() => handleRenameFloor(f)}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', height: 32 }}
                              onClick={() => setRenamingFloor(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : deleteConfirmFloor === f ? (
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>
                              Delete floor "{f}"?
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="btn btn-danger btn-sm"
                                style={{ padding: '2px 8px', height: 26, fontSize: 11 }}
                                onClick={() => {
                                  store.deleteFloor(f).then(() => {
                                    setDeleteConfirmFloor(null);
                                    setAlertPopup({
                                      title: 'Work Done',
                                      message: `Floor "${f}" deleted successfully.`,
                                      type: 'success'
                                    });
                                    load();
                                  }).catch(err => {
                                    setAlertPopup({ title: 'Operation Failed', message: err.message, type: 'danger' });
                                  });
                                }}
                              >
                                Yes
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 8px', height: 26, fontSize: 11 }}
                                onClick={() => setDeleteConfirmFloor(null)}
                              >
                                No
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{f}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {roomsOnFloor.length} Hall(s) assigned
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                style={{ width: 28, height: 28, padding: 0 }}
                                onClick={() => {
                                  setRenamingFloor(f);
                                  setRenameFloorInput(f);
                                  setDeleteConfirmFloor(null);
                                }}
                                title="Rename Floor"
                              >
                                <Edit size={12} />
                              </button>
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                style={{ color: 'var(--danger)', width: 28, height: 28, padding: 0 }}
                                onClick={() => {
                                  if (isUsed) {
                                    setAlertPopup({
                                      title: 'Delete Floor Error',
                                      message: `Cannot delete floor "${f}": rooms are assigned to it.`,
                                      type: 'danger'
                                    });
                                  } else {
                                    setDeleteConfirmFloor(f);
                                    setRenamingFloor(null);
                                  }
                                }}
                                title={isUsed ? "Cannot delete floor: rooms are assigned to it" : "Delete Floor"}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {floors.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
                      No floors configured. Add a floor to get started.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Shelf Capacity Settings Info */}
          <div className="card">
            <div className="card-header"><div className="card-title"><Package size={15} /> Shelf Capacity Configuration</div></div>
            <div className="card-body">
              <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 13 }}>
                <Settings size={14} />
                Each shelf has a standard capacity of <b>500 Rolls</b>. The system automatically assigns locations based on available capacity and material category.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { label: 'Total Rooms', value: rooms.length },
                  { label: 'Total Racks', value: racks.length },
                  { label: 'Total Shelves', value: shelves.length },
                  { label: 'Total Capacity', value: `${(shelves.reduce((sum, s) => sum + s.capacity, 0)).toLocaleString()} Rolls` },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--bg)', padding: '14px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIERS */}
      {tab === 'suppliers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" id="add-supplier-btn"
              onClick={() => { setEditSupplier(null); setSupplierForm({ name: '', contact: '', phone: '', email: '', city: '', country: '', category: 'Cotton Fabric', status: 'Active' }); setShowSupForm(true); }}>
              <Plus size={16} /> Add Supplier
            </button>
          </div>

          {showSupForm && (
            <div className="card">
              <div className="card-header">
                <div className="card-title"><Building2 size={15} /> {editSupplier ? 'Edit Supplier' : 'New Supplier'}</div>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setShowSupForm(false); setEditSupplier(null); }}><X size={16} /></button>
              </div>
              <div className="card-body">
                <div className="form-grid form-grid-3" style={{ gap: 14 }}>
                  <div className="form-group" style={{ gridColumn: 'span 1' }}>
                    <label className="form-label">Supplier Name <span className="required">*</span></label>
                    <input className="form-control" value={supplierForm.name} onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))} placeholder="Supplier company name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Person</label>
                    <input className="form-control" value={supplierForm.contact} onChange={e => setSupplierForm(f => ({ ...f, contact: e.target.value }))} placeholder="Contact name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-control" value={supplierForm.phone} onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))} placeholder="+92-300-..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-control" type="email" value={supplierForm.email} onChange={e => setSupplierForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input className="form-control" value={supplierForm.city} onChange={e => setSupplierForm(f => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Country</label>
                    <input className="form-control" value={supplierForm.country} onChange={e => setSupplierForm(f => ({ ...f, country: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-control" value={supplierForm.category} onChange={e => setSupplierForm(f => ({ ...f, category: e.target.value }))}>
                      <option>Cotton Fabric</option>
                      <option>Polyester Fabric</option>
                      <option>Winter Fabric</option>
                      <option>Accessories</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-control" value={supplierForm.status} onChange={e => setSupplierForm(f => ({ ...f, status: e.target.value }))}>
                      <option>Active</option>
                      <option>Inactive</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button className="btn btn-secondary" onClick={() => { setShowSupForm(false); setEditSupplier(null); }}>Cancel</button>
                  <button className="btn btn-primary" id="save-supplier-btn" onClick={handleSaveSupplier}><Save size={14} /> Save Supplier</button>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="table-wrap" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr><th>#</th><th>Supplier Name</th><th>Contact</th><th>Phone</th><th>Email</th><th>City</th><th>Category</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {suppliers.map((s, i) => (
                    <tr key={s.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i+1}</td>
                      <td style={{ fontWeight: 700 }}>{s.name}</td>
                      <td style={{ fontSize: 12 }}>{s.contact}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.phone}</td>
                      <td style={{ fontSize: 12, color: 'var(--primary)' }}>{s.email}</td>
                      <td style={{ fontSize: 12 }}>{s.city}, {s.country}</td>
                      <td><span className="badge badge-primary" style={{ fontSize: 11 }}>{s.category}</span></td>
                      <td><span className={`badge ${s.status === 'Active' ? 'badge-success' : 'badge-secondary'}`}>{s.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" id={`edit-sup-${s.id}`}
                            onClick={() => { setEditSupplier(s); setSupplierForm(s); setShowSupForm(true); }}><Edit size={14} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" id={`del-sup-${s.id}`}
                            onClick={() => handleDeleteSupplier(s.id)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* APP SETTINGS */}
      {tab === 'notifications' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title"><Globe size={15} /> General Settings</div></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input className="form-control" value={appSettings.companyName}
                  onChange={e => setAppSettings(s => ({ ...s, companyName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Warehouse Address</label>
                <input className="form-control" value={appSettings.warehouseAddress}
                  onChange={e => setAppSettings(s => ({ ...s, warehouseAddress: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Language</label>
                <select className="form-control" value={appSettings.language}
                  onChange={e => setAppSettings(s => ({ ...s, language: e.target.value }))}>
                  <option>English</option>
                  <option>Urdu</option>
                  <option>Arabic</option>
                  <option>German</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Low Stock Alert Threshold (Rolls)</label>
                <input className="form-control" type="number" value={appSettings.lowStockAlert}
                  onChange={e => setAppSettings(s => ({ ...s, lowStockAlert: parseInt(e.target.value) }))} />
                <div className="form-hint">Alert when stock falls below this roll quantity.</div>
              </div>
              <button className="btn btn-primary" id="save-app-settings-btn" onClick={() => setAlertPopup({ title: 'Work Done', message: 'Settings saved successfully!', type: 'success' })}>
                <Save size={14} /> Save Settings
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header"><div className="card-title">{darkMode ? <Moon size={15} /> : <Sun size={15} />} Appearance</div></div>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Dark Mode</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Switch between light and dark theme</div>
                  </div>
                  <button
                    id="toggle-dark-settings-btn"
                    onClick={toggleDark}
                    style={{
                      width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                      background: darkMode ? 'var(--primary)' : 'var(--border)',
                      position: 'relative', transition: 'var(--transition)',
                    }}>
                    <span style={{
                      position: 'absolute', top: 3, left: darkMode ? 25 : 3, width: 20, height: 20,
                      borderRadius: '50%', background: 'white', transition: 'var(--transition)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
                    }}>
                      {darkMode ? '🌙' : '☀️'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title"><Bell size={15} /> Notifications</div></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Email Notifications', desc: 'Receive alerts via email', key: 'emailNotifications' },
                ].map(item => (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</div>
                    </div>
                    <button
                      id={`toggle-${item.key}`}
                      onClick={() => setAppSettings(s => ({ ...s, [item.key]: !s[item.key] }))}
                      style={{
                        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                        background: appSettings[item.key] ? 'var(--success)' : 'var(--border)',
                        position: 'relative', transition: 'var(--transition)',
                      }}>
                      <span style={{
                        position: 'absolute', top: 2, left: appSettings[item.key] ? 22 : 2, width: 20, height: 20,
                        borderRadius: '50%', background: 'white', transition: 'var(--transition)',
                      }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT LOG */}
      {tab === 'audit' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title"><History size={15} /> Audit Log</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{auditLog.length} entries</span>
          </div>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr><th>Icon</th><th>Action</th><th>Detail</th><th>User</th><th>Date & Time</th></tr>
              </thead>
              <tbody>
                {auditLog.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: 18 }}>{LOG_ICONS[log.type] || '📋'}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: LOG_COLORS[log.type] || 'var(--text-primary)', fontSize: 13 }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{log.detail}</td>
                    <td style={{ fontSize: 12, fontWeight: 500 }}>{log.user}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {alertPopup && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal modal-sm" style={{ padding: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: alertPopup.type === 'success' ? '#ecfdf5' : '#fef2f2',
              color: alertPopup.type === 'success' ? 'var(--success)' : 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {alertPopup.type === 'success' ? <CheckCircle2 size={36} /> : <AlertCircle size={36} />}
            </div>
            
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                {alertPopup.title || 'Notification'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {alertPopup.message}
              </p>
            </div>
            
            <button className={`btn ${alertPopup.type === 'success' ? 'btn-success' : 'btn-danger'}`} 
                    style={{ width: '100%', marginTop: 8 }}
                    onClick={() => setAlertPopup(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      {confirmPopup && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal modal-sm" style={{ padding: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: '#fffbeb',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <AlertCircle size={36} />
            </div>
            
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                {confirmPopup.title || 'Are you sure?'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {confirmPopup.message}
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmPopup(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => {
                confirmPopup.onConfirm();
                setConfirmPopup(null);
              }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
