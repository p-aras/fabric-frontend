import React, { useState, useEffect, useRef } from 'react';

const ReturnStickerGenerator = ({ 
  returnData, 
  onClose, 
  onStickerGenerated,
  parentBatchInfo = null 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSticker, setGeneratedSticker] = useState(null);
  const [newBarcodeId, setNewBarcodeId] = useState(null);
  const [barcodeSequence, setBarcodeSequence] = useState({
    current: 0,
    next: 1,
    lastGenerated: null
  });
  const [isLoadingSequence, setIsLoadingSequence] = useState(true);
  const [printServiceStatus, setPrintServiceStatus] = useState('connecting');
  const [wsReady, setWsReady] = useState(false);
  
  // Editable fields
  const [receivedBy, setReceivedBy] = useState(returnData?.receivedBy || '');
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [location, setLocation] = useState('');
  const [isEditingReceived, setIsEditingReceived] = useState(false);
  const [isEditingAuthorized, setIsEditingAuthorized] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  
  // Location suggestions
  const locationSuggestions = [
    'WAREHOUSE_A',
    'WAREHOUSE_B',
    'WAREHOUSE_C',
    'RETURNED_INVENTORY',
    'QUALITY_CHECK',
    'DAMAGED_GOODS',
    'RECEIVING_DOCK',
    'STORAGE_AREA_1',
    'STORAGE_AREA_2',
    'RETURNS_SECTION'
  ];
  
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  
  const wsRef = useRef(null);
  const stickerRef = useRef(null);

  // Connect to Python Print Service
  useEffect(() => {
    connectToPrintService();
    
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);

  // Load next return barcode ID (R-prefix)
  useEffect(() => {
    if (returnData) {
      loadNextReturnBarcodeId();
      // Set default values for editable fields
      if (!returnData.receivedBy) {
        setReceivedBy('');
      }
      // Set default location
      setLocation('RETURNED_INVENTORY');
    }
  }, [returnData]);

  const connectToPrintService = () => {
    const WS_URL = 'ws://localhost:8765';
    
    try {
      wsRef.current = new WebSocket(WS_URL);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connection established');
        setPrintServiceStatus('connected');
        
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'auth',
            token: 'fabric-print-secret-key-2024'
          }));
        }
      };
      
      wsRef.current.onmessage = (event) => {
        const response = JSON.parse(event.data);
        
        switch(response.type) {
          case 'auth_success':
            console.log('Authentication successful');
            setPrintServiceStatus('ready');
            setWsReady(true);
            showNotification('Print service connected', 'success');
            break;
            
          case 'auth_failed':
            console.error('Authentication failed');
            setPrintServiceStatus('error');
            setWsReady(false);
            break;
            
          case 'print_result':
            if (response.success) {
              console.log('Print successful:', response.message);
              showNotification('✓ Return sticker printed successfully!', 'success');
            } else {
              console.error('Print failed:', response.message);
              showNotification(`✗ Print failed: ${response.message}`, 'error');
            }
            break;
            
          case 'error':
            console.error('Service error:', response.message);
            showNotification(`Error: ${response.message}`, 'error');
            break;
            
          default:
            console.log('Unknown message type:', response);
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setPrintServiceStatus('error');
        setWsReady(false);
      };
      
      wsRef.current.onclose = () => {
        console.log('Disconnected from print service');
        setPrintServiceStatus('disconnected');
        setWsReady(false);
        setTimeout(connectToPrintService, 5000);
      };
      
    } catch (error) {
      console.error('Failed to connect:', error);
      setPrintServiceStatus('error');
      setWsReady(false);
    }
  };

  const printViaPythonService = (stickerData) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log('WebSocket state:', wsRef.current?.readyState);
      showNotification('Print service not connected. Please check if service is running.', 'error');
      return false;
    }
    
    if (printServiceStatus !== 'ready') {
      showNotification('Print service not ready. Please wait for connection.', 'error');
      return false;
    }
    
    try {
      wsRef.current.send(JSON.stringify({
        type: 'print',
        data: stickerData
      }));
      return true;
    } catch (error) {
      console.error('Failed to send print job:', error);
      showNotification('Failed to send print job.', 'error');
      return false;
    }
  };

  const showNotification = (message, type = 'info') => {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  };

  // Load next RETURN barcode ID (R-prefix)
  const loadNextReturnBarcodeId = async () => {
    try {
      setIsLoadingSequence(true);
      const response = await fetch('http://localhost:5001/api/fabric-receiving/next-return-barcode');
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const resData = await response.json();
      
      if (resData.success) {
        const { barcodeId, numericId, lastId } = resData.data;
        setNewBarcodeId(barcodeId);
        setBarcodeSequence({
          current: lastId || 0,
          next: numericId,
          lastGenerated: barcodeId
        });
        console.log(`📋 Loaded next RETURN barcode ID: ${barcodeId} (Sequence: ${numericId})`);
        return barcodeId;
      } else {
        console.error('Failed to get next return barcode ID, using fallback');
        return getFallbackBarcodeId();
      }
    } catch (error) {
      console.error('Error loading next return barcode ID:', error);
      return getFallbackBarcodeId();
    } finally {
      setIsLoadingSequence(false);
    }
  };

  const getFallbackBarcodeId = () => {
    const fallbackId = 'R' + String(Date.now()).slice(-5);
    console.warn('Using fallback barcode ID:', fallbackId);
    return fallbackId;
  };

  const getNextSequentialBarcodeId = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/fabric-receiving/next-return-barcode');
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const resData = await response.json();
      
      if (resData.success) {
        const { barcodeId, numericId } = resData.data;
        setBarcodeSequence(prev => ({
          current: numericId - 1,
          next: numericId,
          lastGenerated: barcodeId
        }));
        console.log(`🔢 Generated sequential return barcode: ${barcodeId} (No. ${numericId})`);
        return barcodeId;
      } else {
        throw new Error('Failed to get sequential ID');
      }
    } catch (error) {
      console.error('Error getting sequential barcode:', error);
      const fallbackId = 'R' + String(Date.now()).slice(-5);
      console.warn('Using fallback barcode ID:', fallbackId);
      return fallbackId;
    }
  };

  // Store returned roll in separate receiving sheet
  const storeReturnedRollInReceivingSheet = async (stickerData) => {
    try {
      // ⭐ Use the correct endpoint - this should NOT create another entry
      // The backend already created the entry when you clicked "Confirm Return"
      // So here we should just update the existing record with the sticker info
      
      const API_URL = 'http://localhost:5001/api/fabric-receiving/update-return-sticker';
      
      const payload = {
        originalBarcodeId: stickerData.originalBarcodeId,
        newBarcodeId: stickerData.uniqueBarcodeId,
        stickerGeneratedAt: new Date().toISOString(),
        stickerPrinted: true
      };
      
      console.log('📤 Updating return record with sticker info:', payload);
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const resData = await response.json();
      
      if (resData.success) {
        console.log(`✅ Sticker info updated for barcode: ${stickerData.uniqueBarcodeId}`);
        showNotification(`✓ Sticker generated: ${stickerData.uniqueBarcodeId}`, 'success');
        return true;
      } else {
        console.error('❌ Backend returned error:', resData);
        showNotification(`⚠️ Update failed: ${resData.message}`, 'error');
        return false;
      }
      
    } catch (error) {
      console.error('❌ NETWORK ERROR:', error);
      // If update fails, the roll was already saved, so still return true
      showNotification(`✓ Return recorded, but sticker update failed: ${error.message}`, 'warning');
      return true;
    }
  };

  const generateSticker = async () => {
    if (!returnData) {
      showNotification('No return data provided', 'error');
      return;
    }

    if (!receivedBy.trim()) {
      showNotification('Please enter Received By name', 'warning');
      return;
    }

    if (!authorizedBy.trim()) {
      showNotification('Please enter Authorized By name', 'warning');
      return;
    }

    if (!location.trim()) {
      showNotification('Please enter Location', 'warning');
      return;
    }

    setIsGenerating(true);

    try {
      const newBarcode = await getNextSequentialBarcodeId();
      const currentTime = new Date();
      const timeString = currentTime.toLocaleTimeString();
      
      // Get the party name correctly
      const partyName = returnData.cmfName || returnData.party || returnData.fabricName;
      
      console.log('📋 Return Data Debug:', {
        cmfName: returnData.cmfName,
        party: returnData.party,
        fabricName: returnData.fabricName,
        usingParty: partyName,
        originalBarcodeId: returnData.barcodeId || returnData.originalBarcodeId
      });
      
      const stickerData = {
        uniqueBarcodeId: newBarcode,
        originalBarcodeId: returnData.barcodeId || returnData.originalBarcodeId,
        cmfName: partyName,
        fabricName: returnData.fabricName,
        group: returnData.group || 'RETURNED',
        shade: returnData.shade,
        weight: returnData.returnedWeight || returnData.weight,
        lotNumber: returnData.lotNumber,
        billNumber: returnData.billNumber || '',
        date: new Date().toISOString().split('T')[0],
        location: location,
        receivedPerson: receivedBy,
        authorizedPerson: authorizedBy,
        rollNumber: 1,
        totalRolls: 1,
        generatedAt: timeString,
        timestamp: currentTime.toISOString(),
        status: 'in_stock',
        isReturnedItem: true,
        returnReason: returnData.reason || 'Returned to Inventory',
        returnDate: returnData.returnDate || currentTime.toISOString(),
        returnedWeight: returnData.returnedWeight || returnData.weight
      };
      
      console.log(`🎯 Generated return barcode ID: ${newBarcode} for returned fabric`);
      console.log(`🏭 Party/CMP Name: ${partyName}`);
      console.log(`🧵 Fabric Name: ${returnData.fabricName}`);
      console.log(`📦 Original Barcode: ${stickerData.originalBarcodeId} -> New Barcode: ${newBarcode}`);
      console.log(`👤 Received by: ${receivedBy}`);
      console.log(`✍️ Authorized by: ${authorizedBy}`);
      console.log(`📍 Location: ${location}`);
      
      const stored = await storeReturnedRollInReceivingSheet(stickerData);
      
      if (stored) {
        setGeneratedSticker(stickerData);
        
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && printServiceStatus === 'ready') {
          printViaPythonService(stickerData);
        } else {
          showNotification('⚠️ Print service not available. Sticker data saved but not printed.', 'warning');
        }
        
        if (onStickerGenerated) {
          onStickerGenerated(stickerData);
        }
        
        showNotification(`✅ Return sticker generated! New Barcode: ${newBarcode}`, 'success');
      } else {
        showNotification('❌ Failed to save returned roll data', 'error');
      }
      
    } catch (error) {
      console.error('Error generating return sticker:', error);
      showNotification('Error generating return sticker', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const EditableField = ({ label, value, onChange, isEditing, setIsEditing, placeholder, required = true, suggestions = [] }) => (
    <div style={{ marginBottom: '12px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <strong style={{ fontSize: '13px', color: '#374151' }}>
          {label}: {required && <span style={{ color: '#ef4444' }}>*</span>}
        </strong>
        {!isEditing && value && (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '12px',
              color: '#3b82f6',
              cursor: 'pointer',
              padding: '2px 8px',
              borderRadius: '4px'
            }}
          >
            ✏️ Edit
          </button>
        )}
      </div>
      
      {isEditing ? (
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowLocationSuggestions(true)}
              placeholder={placeholder}
              autoFocus
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button
              onClick={() => setIsEditing(false)}
              style={{
                padding: '6px 12px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ✓ Save
            </button>
            <button
              onClick={() => {
                onChange('');
                setIsEditing(false);
              }}
              style={{
                padding: '6px 12px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ✗ Clear
            </button>
          </div>
          
          {showLocationSuggestions && suggestions.length > 0 && label === 'Location' && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              marginTop: '4px',
              maxHeight: '200px',
              overflowY: 'auto',
              zIndex: 1000,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  onClick={() => {
                    onChange(suggestion);
                    setShowLocationSuggestions(false);
                    setIsEditing(false);
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    borderBottom: index < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#f0fdf4'}
                  onMouseLeave={(e) => e.target.style.background = 'white'}
                >
                  📍 {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          style={{
            padding: '8px 12px',
            background: value ? '#f0fdf4' : '#fef3c7',
            border: value ? '1px solid #10b981' : '1px dashed #f59e0b',
            borderRadius: '8px',
            cursor: 'pointer',
            color: value ? '#065f46' : '#92400e',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          {value || `Click to add ${label.toLowerCase()}`}
        </div>
      )}
    </div>
  );

  const StickerPreview = () => {
    if (!generatedSticker) return null;
    
    return (
      <div style={{
        background: 'white',
        border: '2px solid #10b981',
        borderRadius: '12px',
        padding: '16px',
        marginTop: '20px',
        textAlign: 'center'
      }}>
        <h4 style={{ margin: '0 0 12px 0', color: '#10b981' }}>✅ Sticker Generated Successfully</h4>
        
        {/* New Barcode Section */}
        <div style={{
          background: '#fef3c7',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '12px'
        }}>
          <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>🆕 New Barcode ID</div>
          <div style={{
            fontSize: '28px',
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: '#f59e0b',
            letterSpacing: '2px'
          }}>
            {generatedSticker.uniqueBarcodeId}
          </div>
          <div style={{ fontSize: '10px', color: '#78350f', marginTop: '4px' }}>
            Return Barcode #{barcodeSequence.next - 1}
          </div>
        </div>
        
        {/* Original Barcode Reference */}
        <div style={{
          background: '#e0e7ff',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '12px',
          border: '1px solid #c7d2fe'
        }}>
          <div style={{ fontSize: '12px', color: '#3730a3', marginBottom: '4px' }}>
            🔗 Original Barcode (Received Against)
          </div>
          <div style={{ 
            fontSize: '18px', 
            fontFamily: 'monospace', 
            color: '#4338ca',
            fontWeight: 'bold',
            wordBreak: 'break-all'
          }}>
            {generatedSticker.originalBarcodeId}
          </div>
        </div>
        
        {/* Sticker Details */}
        <div style={{ textAlign: 'left', fontSize: '13px', marginTop: '12px' }}>
          <p><strong>🏭 Party/CMP Name:</strong> {generatedSticker.cmfName}</p>
          <p><strong>🧵 Fabric:</strong> {generatedSticker.fabricName}</p>
          <p><strong>🎨 Shade:</strong> {generatedSticker.shade}</p>
          <p><strong>⚖️ Weight:</strong> {generatedSticker.weight} KG</p>
          <p><strong>📝 Return Reason:</strong> {generatedSticker.returnReason}</p>
          <p><strong>👤 Received By:</strong> {generatedSticker.receivedPerson}</p>
          <p><strong>✍️ Authorized By:</strong> {generatedSticker.authorizedPerson}</p>
          <p><strong>📍 Location:</strong> {generatedSticker.location}</p>
          <p><strong>📅 Return Date:</strong> {new Date(generatedSticker.returnDate).toLocaleDateString()}</p>
        </div>
        
        <div style={{
          marginTop: '12px',
          padding: '8px',
          background: '#dbeafe',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#1e40af'
        }}>
          🏷️ This returned roll is stored in the RECEIVING sheet with barcode: {generatedSticker.uniqueBarcodeId}<br/>
          🔗 Reference to original barcode: {generatedSticker.originalBarcodeId}
        </div>
      </div>
    );
  };

  const PrintServiceIndicator = () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: '#f1f5f9',
      padding: '6px 12px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '500',
      marginBottom: '16px'
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: printServiceStatus === 'ready' ? '#10b981' : 
                   printServiceStatus === 'connected' ? '#f59e0b' : 
                   printServiceStatus === 'error' ? '#ef4444' : '#6b7280',
        animation: printServiceStatus === 'connected' ? 'pulse 1s infinite' : 'none'
      }} />
      <span>
        {printServiceStatus === 'ready' ? '✓ Print Service Ready' :
         printServiceStatus === 'connected' ? 'Connecting...' :
         printServiceStatus === 'error' ? '✗ Print Service Error' : '○ Print Service Offline'}
      </span>
    </div>
  );

  if (!returnData) {
    return null;
  }

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.05); }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `}</style>
      
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        fontFamily: "'Inter', 'Segoe UI', system-ui"
      }}>
        <div style={{
          background: 'white',
          borderRadius: '20px',
          maxWidth: '550px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            padding: '20px 24px',
            color: 'white',
            borderRadius: '20px 20px 0 0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>🏷️ Generate Return Sticker</h2>
              <button onClick={onClose} style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '28px',
                cursor: 'pointer',
                padding: '0 8px'
              }}>×</button>
            </div>
            <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Create new barcode for returned fabric roll</p>
          </div>
          
          <div style={{ padding: '24px' }}>
            <PrintServiceIndicator />
            
            {/* Return Information Summary */}
            <div style={{
              background: '#f8f9fa',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#333' }}>📋 Return Information</h4>
              <div style={{ fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div><strong>Original Barcode:</strong> {returnData.barcodeId || returnData.originalBarcodeId}</div>
                <div><strong>Party/CMP Name:</strong> {returnData.cmfName || returnData.party || returnData.fabricName}</div>
                <div><strong>Fabric:</strong> {returnData.fabricName}</div>
                <div><strong>Shade:</strong> {returnData.shade}</div>
                <div><strong>Lot Number:</strong> {returnData.lotNumber}</div>
                <div><strong>Returned Weight:</strong> {returnData.returnedWeight || returnData.weight} KG</div>
                <div><strong>Reason:</strong> {returnData.reason || 'Returned to Inventory'}</div>
              </div>
            </div>
            
            {/* Editable Fields Section */}
            <div style={{
              background: '#fef3c7',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '20px',
              border: '1px solid #fde68a'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>✍️</span> Personnel & Location Information
              </h4>
              
              <EditableField
                label="Received By"
                value={receivedBy}
                onChange={setReceivedBy}
                isEditing={isEditingReceived}
                setIsEditing={setIsEditingReceived}
                placeholder="Enter name of person receiving the return"
                required={true}
              />
              
              <EditableField
                label="Authorized By"
                value={authorizedBy}
                onChange={setAuthorizedBy}
                isEditing={isEditingAuthorized}
                setIsEditing={setIsEditingAuthorized}
                placeholder="Enter name of authorizing person"
                required={true}
              />
              
              <EditableField
                label="Location"
                value={location}
                onChange={setLocation}
                isEditing={isEditingLocation}
                setIsEditing={setIsEditingLocation}
                placeholder="Enter storage location"
                required={true}
                suggestions={locationSuggestions}
              />
            </div>
            
            {/* New Barcode Preview */}
            {newBarcodeId && !generatedSticker && (
              <div style={{
                background: '#fef3c7',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>
                  Next Available Return Barcode ID
                </div>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  color: '#f59e0b',
                  letterSpacing: '2px'
                }}>
                  {newBarcodeId}
                </div>
                <div style={{ fontSize: '11px', color: '#78350f', marginTop: '4px' }}>
                  Return Barcode #{barcodeSequence.next}
                </div>
              </div>
            )}
            
            {/* Generate Button */}
            {!generatedSticker && (
              <button
                onClick={generateSticker}
                disabled={isGenerating || isLoadingSequence || !receivedBy.trim() || !authorizedBy.trim() || !location.trim()}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '14px',
                  borderRadius: '12px',
                  fontWeight: '600',
                  fontSize: '16px',
                  cursor: (isGenerating || isLoadingSequence || !receivedBy.trim() || !authorizedBy.trim() || !location.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (isGenerating || isLoadingSequence || !receivedBy.trim() || !authorizedBy.trim() || !location.trim()) ? 0.6 : 1,
                  marginBottom: '16px'
                }}
              >
                {isLoadingSequence ? 'Loading Barcode Sequence...' : 
                 isGenerating ? 'Generating Sticker...' : 
                 '🎯 Generate & Print Return Sticker'}
              </button>
            )}
            
            {/* Generated Sticker Preview */}
            <StickerPreview />
            
            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              {generatedSticker && (
                <button
                  onClick={() => {
                    setGeneratedSticker(null);
                    setReceivedBy('');
                    setAuthorizedBy('');
                    setLocation('RETURNED_INVENTORY');
                    loadNextReturnBarcodeId();
                  }}
                  style={{
                    flex: 1,
                    background: '#f1f5f9',
                    border: '2px solid #e2e8f0',
                    padding: '12px',
                    borderRadius: '10px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    color: '#475569'
                  }}
                >
                  Generate Another
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  background: generatedSticker ? '#10b981' : '#ef4444',
                  color: 'white',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '10px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {generatedSticker ? 'Done' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReturnStickerGenerator;
