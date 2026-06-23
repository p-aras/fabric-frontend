import React, { useState, useEffect, useRef } from 'react';
import ReturnStickerGenerator from './ReturnStickerGenerator';
import '../Design/FabricReceiving.css';

const FabricReceiving = ({ selectedJob, onClose, onReceiveComplete }) => {
  const [issuedRolls, setIssuedRolls] = useState([]);
  const [rollsByShade, setRollsByShade] = useState({});
  const [receivingHistory, setReceivingHistory] = useState([]);
  const [selectedRoll, setSelectedRoll] = useState(null);
  const [selectedShade, setSelectedShade] = useState(null);
  const [returnWeight, setReturnWeight] = useState('');
  const [shadeReturnWeight, setShadeReturnWeight] = useState({});
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [reason, setReason] = useState('Returned');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchBarcode, setSearchBarcode] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [remainingWeight, setRemainingWeight] = useState(null);
  const [activeTab, setActiveTab] = useState('individual');
  
  // State for sticker generator
  const [showStickerGenerator, setShowStickerGenerator] = useState(false);
  const [currentReturnData, setCurrentReturnData] = useState(null);
  const [pendingReturnRecords, setPendingReturnRecords] = useState([]);
  
  const API_BASE_URL = 'http://localhost:5001/api/fabric-receiving';

  useEffect(() => {
    if (selectedJob) {
      loadIssuedRolls();
      loadReceivingHistory();
    }
  }, [selectedJob]);

  const loadIssuedRolls = async () => {
    try {
      setLoading(true);
      console.log(`📡 Fetching issued rolls for lot: ${selectedJob['Lot Number']}`);
      
      const response = await fetch(`${API_BASE_URL}/issued-rolls/${selectedJob['Lot Number']}`);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const resData = await response.json();
      
      console.log('📊 Issued rolls response:', resData);
      
      if (resData.success) {
        let activeIssuedRolls = resData.data.filter(roll => 
          (roll.status === 'issued' || roll.status === 'partially_issued') &&
          (roll.totalReturnedWeight < roll.originalIssuedWeight)
        );
        
        const transformedRolls = activeIssuedRolls.map(roll => ({
          ...roll,
          weight: roll.originalIssuedWeight,
          remainingWeight: roll.originalIssuedWeight - roll.totalReturnedWeight,
          availableToReturn: roll.originalIssuedWeight - roll.totalReturnedWeight,
          returnedWeight: roll.totalReturnedWeight,
          usedWeight: roll.fabricUsedForCutting
        }));
        
        const rollsByShadeMap = transformedRolls.reduce((acc, roll) => {
          const shade = roll.shade || 'Unknown';
          if (!acc[shade]) acc[shade] = [];
          acc[shade].push(roll);
          return acc;
        }, {});
        
        setIssuedRolls(transformedRolls);
        setRollsByShade(rollsByShadeMap);
        console.log(`✅ Loaded ${transformedRolls.length} issued rolls across ${Object.keys(rollsByShadeMap).length} shades`);
        
        transformedRolls.forEach(roll => {
          console.log(`   ${roll.barcodeId}: Issued=${roll.originalIssuedWeight}KG, Returned=${roll.totalReturnedWeight}KG, Available=${roll.availableToReturn}KG, Used=${roll.fabricUsedForCutting}KG, Party=${roll.cmfName || roll.party || 'N/A'}`);
        });
      } else {
        console.error('Failed to load issued rolls:', resData.message);
      }
    } catch (error) {
      console.error('Error loading issued rolls:', error);
      alert('Failed to load issued rolls. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const loadReceivingHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/receiving-history/${selectedJob['Lot Number']}`);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const resData = await response.json();
      
      if (resData.success) {
        setReceivingHistory(resData.data);
        console.log(`✅ Loaded ${resData.data.length} receiving records`);
      }
    } catch (error) {
      console.error('Error loading receiving history:', error);
    }
  };

  const handleSelectRoll = (roll) => {
    setSelectedRoll(roll);
    setSelectedShade(null);
    const maxReturnable = roll.availableToReturn || (roll.originalIssuedWeight - roll.totalReturnedWeight);
    setReturnWeight(maxReturnable.toString());
    setReturnQuantity(1);
    setReason('Returned');
    setManualBarcode('');
    setRemainingWeight(maxReturnable);
  };

  const handleShadeReturn = async (shade) => {
    const rollsForShade = rollsByShade[shade] || [];
    if (rollsForShade.length === 0) {
      alert(`No rolls found for shade: ${shade}`);
      return;
    }
    
    const returnWeightValue = parseFloat(shadeReturnWeight[shade]);
    if (!returnWeightValue || returnWeightValue <= 0) {
      alert(`Please enter a valid return weight for shade: ${shade}`);
      return;
    }
    
    const totalAvailableWeight = rollsForShade.reduce((sum, roll) => 
      sum + (roll.availableToReturn || (roll.originalIssuedWeight - roll.totalReturnedWeight)), 0
    );
    
    if (returnWeightValue > totalAvailableWeight) {
      alert(`Return weight (${returnWeightValue} KG) exceeds available weight (${totalAvailableWeight.toFixed(2)} KG) for shade ${shade}`);
      return;
    }
    
    setSubmitting(true);
    
    try {
      let remainingToReturn = returnWeightValue;
      const returnRecords = [];
      let totalReturned = 0;
      
      for (const roll of rollsForShade) {
        if (remainingToReturn <= 0) break;
        
        const availableFromRoll = roll.availableToReturn || (roll.originalIssuedWeight - roll.totalReturnedWeight);
        const returnFromRoll = Math.min(availableFromRoll, remainingToReturn);
        
        // FIXED: Get the party name correctly
        const partyName = roll.cmfName || roll.party || roll.fabricName;
        
        const receivingRecord = {
          lotNumber: selectedJob['Lot Number'],
          fabricName: roll.fabricName,
          cmfName: partyName,  // ← Use party name
          party: partyName,     // ← Add party field
          shade: roll.shade,
          barcodeId: roll.barcodeId,
          originalBarcodeId: roll.barcodeId,
          returnedWeight: returnFromRoll,
          weight: returnFromRoll,
          returnQuantity: 1,
          reason: 'Returned from shade',
          receivedBy: 'Production Manager',
          receivedAt: new Date().toISOString(),
          returnDate: new Date().toISOString(),
          originalIssuedWeight: roll.originalIssuedWeight,
          totalReturnedWeight: roll.totalReturnedWeight || 0
        };
        
        const response = await fetch(`${API_BASE_URL}/store-fabric-receiving`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(receivingRecord)
        });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const resData = await response.json();
        
        if (resData.success) {
          returnRecords.push(receivingRecord);
          remainingToReturn -= returnFromRoll;
          totalReturned += returnFromRoll;
          if (onReceiveComplete) onReceiveComplete(receivingRecord);
        } else {
          throw new Error(`Failed to return roll ${roll.barcodeId}: ${resData.message}`);
        }
      }
      
      alert(`✅ Successfully returned ${totalReturned.toFixed(2)} KG of shade ${shade}\nProcessed ${returnRecords.length} roll(s)`);
      
      // Show sticker generator for the first returned roll
      if (returnRecords.length > 0) {
        setPendingReturnRecords(returnRecords);
        setCurrentReturnData(returnRecords[0]);
        setShowStickerGenerator(true);
      }
      
      setShadeReturnWeight({});
      setSelectedShade(null);
      await loadIssuedRolls();
      await loadReceivingHistory();
      
    } catch (error) {
      console.error('Error processing shade return:', error);
      alert('Error processing return. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearchByBarcode = async () => {
    if (!searchBarcode.trim()) {
      alert('Please enter a barcode ID');
      return;
    }

    try {
      setLoading(true);
      console.log(`🔍 Searching for barcode: ${searchBarcode}`);
      
      const checkResponse = await fetch(`${API_BASE_URL}/check-barcode/${searchBarcode}?lotNumber=${selectedJob['Lot Number']}`);
      if (!checkResponse.ok) throw new Error(`HTTP error! Status: ${checkResponse.status}`);
      const checkData = await checkResponse.json();
      
      if (checkData.success && checkData.data.issued) {
        const issuedRollsResponse = await fetch(`${API_BASE_URL}/issued-rolls/${selectedJob['Lot Number']}`);
        if (!issuedRollsResponse.ok) throw new Error(`HTTP error! Status: ${issuedRollsResponse.status}`);
        const rollsData = await issuedRollsResponse.json();
        
        if (rollsData.success) {
          const foundRoll = rollsData.data.find(roll => roll.barcodeId === searchBarcode);
          
          if (foundRoll) {
            const transformedRoll = {
              ...foundRoll,
              weight: foundRoll.originalIssuedWeight,
              remainingWeight: foundRoll.originalIssuedWeight - foundRoll.totalReturnedWeight,
              availableToReturn: foundRoll.originalIssuedWeight - foundRoll.totalReturnedWeight,
              returnedWeight: foundRoll.totalReturnedWeight,
              usedWeight: foundRoll.fabricUsedForCutting
            };
            
            setSelectedRoll(transformedRoll);
            setSelectedShade(null);
            const maxReturnable = transformedRoll.availableToReturn;
            setReturnWeight(maxReturnable.toString());
            setRemainingWeight(maxReturnable);
            setSearchBarcode('');
            setActiveTab('individual');
            alert(`✅ Barcode ${searchBarcode} found!\n📦 Issued: ${foundRoll.originalIssuedWeight} KG\n📥 Returned: ${foundRoll.totalReturnedWeight} KG\n✂️ Used: ${foundRoll.fabricUsedForCutting} KG\n🔄 Available to return: ${maxReturnable.toFixed(2)} KG`);
          } else {
            alert(`❌ Barcode ${searchBarcode} found but not in issued rolls for this lot`);
          }
        } else {
          alert(`❌ Could not retrieve issued rolls data`);
        }
      } else {
        alert(`❌ Barcode ${searchBarcode} was not issued for lot ${selectedJob['Lot Number']}`);
      }
    } catch (error) {
      console.error('Error searching barcode:', error);
      alert('Error searching barcode. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualAdd = async () => {
    if (!manualBarcode.trim()) {
      alert('Please enter a barcode ID');
      return;
    }

    try {
      setSubmitting(true);
      
      const checkResponse = await fetch(`${API_BASE_URL}/check-barcode/${manualBarcode}?lotNumber=${selectedJob['Lot Number']}`);
      if (!checkResponse.ok) throw new Error(`HTTP error! Status: ${checkResponse.status}`);
      const checkData = await checkResponse.json();
      
      if (!checkData.success || !checkData.data.issued) {
        alert(`❌ Barcode ${manualBarcode} was not issued for lot ${selectedJob['Lot Number']}`);
        setSubmitting(false);
        return;
      }
      
      const issuedRollsResponse = await fetch(`${API_BASE_URL}/issued-rolls/${selectedJob['Lot Number']}`);
      if (!issuedRollsResponse.ok) throw new Error(`HTTP error! Status: ${issuedRollsResponse.status}`);
      const rollsData = await issuedRollsResponse.json();
      
      if (!rollsData.success) {
        alert('Could not retrieve roll data');
        setSubmitting(false);
        return;
      }
      
      const foundRoll = rollsData.data.find(roll => roll.barcodeId === manualBarcode);
      
      if (!foundRoll) {
        alert('Roll data not found');
        setSubmitting(false);
        return;
      }
      
      const maxReturnable = foundRoll.originalIssuedWeight - foundRoll.totalReturnedWeight;
      
      const returnWeightInput = prompt(`Enter return weight for ${manualBarcode}\nIssued: ${foundRoll.originalIssuedWeight} KG\nAlready Returned: ${foundRoll.totalReturnedWeight} KG\nAvailable to Return: ${maxReturnable.toFixed(2)} KG:`, maxReturnable.toString());
      
      if (!returnWeightInput) {
        setSubmitting(false);
        return;
      }
      
      const returnWeightValue = parseFloat(returnWeightInput);
      if (isNaN(returnWeightValue) || returnWeightValue <= 0 || returnWeightValue > maxReturnable) {
        alert(`Invalid weight. Please enter a value between 0 and ${maxReturnable.toFixed(2)}`);
        setSubmitting(false);
        return;
      }
      
      const reasonInput = prompt('Enter reason for return:', 'Returned');
      
      // FIXED: Get the party name correctly
      const partyName = foundRoll.cmfName || foundRoll.party || foundRoll.fabricName;
      
      const receivingRecord = {
        lotNumber: selectedJob['Lot Number'],
        fabricName: foundRoll.fabricName,
        cmfName: partyName,  // ← Use party name
        party: partyName,     // ← Add party field
        shade: foundRoll.shade,
        barcodeId: manualBarcode,
        originalBarcodeId: manualBarcode,
        returnedWeight: returnWeightValue,
        weight: returnWeightValue,
        returnQuantity: 1,
        reason: reasonInput || 'Returned',
        receivedBy: 'Production Manager',
        receivedAt: new Date().toISOString(),
        returnDate: new Date().toISOString(),
        originalIssuedWeight: foundRoll.originalIssuedWeight,
        totalReturnedWeight: foundRoll.totalReturnedWeight
      };
      
      const response = await fetch(`${API_BASE_URL}/store-fabric-receiving`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receivingRecord)
      });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const resData = await response.json();
      
      if (resData.success) {
        const newTotalReturned = foundRoll.totalReturnedWeight + returnWeightValue;
        const fabricUsed = foundRoll.originalIssuedWeight - newTotalReturned;
        alert(`✅ Successfully returned ${returnWeightValue} KG of ${manualBarcode}\n📦 Total Returned: ${newTotalReturned.toFixed(2)} KG\n✂️ Fabric Used: ${fabricUsed.toFixed(2)} KG`);
        
        if (onReceiveComplete) onReceiveComplete(receivingRecord);
        
        // Show sticker generator
        setCurrentReturnData(receivingRecord);
        setShowStickerGenerator(true);
        
        await loadIssuedRolls();
        await loadReceivingHistory();
        setSelectedRoll(null);
        setManualBarcode('');
        setReturnWeight('');
      } else {
        alert('Failed to record return: ' + resData.message);
      }
    } catch (error) {
      console.error('Error processing return:', error);
      alert('Error processing return. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReturn = async () => {
    if (!selectedRoll) {
      alert('Please select a roll to return');
      return;
    }

    const maxReturnable = selectedRoll.availableToReturn || selectedRoll.remainingWeight;
    const returnWeightValue = parseFloat(returnWeight);

    if (isNaN(returnWeightValue) || returnWeightValue <= 0) {
      alert('Please enter a valid return weight');
      return;
    }

    if (returnWeightValue > maxReturnable) {
      alert(`Return weight cannot exceed ${maxReturnable.toFixed(2)} KG`);
      return;
    }

    setSubmitting(true);

    // FIXED: Get the party name correctly from selectedRoll
    const partyName = selectedRoll.cmfName || selectedRoll.party || selectedRoll.fabricName;
    
    console.log('📋 Submitting return with party:', partyName);
    console.log('📋 Roll data:', {
      cmfName: selectedRoll.cmfName,
      party: selectedRoll.party,
      fabricName: selectedRoll.fabricName
    });

    const receivingRecord = {
      lotNumber: selectedJob['Lot Number'],
      fabricName: selectedRoll.fabricName,
      cmfName: partyName,  // ← Use party name instead of fabric name
      party: partyName,     // ← Add party field for reference
      shade: selectedRoll.shade,
      barcodeId: selectedRoll.barcodeId,
      originalBarcodeId: selectedRoll.barcodeId,
      returnedWeight: returnWeightValue,
      weight: returnWeightValue,
      returnQuantity: 1,
      reason: reason,
      receivedBy: 'Production Manager',
      receivedAt: new Date().toISOString(),
      returnDate: new Date().toISOString(),
      originalIssuedWeight: selectedRoll.originalIssuedWeight,
      totalReturnedWeight: selectedRoll.totalReturnedWeight || 0
    };

    try {
      const response = await fetch(`${API_BASE_URL}/store-fabric-receiving`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receivingRecord)
      });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const resData = await response.json();
      
      if (resData.success) {
        const newTotalReturned = (selectedRoll.totalReturnedWeight || 0) + returnWeightValue;
        const fabricUsed = selectedRoll.originalIssuedWeight - newTotalReturned;
        
        if (newTotalReturned >= selectedRoll.originalIssuedWeight) {
          alert(`✅ Successfully returned full roll ${selectedRoll.barcodeId}\n📦 Total Returned: ${newTotalReturned.toFixed(2)} KG\n✂️ Fabric Used: ${fabricUsed.toFixed(2)} KG`);
        } else {
          alert(`✅ Successfully returned ${returnWeightValue} KG of ${selectedRoll.barcodeId}\n📦 Total Returned: ${newTotalReturned.toFixed(2)} KG\n✂️ Fabric Used: ${fabricUsed.toFixed(2)} KG\n🔄 Remaining to Return: ${(selectedRoll.originalIssuedWeight - newTotalReturned).toFixed(2)} KG`);
        }
        
        if (onReceiveComplete) onReceiveComplete(receivingRecord);
        
        // Show sticker generator for the returned roll
        setCurrentReturnData(receivingRecord);
        setShowStickerGenerator(true);
        
        await loadIssuedRolls();
        await loadReceivingHistory();
        setSelectedRoll(null);
        setReturnWeight('');
        setRemainingWeight(null);
      } else {
        alert('Failed to record return: ' + resData.message);
      }
    } catch (error) {
      console.error('Error processing return:', error);
      alert('Error processing return. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStickerGenerated = (stickerData) => {
    console.log('✅ Return sticker generated:', stickerData);
    
    // If there are multiple pending return records, process the next one
    if (pendingReturnRecords.length > 1) {
      const remainingRecords = pendingReturnRecords.slice(1);
      if (remainingRecords.length > 0) {
        setPendingReturnRecords(remainingRecords);
        setCurrentReturnData(remainingRecords[0]);
        setShowStickerGenerator(true);
      } else {
        setPendingReturnRecords([]);
      }
    } else {
      setPendingReturnRecords([]);
    }
    
    // You can also show a notification or trigger any other action
    const notification = document.createElement('div');
    notification.textContent = `✓ Sticker generated for returned roll: ${stickerData.uniqueBarcodeId}`;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
      font-size: 14px;
      font-weight: 500;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  };

  const handleCloseStickerGenerator = () => {
    setShowStickerGenerator(false);
    setCurrentReturnData(null);
    setPendingReturnRecords([]);
  };

  const getShadeColor = (shade) => {
    const colors = {
      'BLACK': '#1a1a1a',
      'WHITE': '#ffffff',
      'OFF-WHITE': '#ffffff',
      'OLIVE': '#556b2f',
      'NAVY': '#000080',
      'NAVY BLUE': '#000080',
      'GREY': '#808080',
      'GRAY': '#808080',
      'RFD': '#ff6b6b',
      'RED': '#ff0000',
      'BLUE': '#0000ff',
      'GREEN': '#008000'
    };
    return colors[shade?.toUpperCase()] || '#2a5298';
  };

  return (
    <>
      <div className="receiving-modal-overlay" onClick={onClose} style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div className="receiving-modal" onClick={(e) => e.stopPropagation()} style={{
          maxWidth: '1400px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: 'white',
          borderRadius: '12px'
        }}>
          <div className="receiving-modal-header" style={{
            padding: '20px 24px',
            borderBottom: '2px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            borderRadius: '12px 12px 0 0'
          }}>
            <h2 style={{ margin: 0, color: '#333' }}>📥 Fabric Return / Receiving</h2>
            <button className="close-btn" onClick={onClose} style={{
              background: 'none',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#666'
            }}>×</button>
          </div>
          
          <div className="receiving-modal-body" style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1
          }}>
            {/* Job Info Banner */}
            <div className="job-info" style={{
              background: 'linear-gradient(135deg, #001a8f 0%, #001d7c 100%)',
              color: 'white',
              padding: '16px 20px',
              borderRadius: '12px',
              marginBottom: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0' }}>Job Order: {selectedJob['Job Order No']}</h3>
                <p style={{ margin: 0, opacity: 0.9 }}>Lot Number: <strong>{selectedJob['Lot Number']}</strong> | Fabric: {selectedJob['Fabric']}</p>
              </div>
              <div style={{ fontSize: '14px', background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '8px' }}>
                {Object.keys(rollsByShade).length} Shades Available
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="tab-navigation" style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '24px',
              borderBottom: '2px solid #e0e0e0',
              paddingBottom: '12px'
            }}>
              <button
                onClick={() => setActiveTab('shade')}
                style={{
                  padding: '10px 24px',
                  background: activeTab === 'shade' ? '#667eea' : 'transparent',
                  color: activeTab === 'shade' ? 'white' : '#666',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.3s'
                }}
              >
                🎨 Return by Shade
              </button>
              <button
                onClick={() => setActiveTab('individual')}
                style={{
                  padding: '10px 24px',
                  background: activeTab === 'individual' ? '#667eea' : 'transparent',
                  color: activeTab === 'individual' ? 'white' : '#666',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.3s'
                }}
              >
                📦 Individual Rolls
              </button>
              <button
                onClick={() => setActiveTab('manual')}
                style={{
                  padding: '10px 24px',
                  background: activeTab === 'manual' ? '#667eea' : 'transparent',
                  color: activeTab === 'manual' ? 'white' : '#666',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.3s'
                }}
              >
                ✏️ Manual Entry
              </button>
              <button
                onClick={() => setActiveTab('history')}
                style={{
                  padding: '10px 24px',
                  background: activeTab === 'history' ? '#667eea' : 'transparent',
                  color: activeTab === 'history' ? 'white' : '#666',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.3s'
                }}
              >
                📜 History
              </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
              {/* Tab 1: Return by Shade */}
              {activeTab === 'shade' && (
                <div className="shade-return-columns">
                  <div className="section-header" style={{
                    marginBottom: '20px',
                    paddingBottom: '10px',
                    borderBottom: '2px solid #667eea'
                  }}>
                    <h3 style={{ margin: 0, color: '#333' }}>🎨 Return Fabric by Shade</h3>
                    <p style={{ margin: '5px 0 0', color: '#666', fontSize: '14px' }}>Return weight across multiple rolls of the same shade</p>
                  </div>
                  
                  {loading ? (
                    <div className="loading-spinner" style={{ textAlign: 'center', padding: '40px' }}>Loading shades...</div>
                  ) : Object.keys(rollsByShade).length === 0 ? (
                    <div className="empty-state" style={{ textAlign: 'center', padding: '40px', background: '#f9f9f9', borderRadius: '8px' }}>
                      <p>No issued rolls found for this lot.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {Object.entries(rollsByShade).map(([shade, rolls]) => {
                        const totalIssued = rolls.reduce((sum, roll) => sum + roll.originalIssuedWeight, 0);
                        const totalReturned = rolls.reduce((sum, roll) => sum + (roll.totalReturnedWeight || 0), 0);
                        const totalAvailable = totalIssued - totalReturned;
                        const totalUsed = totalReturned;
                        const rollCount = rolls.length;
                        
                        return (
                          <div key={shade} style={{
                            background: 'white',
                            border: '1px solid #e0e0e0',
                            borderRadius: '12px',
                            padding: '20px',
                            transition: 'all 0.3s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                          }}>
                            <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '8px',
                                  backgroundColor: getShadeColor(shade),
                                  border: '1px solid #ddd'
                                }}></div>
                                <div>
                                  <h4 style={{ margin: 0, fontSize: '18px', color: '#333' }}>{shade}</h4>
                                  <small style={{ color: '#666' }}>{rollCount} roll(s)</small>
                                </div>
                              </div>
                              <div style={{
                                background: '#e8f5e9',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                textAlign: 'center'
                              }}>
                                <div style={{ fontSize: '12px', color: '#666' }}>Available to Return</div>
                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4caf50' }}>{totalAvailable.toFixed(2)} kg</div>
                              </div>
                            </div>
                            
                            {/* Summary Stats */}
                            <div style={{
                              display: 'flex',
                              gap: '16px',
                              marginBottom: '16px',
                              padding: '12px',
                              background: '#f0f7ff',
                              borderRadius: '8px',
                              fontSize: '13px',
                              flexWrap: 'wrap'
                            }}>
                              <div>📦 Total Issued: <strong>{totalIssued.toFixed(2)} kg</strong></div>
                              <div>📥 Returned (In Inventory): <strong style={{ color: '#4caf50' }}>{totalReturned.toFixed(2)} kg</strong></div>
                              <div>✂️ Used for Cutting: <strong style={{ color: '#2196f3' }}>{totalUsed.toFixed(2)} kg</strong></div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#555' }}>
                                  Return Weight to Inventory (KG)
                                </label>
                                <input
                                  type="number"
                                  placeholder={`Max: ${totalAvailable.toFixed(2)} kg`}
                                  value={shadeReturnWeight[shade] || ''}
                                  onChange={(e) => setShadeReturnWeight({
                                    ...shadeReturnWeight,
                                    [shade]: e.target.value
                                  })}
                                  step="0.01"
                                  min="0.01"
                                  max={totalAvailable}
                                  style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    fontSize: '14px'
                                  }}
                                />
                              </div>
                              <button
                                onClick={() => handleShadeReturn(shade)}
                                disabled={submitting || !shadeReturnWeight[shade]}
                                style={{
                                  padding: '10px 24px',
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontWeight: '600',
                                  opacity: (submitting || !shadeReturnWeight[shade]) ? 0.6 : 1,
                                  minWidth: '120px'
                                }}
                              >
                                {submitting ? 'Processing...' : `Return ${shade}`}
                              </button>
                            </div>
                            
                            {/* Roll details expandable */}
                            <details style={{ marginTop: '16px' }}>
                              <summary style={{ cursor: 'pointer', color: '#667eea', fontSize: '13px' }}>
                                📋 View rolls in this shade ({rollCount} rolls)
                              </summary>
                              <div style={{ marginTop: '12px', fontSize: '13px', maxHeight: '200px', overflowY: 'auto' }}>
                                {rolls.map((roll, idx) => (
                                  <div key={idx} style={{
                                    padding: '8px',
                                    borderBottom: '1px solid #f0f0f0',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '8px'
                                  }}>
                                    <span>🏷️ {roll.barcodeId}</span>
                                    <span>🏭 Party: {roll.cmfName || roll.party || 'N/A'}</span>
                                    <span>📦 Issued: {roll.originalIssuedWeight.toFixed(2)} kg</span>
                                    <span style={{ color: '#4caf50' }}>📥 Returned: {(roll.totalReturnedWeight || 0).toFixed(2)} kg</span>
                                    <span style={{ color: '#2196f3' }}>✂️ Used: {(roll.fabricUsedForCutting || 0).toFixed(2)} kg</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Individual Rolls */}
              {activeTab === 'individual' && (
                <div className="individual-rolls-columns" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  {/* Left Column - Barcode Search */}
                  <div style={{ flex: 1, minWidth: '300px' }}>
                    <div className="search-section" style={{
                      background: '#f8f9fa',
                      padding: '20px',
                      borderRadius: '12px',
                      marginBottom: '24px'
                    }}>
                      <h4 style={{ margin: '0 0 16px 0', color: '#333' }}>🔍 Search by Barcode</h4>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          placeholder="Enter or scan barcode ID"
                          value={searchBarcode}
                          onChange={(e) => setSearchBarcode(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSearchByBarcode()}
                          style={{
                            flex: 1,
                            padding: '12px',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            fontSize: '14px'
                          }}
                        />
                        <button onClick={handleSearchByBarcode} style={{
                          padding: '12px 24px',
                          background: '#4caf50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}>
                          Search
                        </button>
                      </div>
                    </div>

                    {/* Issued Rolls List */}
                    <div className="rolls-list-section">
                      <h4 style={{ margin: '0 0 16px 0', color: '#333' }}>📦 Issued Rolls</h4>
                      {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>Loading rolls...</div>
                      ) : issuedRolls.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', background: '#f9f9f9', borderRadius: '8px' }}>
                          <p>No issued rolls found.</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto' }}>
                          {issuedRolls.map((roll, index) => {
                            const availableToReturn = roll.availableToReturn;
                            const isPartial = availableToReturn < roll.originalIssuedWeight;
                            return (
                              <div
                                key={index}
                                onClick={() => handleSelectRoll(roll)}
                                style={{
                                  padding: '16px',
                                  background: selectedRoll?.barcodeId === roll.barcodeId ? '#e8f5e9' : 'white',
                                  border: selectedRoll?.barcodeId === roll.barcodeId ? '2px solid #4caf50' : '1px solid #e0e0e0',
                                  borderRadius: '10px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                                  <strong style={{ fontSize: '16px', color: '#333' }}>🏷️ {roll.barcodeId}</strong>
                                  <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    background: roll.status === 'issued' ? '#fff3e0' : '#e3f2fd',
                                    color: roll.status === 'issued' ? '#f57c00' : '#1976d2'
                                  }}>{roll.status}</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', fontSize: '13px', color: '#666' }}>
                                  <span>🏭 Party: {roll.cmfName || roll.party || 'N/A'}</span>
                                  <span>🧵 {roll.fabricName}</span>
                                  <span>🎨 {roll.shade}</span>
                                  <span>📦 Issued: {roll.originalIssuedWeight} kg</span>
                                  <span style={{ color: '#4caf50' }}>📥 Returned: {(roll.totalReturnedWeight || 0).toFixed(2)} kg</span>
                                  {isPartial && <span style={{ color: '#2196f3' }}>✂️ Used: {(roll.fabricUsedForCutting || 0).toFixed(2)} kg</span>}
                                  <span style={{ color: '#f57c00', fontWeight: 'bold' }}>🔄 Available: {availableToReturn.toFixed(2)} kg</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column - Return Form */}
                  {selectedRoll && (
                    <div style={{ flex: 1, minWidth: '350px' }}>
                      <div style={{
                        background: '#f8f9fa',
                        padding: '24px',
                        borderRadius: '12px',
                        position: 'sticky',
                        top: '20px'
                      }}>
                        <h4 style={{ margin: '0 0 20px 0', color: '#333', borderBottom: '2px solid #667eea', paddingBottom: '10px' }}>
                          📝 Return to Inventory
                        </h4>
                        
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#555' }}>Barcode ID</label>
                          <input type="text" value={selectedRoll.barcodeId} disabled style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', background: '#e9ecef' }} />
                        </div>
                        
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#555' }}>Party / CMP Name</label>
                          <input type="text" value={selectedRoll.cmfName || selectedRoll.party || 'N/A'} disabled style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', background: '#e9ecef' }} />
                        </div>
                        
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#555' }}>Fabric</label>
                          <input type="text" value={selectedRoll.fabricName} disabled style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', background: '#e9ecef' }} />
                        </div>
                        
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#555' }}>Shade</label>
                          <input type="text" value={selectedRoll.shade} disabled style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', background: '#e9ecef' }} />
                        </div>
                        
                        <div style={{ marginBottom: '16px', background: '#e3f2fd', padding: '12px', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span>📦 Total Issued:</span>
                            <strong>{selectedRoll.originalIssuedWeight} KG</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span>📥 Already Returned (In Inventory):</span>
                            <strong style={{ color: '#4caf50' }}>{(selectedRoll.totalReturnedWeight || 0).toFixed(2)} KG</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>✂️ Used for Cutting:</span>
                            <strong style={{ color: '#2196f3' }}>{(selectedRoll.fabricUsedForCutting || 0).toFixed(2)} KG</strong>
                          </div>
                        </div>
                        
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#555' }}>Available to Return (KG)</label>
                          <input type="text" value={(selectedRoll.availableToReturn || selectedRoll.remainingWeight).toFixed(2)} disabled style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', background: '#fff3e0', fontWeight: 'bold', color: '#f57c00' }} />
                        </div>
                        
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#555' }}>Return Weight (KG)</label>
                          <input
                            type="number"
                            value={returnWeight}
                            onChange={(e) => setReturnWeight(e.target.value)}
                            step="0.01"
                            min="0.01"
                            max={selectedRoll.availableToReturn || selectedRoll.remainingWeight}
                            placeholder={`Max: ${(selectedRoll.availableToReturn || selectedRoll.remainingWeight).toFixed(2)} KG`}
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
                          />
                        </div>
                        
                        <div style={{ marginBottom: '24px' }}>
                          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#555' }}>Reason</label>
                          <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}>
                            <option value="Returned">Returned to Inventory</option>
                            <option value="Damaged">Damaged - Write Off</option>
                            <option value="Quality Issue">Quality Issue</option>
                            <option value="Wrong Issue">Wrongly Issued</option>
                            <option value="Partial Return">Partial Return</option>
                          </select>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          <button onClick={handleSubmitReturn} disabled={submitting} style={{
                            flex: 1,
                            padding: '12px',
                            background: '#4caf50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '600'
                          }}>
                            {submitting ? 'Processing...' : '✓ Confirm Return'}
                          </button>
                          <button onClick={() => {
                            setSelectedRoll(null);
                            setReturnWeight('');
                            setRemainingWeight(null);
                          }} style={{
                            flex: 1,
                            padding: '12px',
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '600'
                          }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Manual Entry */}
              {activeTab === 'manual' && (
                <div className="manual-entry-columns">
                  <div style={{
                    background: '#f8f9fa',
                    padding: '30px',
                    borderRadius: '12px',
                    textAlign: 'center',
                    maxWidth: '500px',
                    margin: '0 auto'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>✏️</div>
                    <h3 style={{ margin: '0 0 8px 0', color: '#333' }}>Manual Barcode Entry</h3>
                    <p style={{ color: '#666', marginBottom: '24px' }}>Enter a barcode ID to process a return</p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <input
                        type="text"
                        placeholder="Enter barcode ID manually"
                        value={manualBarcode}
                        onChange={(e) => setManualBarcode(e.target.value)}
                        style={{
                          padding: '12px',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          fontSize: '14px',
                          textAlign: 'center',
                          outline: 'none'
                        }}
                        onKeyPress={(e) => e.key === 'Enter' && handleManualAdd()}
                      />
                      <button
                        onClick={handleManualAdd}
                        disabled={submitting || !manualBarcode.trim()}
                        style={{
                          padding: '12px',
                          background: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          opacity: (submitting || !manualBarcode.trim()) ? 0.6 : 1
                        }}
                      >
                        {submitting ? 'Processing...' : '✓ Verify & Return'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: History */}
              {activeTab === 'history' && (
                <div className="receiving-history">
                  <div className="section-header" style={{
                    marginBottom: '20px',
                    paddingBottom: '10px',
                    borderBottom: '2px solid #667eea'
                  }}>
                    <h3 style={{ margin: 0, color: '#333' }}>📜 Receiving History</h3>
                    <p style={{ margin: '5px 0 0', color: '#666', fontSize: '14px' }}>Previous returns recorded for this Lot</p>
                  </div>
                  
                  {receivingHistory.length === 0 ? (
                    <div className="empty-state" style={{ textAlign: 'center', padding: '40px', background: '#f9f9f9', borderRadius: '8px' }}>
                      <p>No receiving records found for this lot.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto' }}>
                      {receivingHistory.map((record, index) => {
                        const recWeight = record.returnedWeight || record.weight || 0;
                        return (
                          <div key={index} style={{
                            padding: '16px',
                            background: 'white',
                            border: '1px solid #e0e0e0',
                            borderRadius: '10px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                              <strong style={{ color: '#333', fontSize: '15px' }}>🏷️ {record.barcodeId}</strong>
                              <span style={{ fontSize: '12px', color: '#888' }}>
                                {new Date(record.receivedAt || record.returnDate || new Date()).toLocaleString()}
                              </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', fontSize: '13px', color: '#666' }}>
                              <span>🎨 Shade: {record.shade || 'N/A'}</span>
                              <span>⚖️ Returned Weight: <strong style={{ color: '#4caf50' }}>{parseFloat(recWeight).toFixed(2)} kg</strong></span>
                              <span>👤 Received By: {record.receivedBy || 'N/A'}</span>
                              <span>📝 Reason: {record.reason || 'Returned'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {showStickerGenerator && currentReturnData && (
        <ReturnStickerGenerator
          returnData={currentReturnData}
          onClose={handleCloseStickerGenerator}
          onStickerGenerated={handleStickerGenerated}
        />
      )}
    </>
  );
};

export default FabricReceiving;
