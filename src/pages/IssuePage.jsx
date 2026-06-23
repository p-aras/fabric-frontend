import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FabricReceiving from './FabricReceiving.jsx';
import '../Design/FabricIssued.css';

import { BASE_URL } from '../store.js';

const FabricIssued = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [fabricRollData, setFabricRollData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchLot, setSearchLot] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [issueQuantity, setIssueQuantity] = useState({});
  const [issueWeight, setIssueWeight] = useState({});
  const [issueHistory, setIssueHistory] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedRoll, setScannedRoll] = useState(null);
  const [selectedShades, setSelectedShades] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scannedBarcodes, setScannedBarcodes] = useState({});
  const [showReceiving, setShowReceiving] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);

  // Pagination states for history
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotalRows, setHistoryTotalRows] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  // Global duplicate prevention states
  const [globalIssuedBarcodes, setGlobalIssuedBarcodes] = useState(new Set());
  const [isLoadingBarcodes, setIsLoadingBarcodes] = useState(false);
  const [duplicateCheckCache, setDuplicateCheckCache] = useState({});

  // Barcode search states
  const [searchBarcodeInput, setSearchBarcodeInput] = useState('');
  const [searchedRoll, setSearchedRoll] = useState(null);
  const [isSearchingRoll, setIsSearchingRoll] = useState(false);
  const [searchRollError, setSearchRollError] = useState(null);
  const [fabricApprovals, setFabricApprovals] = useState({});
  const [defaultApproverName, setDefaultApproverName] = useState('');

  const barcodeInputRef = useRef(null);
  const scanTimeoutRef = useRef(null);
  const historyObserverRef = useRef(null);
  const historyEndRef = useRef(null);


  const API_BASE_URL = BASE_URL;
  const BASE_SHADE_FILTER = 'RUST';

  // Load logged in user data
  useEffect(() => {
    const userData = localStorage.getItem('twms_user');
    if (userData) {
      setLoggedInUser(JSON.parse(userData));
    }
  }, []);

  const getDisplayName = () => {
    return loggedInUser?.name || loggedInUser?.id || 'User';
  };

  // Helper function to normalize shade names by removing any bracketed suffixes like [2] and any parenthetical descriptors
  const normalizeShadeName = (shadeName) => {
    if (!shadeName) return '';
    return shadeName
      .replace(/\[.*?\]/g, '') // remove [...] parts
      .replace(/\(.*?\)/g, '') // remove (...) parts
      .trim()
      .replace(/\s+/g, ' ');
  };

  // Helper function to get shades with unique IDs (handles duplicates)
  const getShadesWithIds = (shadeStr) => {
    if (!shadeStr) return [];
    const shades = shadeStr.split(',').map(s => s.trim());
    return shades.map((shade, index) => ({
      id: `${shade}_${index}`,
      name: shade,
      normalizedName: normalizeShadeName(shade),
      originalIndex: index
    }));
  };

  // Get the current selected shade object
  const getCurrentSelectedShade = () => {
    const selectedShadeId = Object.keys(selectedShades).find(key => selectedShades[key] === true);
    if (!selectedShadeId || !selectedJob) return null;

    const allShades = getShadesWithIds(selectedJob['Shade']);
    return allShades.find(s => s.id === selectedShadeId);
  };

  // Auto-focus barcode input when shade selection changes
  useEffect(() => {
    if (barcodeInputRef.current && Object.keys(selectedShades).length > 0) {
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    }
  }, [selectedShades]);

  useEffect(() => {
    if (selectedJob && barcodeInputRef.current) {
      if (Object.keys(selectedShades).length > 0) {
        setTimeout(() => {
          barcodeInputRef.current?.focus();
        }, 100);
      }
    }
  }, [selectedJob]);

  // Fetch all issued barcodes from backend (global tracking)
  const fetchAllIssuedBarcodes = async () => {
    setIsLoadingBarcodes(true);
    try {
      console.log('📡 Fetching all issued barcodes from Google Sheets...');
      const response = await fetch(`${API_BASE_URL}/all-issued-barcodes`);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const resData = await response.json();

      if (resData.success && resData.data) {
        const barcodeSet = new Set(resData.data);
        setGlobalIssuedBarcodes(barcodeSet);
        console.log(`✅ Loaded ${barcodeSet.size} unique issued barcodes from Google Sheets`);

        localStorage.setItem('globalIssuedBarcodes', JSON.stringify(Array.from(barcodeSet)));
        localStorage.setItem('globalIssuedBarcodesLastUpdated', new Date().toISOString());

        return barcodeSet;
      } else {
        console.warn('⚠️ Failed to fetch issued barcodes, using localStorage backup');
        return loadIssuedBarcodesFromLocalStorage();
      }
    } catch (error) {
      console.error('Error fetching issued barcodes:', error);
      return loadIssuedBarcodesFromLocalStorage();
    } finally {
      setIsLoadingBarcodes(false);
    }
  };

  // Load from localStorage backup
  const loadIssuedBarcodesFromLocalStorage = () => {
    const stored = localStorage.getItem('globalIssuedBarcodes');
    if (stored) {
      const barcodeArray = JSON.parse(stored);
      const barcodeSet = new Set(barcodeArray);
      setGlobalIssuedBarcodes(barcodeSet);
      console.log(`📦 Loaded ${barcodeSet.size} barcodes from localStorage backup`);
      return barcodeSet;
    }
    return new Set();
  };

  // Check if barcode was ever issued globally
  const isBarcodeGloballyIssued = (barcodeId) => {
    if (duplicateCheckCache[barcodeId] !== undefined) {
      return duplicateCheckCache[barcodeId];
    }

    if (globalIssuedBarcodes.has(barcodeId)) {
      setDuplicateCheckCache(prev => ({ ...prev, [barcodeId]: true }));
      return true;
    }

    const currentSessionBarcodes = Object.values(scannedBarcodes).flat();
    if (currentSessionBarcodes.includes(barcodeId)) {
      setDuplicateCheckCache(prev => ({ ...prev, [barcodeId]: true }));
      return true;
    }

    for (const record of issueHistory) {
      const items = record.items || record.issuedItems;
      if (items) {
        for (const item of items) {
          if (item.barcodeIds) {
            if (Array.isArray(item.barcodeIds) && item.barcodeIds.includes(barcodeId)) {
              setDuplicateCheckCache(prev => ({ ...prev, [barcodeId]: true }));
              return true;
            }
            if (typeof item.barcodeIds === 'string' && item.barcodeIds.includes(barcodeId)) {
              setDuplicateCheckCache(prev => ({ ...prev, [barcodeId]: true }));
              return true;
            }
          }
        }
      }

      if (record.barcodeIds) {
        if (Array.isArray(record.barcodeIds) && record.barcodeIds.includes(barcodeId)) {
          setDuplicateCheckCache(prev => ({ ...prev, [barcodeId]: true }));
          return true;
        }
        if (typeof record.barcodeIds === 'string' && record.barcodeIds.includes(barcodeId)) {
          setDuplicateCheckCache(prev => ({ ...prev, [barcodeId]: true }));
          return true;
        }
      }
    }

    setDuplicateCheckCache(prev => ({ ...prev, [barcodeId]: false }));
    return false;
  };

  const fetchSheetData = async () => {
    // Optimized: Skip loading all job orders and fabric rolls on mount for instant load.
    setLoading(false);
  };

  useEffect(() => {
    fetchSheetData();
    fetchAllIssuedBarcodes();
  }, []);

  const handleSearch = async () => {
    if (!searchLot.trim()) {
      setSelectedJob(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      console.log(`Searching Lot Number via backend: ${searchLot.trim()}`);

      const response = await fetch(`${API_BASE_URL}/job-orders/search/${searchLot.trim()}`);
      if (!response.ok) {
        throw new Error('Lot Number not found');
      }

      const resData = await response.json();
      if (resData.success && resData.data) {
        const found = resData.data;
        setSelectedJob(found);
        setIssueQuantity({});
        setIssueWeight({});
        setSelectedShades({});
        setScannedBarcodes({});
        setFabricApprovals({});
        setDefaultApproverName('');
        // Reset pagination when loading new lot
        setHistoryPage(1);
        setHasMoreHistory(true);
        loadIssueHistoryPaginated(found['Lot Number'], 1, true);

        // Fetch prior approvals for this lot from database
        try {
          const apprvRes = await fetch(`${API_BASE_URL}/fabric-approvals/${encodeURIComponent(found['Lot Number'])}`);
          if (apprvRes.ok) {
            const apprvData = await apprvRes.json();
            if (apprvData && apprvData.success && apprvData.data && apprvData.data.length > 0) {
              const lastApproval = apprvData.data.find(a => a.approvedBy && a.approvedBy.trim());
              if (lastApproval) {
                setDefaultApproverName(lastApproval.approvedBy);
                console.log(`📜 Loaded prior approval name: "${lastApproval.approvedBy}" from database.`);
              }
            }
          }
        } catch (apprvErr) {
          console.error('Error fetching approvals for lot:', apprvErr);
        }
      } else {
        setSelectedJob(null);
        alert('Lot Number not found');
      }
    } catch (err) {
      setSelectedJob(null);
      alert(err.message || 'Lot Number not found');
    } finally {
      setLoading(false);
    }
  };

  // Get total issued weight for a specific shade (from all historical issuances)
  const getTotalIssuedWeightForShade = (shadeName, shadeEntry = null) => {
    let totalWeight = 0;
    let totalRolls = 0;
    const allBarcodes = [];

    issueHistory.forEach(record => {
      if (record.items && record.items.length > 0) {
        record.items.forEach(item => {
          const shadeMatches = item.shade === shadeName;
          const entryMatches = shadeEntry === null || item.shadeEntry === shadeEntry;

          if (shadeMatches && entryMatches) {
            totalWeight += parseFloat(item.weight) || 0;
            totalRolls += parseInt(item.qty || item.quantity) || 0;
            if (item.barcodeIds) {
              allBarcodes.push(...item.barcodeIds);
            }
          }
        });
      }
    });

    return { totalWeight, totalRolls, allBarcodes };
  };

  // Get total issued for entire lot
  const getTotalLotIssued = () => {
    let totalWeight = 0;
    let totalRolls = 0;
    const allBarcodes = [];

    issueHistory.forEach(record => {
      totalWeight += parseFloat(record.totalWeight) || 0;
      totalRolls += parseInt(record.totalRolls || record.totalQuantity) || 0;
      if (record.barcodeIds) {
        allBarcodes.push(...record.barcodeIds);
      }
    });

    return { totalWeight, totalRolls, allBarcodes };
  };

  // NEW: Load issuance history with pagination
  const loadIssueHistoryPaginated = async (lotNumber, page = 1, resetHistory = false) => {
    if (!lotNumber) return;

    if (resetHistory) {
      setLoadingHistory(true);
      setIssueHistory([]);
    } else {
      setLoadingHistory(true);
    }

    try {
      console.log(`📡 Loading paginated issuance history for lot: ${lotNumber}, Page: ${page}`);

      const response = await fetch(`${API_BASE_URL}/issuance-history/${lotNumber}?page=${page}&pageSize=20`);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const resData = await response.json();

      if (resData.success && resData.data) {
        const historyData = resData.data;
        const pagination = resData.pagination;

        if (resetHistory) {
          setIssueHistory(historyData);
        } else {
          setIssueHistory(prev => [...prev, ...historyData]);
        }

        setHistoryPage(pagination?.currentPage || page);
        setHistoryTotalPages(pagination?.totalPages || 1);
        setHistoryTotalRows(pagination?.totalRows || historyData.length);
        setHasMoreHistory(pagination?.hasNextPage || false);

        console.log(`✅ Loaded ${historyData.length} issuance records (Page ${page}/${pagination?.totalPages || 1})`);

        // Store in localStorage as backup
        if (resetHistory) {
          localStorage.setItem(`fabric_issue_${lotNumber}`, JSON.stringify(historyData));
        }

        return historyData;
      }
      return [];

    } catch (error) {
      console.error('Error loading paginated history from backend:', error);

      // Fallback to localStorage if available
      if (resetHistory) {
        const stored = localStorage.getItem(`fabric_issue_${lotNumber}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setIssueHistory(parsed);
          setHasMoreHistory(false);
          return parsed;
        }
      }
      return [];

    } finally {
      setLoadingHistory(false);
    }
  };

  // Load next page of history (infinite scroll)
  const loadMoreHistory = useCallback(() => {
    if (!hasMoreHistory || loadingHistory || !selectedJob) return;

    const nextPage = historyPage + 1;
    if (nextPage <= historyTotalPages) {
      loadIssueHistoryPaginated(selectedJob['Lot Number'], nextPage, false);
    }
  }, [hasMoreHistory, loadingHistory, historyPage, historyTotalPages, selectedJob]);

  // Set up intersection observer for infinite scroll on history
  useEffect(() => {
    if (!historyEndRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreHistory && !loadingHistory) {
          loadMoreHistory();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(historyEndRef.current);

    return () => {
      if (observer) observer.disconnect();
    };
  }, [hasMoreHistory, loadingHistory, loadMoreHistory]);

  // Store issuance in Google Sheets via backend
  const storeIssuanceInGoogleSheets = async (issuanceRecord) => {
    try {
      console.log('📤 Storing issuance to backend:', issuanceRecord);

      const payload = {
        ...issuanceRecord,
        barcodeIds: issuanceRecord.barcodeIds || [],
        issuedItems: issuanceRecord.issuedItems.map(item => ({
          ...item,
          barcodeIds: item.barcodeIds || []
        }))
      };

      const response = await fetch(`${API_BASE_URL}/store-fabric-issuance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const resData = await response.json();

      if (resData.success) {
        console.log('✓ Issuance stored successfully:', resData);
        return { success: true, data: resData.data || resData };
      } else {
        console.warn('⚠️ Storage issue:', resData.message);
        return { success: false, message: resData.message };
      }

    } catch (error) {
      console.error('❌ Error storing issuance:', error);

      let errorMsg = '';
      if (error.code === 'ECONNREFUSED') {
        errorMsg = 'Backend server not running. Data saved offline.';
      } else if (error.code === 'ERR_NETWORK') {
        errorMsg = 'Network error. Data saved offline.';
      } else {
        errorMsg = error.message;
      }

      return { success: false, message: errorMsg, offline: true };
    }
  };

  // Sync offline issuances when back online
  const syncOfflineIssuances = async () => {
    const offlineData = JSON.parse(localStorage.getItem('offlineFabricIssuances') || '[]');

    if (offlineData.length === 0) return;

    console.log(`🔄 Syncing ${offlineData.length} offline issuances...`);

    try {
      const response = await fetch(`${API_BASE_URL}/sync-offline-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          offlineData: offlineData,
          dataType: 'issuance'
        })
      });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const resData = await response.json();

      if (resData.success) {
        console.log('✓ Offline issuances synced:', resData);
        localStorage.removeItem('offlineFabricIssuances');
        alert(`✓ Synced ${offlineData.length} offline issuances to Google Sheets`);
      }
    } catch (error) {
      console.error('Failed to sync offline issuances:', error);
    }
  };

  const handleReceiveComplete = (receivingRecord) => {
    console.log('Receiving completed:', receivingRecord);

    if (receivingRecord) {
      if (receivingRecord.totalQuantity !== undefined) {
        alert(`✅ Fabric Return Recorded!\n\n📦 Total Returned: ${receivingRecord.totalQuantity} units\n⚖️ Total Weight: ${(parseFloat(receivingRecord.totalWeight) || 0).toFixed(2)} kg`);
      } else if (receivingRecord.shadeName) {
        alert(`✅ Shade Return Recorded!\n\n🎨 Shade: ${receivingRecord.shadeName}\n⚖️ Return Weight: ${(parseFloat(receivingRecord.returnWeight || receivingRecord.weight) || 0).toFixed(2)} kg\n📦 Processed across multiple rolls`);
      } else {
        alert(`✅ Fabric Return Recorded!\n\n📦 Barcode: ${receivingRecord.barcodeId || 'N/A'}\n🎨 Shade: ${receivingRecord.shade || 'N/A'}\n⚖️ Return Weight: ${(parseFloat(receivingRecord.returnWeight || receivingRecord.weight) || 0).toFixed(2)} kg\n📝 Reason: ${receivingRecord.reason || 'Returned'}`);
      }
    } else {
      alert('✅ Fabric return recorded successfully!');
    }

    if (selectedJob) {
      // Reload history from first page after return
      loadIssueHistoryPaginated(selectedJob['Lot Number'], 1, true);
    }
  };

  const toggleShadeSelection = (shadeId) => {
    if (selectedShades[shadeId]) {
      setSelectedShades({});
    } else {
      const newSelection = {};
      newSelection[shadeId] = true;
      setSelectedShades(newSelection);
    }
  };

  const selectFirstShade = () => {
    const allShadesWithIds = getShadesWithIds(selectedJob['Shade']);
    if (allShadesWithIds.length > 0) {
      const newSelection = {};
      newSelection[allShadesWithIds[0].id] = true;
      setSelectedShades(newSelection);
      console.log('Selected first shade entry:', allShadesWithIds[0].name, '(Entry 1)');
    }
  };

  const deselectAllShades = () => {
    setSelectedShades({});
  };

  const processBarcode = async (barcodeData) => {
    if (!selectedJob) {
      alert('Please select a Lot Number first');
      setBarcodeInput('');
      return;
    }

    const selectedShadeIds = Object.keys(selectedShades).filter(shadeId => selectedShades[shadeId]);
    if (selectedShadeIds.length === 0) {
      alert('Please select a shade entry before scanning');
      setBarcodeInput('');
      return;
    }

    if (selectedShadeIds.length > 1) {
      alert('Error: Multiple shades selected. Please select only one shade entry.');
      setSelectedShades({});
      setBarcodeInput('');
      return;
    }

    const allShadesWithIds = getShadesWithIds(selectedJob['Shade']);
    const selectedShadeObj = allShadesWithIds.find(s => s.id === selectedShadeIds[0]);
    const selectedShadeName = selectedShadeObj ? selectedShadeObj.name : '';
    const selectedShadeNormalizedName = selectedShadeObj ? selectedShadeObj.normalizedName : '';
    const selectedShadeId = selectedShadeIds[0];
    const selectedShadeEntryNum = selectedShadeObj ? selectedShadeObj.originalIndex + 1 : 1;

    let barcodeId = barcodeData;
    let scannedWeight = null;

    if (barcodeData.includes('|')) {
      const parts = barcodeData.split('|');
      barcodeId = parts[0].trim();
      scannedWeight = parseFloat(parts[1].trim());
    }

    barcodeId = barcodeId.replace(/[\n\r\t\s]/g, '').trim();

    console.log('🔍 Searching for Barcode ID (On-demand):', barcodeId);

    if (isBarcodeGloballyIssued(barcodeId)) {
      alert(`❌ DUPLICATE BARCODE REJECTED!\n\nBarcode ID: ${barcodeId}\n\nThis barcode has ALREADY BEEN ISSUED in a previous transaction.`);
      setBarcodeInput('');
      return;
    }

    let matchingRoll = null;
    try {
      const response = await fetch(`${API_BASE_URL}/google-sheets/fabric-roll/${encodeURIComponent(barcodeId)}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          matchingRoll = result.data;
        }
      }
    } catch (err) {
      console.error('Error fetching roll barcode on-demand:', err);
    }

    if (!matchingRoll) {
      alert(`❌ Barcode ID "${barcodeId}" not found in inventory!`);
      setBarcodeInput('');
      return;
    }

    const rollStatus = matchingRoll['Status'] || 'in_stock';
    if (rollStatus === 'issued') {
      alert(`❌ Roll ${barcodeId} has already been issued!\n\nStatus: ${rollStatus}`);
      setBarcodeInput('');
      return;
    }

    const rollItemDescription = matchingRoll['Item Description'] || '';
    const jobFabric = selectedJob['Fabric'] || '';

    const fabricMatch = rollItemDescription.toLowerCase().includes(jobFabric.toLowerCase()) ||
      jobFabric.toLowerCase().includes(rollItemDescription.toLowerCase());

    const rollShade = matchingRoll['Shade'] || '';
    const normalizedRollShade = normalizeShadeName(rollShade);
    const shadeMatch = normalizedRollShade.toLowerCase() === selectedShadeNormalizedName.toLowerCase();

    // Check if there is any mismatch (fabric or shade)
    if (!fabricMatch || !shadeMatch) {
      let mismatchMsg = '';
      if (!fabricMatch) mismatchMsg += `• Fabric Mismatch!\n  Scanned: "${rollItemDescription}"\n  Required: "${jobFabric}"\n`;
      if (!shadeMatch) mismatchMsg += `• Shade Mismatch!\n  Scanned: "${rollShade}"\n  Selected: "${selectedShadeName}"\n`;

      let approverName = defaultApproverName;

      if (!approverName) {
        const confirmMessage = `⚠️ Mismatch Detected!\n\n${mismatchMsg}\nDo you want to request approval for this mismatch?`;
        const allowChange = window.confirm(confirmMessage);
        if (allowChange) {
          const inputName = window.prompt("Enter name of the person who approved this mismatch (Shade/Fabric):");
          if (inputName && inputName.trim()) {
            approverName = inputName.trim();
            setDefaultApproverName(approverName); // Cache approval name
            console.log(`✅ Mismatch approved by: "${approverName}"`);
          } else {
            alert("❌ Approval name not entered. Mismatch rejected.");
            setBarcodeInput('');
            return;
          }
        } else {
          alert(`❌ Mismatch rejected.`);
          setBarcodeInput('');
          return;
        }
      } else {
        // Reuse default approval name
        console.log(`✅ Mismatch automatically approved using prior cached approver: "${approverName}"`);
        alert(`⚠️ Mismatch Warning!\n\n${mismatchMsg}\nAutomatically approved by: "${approverName}"`);
      }

      // Record approval for this barcode
      setFabricApprovals(prev => ({
        ...prev,
        [barcodeId]: {
          barcodeId,
          requiredFabric: jobFabric,
          scannedFabric: rollItemDescription,
          requiredShade: selectedShadeName,
          scannedShade: rollShade,
          approvedBy: approverName
        }
      }));
    }

    const partyName = matchingRoll['Party'] || matchingRoll['cmfName'] || matchingRoll['Cmf Name'] || matchingRoll['CMP Name'] || '';

    console.log(`🏭 Found Party Name for roll ${barcodeId}: "${partyName}"`);

    if (!partyName) {
      console.warn(`⚠️ WARNING: No party name found for barcode ${barcodeId}. Party column might be empty.`);
    }

    let finalWeight = 0;
    if (scannedWeight && !isNaN(scannedWeight)) {
      finalWeight = scannedWeight;
    } else if (matchingRoll['MRN WT']) {
      finalWeight = parseFloat(matchingRoll['MRN WT']) || 0;
    } else if (matchingRoll['Weight (KG)']) {
      finalWeight = parseFloat(matchingRoll['Weight (KG)']) || 0;
    }

    if (finalWeight <= 0) {
      alert(`⚠️ Warning: Invalid weight (${finalWeight} kg) for roll ${barcodeId}`);
      setBarcodeInput('');
      return;
    }

    const newIssueWeight = { ...issueWeight };
    const newIssueQuantity = { ...issueQuantity };
    const newScannedBarcodes = { ...scannedBarcodes };

    newIssueWeight[selectedShadeId] = (newIssueWeight[selectedShadeId] || 0) + finalWeight;
    newIssueQuantity[selectedShadeId] = (newIssueQuantity[selectedShadeId] || 0) + 1;

    if (!newScannedBarcodes[selectedShadeId]) {
      newScannedBarcodes[selectedShadeId] = [];
    }

    if (newScannedBarcodes[selectedShadeId].includes(barcodeId)) {
      alert(`⚠️ Barcode ${barcodeId} is already in the current session!`);
      setBarcodeInput('');
      return;
    }

    if (!newScannedBarcodes[`${selectedShadeId}_party`]) {
      newScannedBarcodes[`${selectedShadeId}_party`] = {};
    }
    newScannedBarcodes[`${selectedShadeId}_party`][barcodeId] = partyName;

    newScannedBarcodes[selectedShadeId].push(barcodeId);

    setIssueWeight(newIssueWeight);
    setIssueQuantity(newIssueQuantity);
    setScannedBarcodes(newScannedBarcodes);

    setScannedRoll({
      rollNumber: matchingRoll['Barcode ID'],
      fabric: rollItemDescription,
      shade: rollShade,
      shadeEntry: selectedShadeEntryNum,
      weight: finalWeight,
      party: partyName,
      timestamp: new Date().toLocaleTimeString()
    });

    console.log(`✅ Success! Added to ${selectedShadeName} (Entry ${selectedShadeEntryNum})`);
    console.log(`📊 Current session: ${newIssueQuantity[selectedShadeId]} rolls, ${newIssueWeight[selectedShadeId].toFixed(2)} kg`);
    console.log(`🏭 Party Name for this roll: ${partyName}`);

    setBarcodeInput('');

    setTimeout(() => {
      setScannedRoll(null);
    }, 3000);

    barcodeInputRef.current?.focus();
  };

  const handleBarcodeChange = (e) => {
    const value = e.target.value;
    setBarcodeInput(value);

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    scanTimeoutRef.current = setTimeout(() => {
      if (value.trim()) {
        processBarcode(value.trim());
      }
    }, 300);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      processBarcode(barcodeInput.trim());
    }
  };

  const handleBarcodeSearch = async (barcodeVal) => {
    const cleanBarcode = barcodeVal.replace(/[\n\r\t\s]/g, '').trim();
    if (!cleanBarcode) return;

    setIsSearchingRoll(true);
    setSearchRollError(null);
    setSearchedRoll(null);

    try {
      console.log('🔍 Quick searching barcode details:', cleanBarcode);
      const response = await fetch(`${API_BASE_URL}/google-sheets/fabric-roll/${encodeURIComponent(cleanBarcode)}`);

      if (!response.ok) {
        throw new Error(`Barcode "${cleanBarcode}" not found in inventory`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        setSearchedRoll(result.data);
      } else {
        throw new Error(`Barcode "${cleanBarcode}" not found in inventory`);
      }
    } catch (err) {
      console.error(err);
      setSearchRollError(err.message || 'Error searching barcode');
    } finally {
      setIsSearchingRoll(false);
    }
  };

  const handleIssueFabric = async () => {
    if (!selectedJob) return;

    const issuedShadeIds = Object.keys(issueQuantity).filter(shadeId => issueQuantity[shadeId] > 0);
    if (issuedShadeIds.length === 0) {
      alert('Please scan at least one roll to issue');
      return;
    }

    setIsSubmitting(true);

    const allShadesWithIds = getShadesWithIds(selectedJob['Shade']);

    const issuedItems = issuedShadeIds.map(shadeId => {
      const shadeObj = allShadesWithIds.find(s => s.id === shadeId);
      return {
        id: shadeId,
        shade: shadeObj ? shadeObj.name : shadeId,
        shadeEntry: shadeObj ? shadeObj.originalIndex + 1 : 1,
        qty: issueQuantity[shadeId],
        weight: issueWeight[shadeId] || 0,
        barcodeIds: scannedBarcodes[shadeId] || []
      };
    });

    const totalQuantity = issuedShadeIds.reduce((sum, shadeId) => sum + issueQuantity[shadeId], 0);
    const totalWeight = issuedShadeIds.reduce((sum, shadeId) => sum + (issueWeight[shadeId] || 0), 0);
    const allBarcodeIds = issuedShadeIds.flatMap(shadeId => scannedBarcodes[shadeId] || []);

    const approvalsList = allBarcodeIds
      .map(id => fabricApprovals[id])
      .filter(Boolean);

    const issuanceRecord = {
      lotNumber: selectedJob['Lot Number'],
      jobOrderNo: selectedJob['Job Order No'],
      fabric: selectedJob['Fabric'],
      brand: selectedJob['Brand'],
      issuedItems: issuedItems,
      totalQuantity: totalQuantity,
      totalWeight: totalWeight,
      issuedBy: getDisplayName(),
      department: loggedInUser?.department || 'Production',
      issuedAt: new Date().toISOString(),
      status: 'completed',
      barcodeIds: allBarcodeIds,
      remarks: `Issued ${issuedShadeIds.length} shade types, Total ${totalQuantity} rolls. Barcodes: ${allBarcodeIds.join(', ')}`,
      jobDetails: selectedJob,
      fabricChangeApprovals: approvalsList
    };

    console.log('📦 Issuance Record with Barcodes:', issuanceRecord);

    const result = await storeIssuanceInGoogleSheets(issuanceRecord);

    if (result.success) {
      const updatedGlobalSet = new Set(globalIssuedBarcodes);
      allBarcodeIds.forEach(id => updatedGlobalSet.add(id));
      setGlobalIssuedBarcodes(updatedGlobalSet);

      localStorage.setItem('globalIssuedBarcodes', JSON.stringify(Array.from(updatedGlobalSet)));
      localStorage.setItem('globalIssuedBarcodesLastUpdated', new Date().toISOString());

      setDuplicateCheckCache({});

      const newIssueRecord = {
        id: Date.now(),
        issuanceId: result.data?.issuanceId,
        ...issuanceRecord,
        items: issuedItems
      };

      // Add to history (prepend, not append for reverse chronological)
      const updatedHistory = [newIssueRecord, ...issueHistory];
      setIssueHistory(updatedHistory);
      localStorage.setItem(`fabric_issue_${selectedJob['Lot Number']}`, JSON.stringify(updatedHistory));

      alert(`✅ Issued Successfully!\n\n📦 Total Rolls: ${totalQuantity}\n⚖️ Total Weight: ${totalWeight.toFixed(2)} kg\n🏷️ Barcodes: ${allBarcodeIds.length} scanned\n✓ Data saved to Google Sheets`);

      setIssueQuantity({});
      setIssueWeight({});
      setScannedRoll(null);
      setSelectedShades({});
      setScannedBarcodes({});
      setFabricApprovals({});
      setDefaultApproverName('');

      // Reset pagination and reload history
      setHistoryPage(1);
      setHasMoreHistory(true);
      loadIssueHistoryPaginated(selectedJob['Lot Number'], 1, true);
    } else {
      const offlineRecord = {
        ...issuanceRecord,
        offlineSavedAt: new Date().toISOString()
      };

      const offlineData = JSON.parse(localStorage.getItem('offlineFabricIssuances') || '[]');
      offlineData.push(offlineRecord);
      localStorage.setItem('offlineFabricIssuances', JSON.stringify(offlineData));

      const updatedGlobalSet = new Set(globalIssuedBarcodes);
      allBarcodeIds.forEach(id => updatedGlobalSet.add(id));
      setGlobalIssuedBarcodes(updatedGlobalSet);
      localStorage.setItem('globalIssuedBarcodes', JSON.stringify(Array.from(updatedGlobalSet)));

      alert(`⚠️ Issuance recorded but saved offline.\n\n📦 Total Rolls: ${totalQuantity}\n⚖️ Total Weight: ${totalWeight.toFixed(2)} kg\n🏷️ Barcodes: ${allBarcodeIds.length} scanned\n\nData will sync when connection is restored.`);

      const newIssueRecord = {
        id: Date.now(),
        ...issuanceRecord,
        offline: true
      };

      const updatedHistory = [newIssueRecord, ...issueHistory];
      setIssueHistory(updatedHistory);
      localStorage.setItem(`fabric_issue_${selectedJob['Lot Number']}`, JSON.stringify(updatedHistory));

      setIssueQuantity({});
      setIssueWeight({});
      setScannedRoll(null);
      setSelectedShades({});
      setScannedBarcodes({});
      setFabricApprovals({});
      setDefaultApproverName('');
    }

    setIsSubmitting(false);
  };

  const getTotalIssuedQuantity = () => {
    return issueHistory.reduce((sum, record) => sum + (parseInt(record.totalQuantity || record.totalQty) || 0), 0);
  };

  const getTotalIssuedWeight = () => {
    return issueHistory.reduce((sum, record) => sum + (parseFloat(record.totalWeight) || 0), 0);
  };

  const getShadeColor = (shade) => {
    const colors = {
      'BLACK': '#1a1a1a',
      'WHITE': '#ffffff',
      'OFF-WHITE': '#f5f5dc',
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
    return colors[shade.toUpperCase()] || '#2a5298';
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  useEffect(() => {
    const handleOnline = () => {
      syncOfflineIssuances();
      fetchAllIssuedBarcodes();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const currentSelectedShade = getCurrentSelectedShade();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading Fabric Issuance System...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h3>Unable to Load Data</h3>
        <p>{error}</p>
        <button onClick={fetchSheetData} className="retry-btn">
          🔄 Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="fabric-issued-container">

      <div className="hero-section">
        <div className="hero-content">
          <h1>Fabric Issuance Portal</h1>
          <p>Search by Lot Number to issue fabric against job orders</p>
          {!selectedJob && (
            <div className="hero-search">
              <div className="search-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Enter Lot Number (e.g., 11028)"
                  value={searchLot}
                  onChange={(e) => setSearchLot(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="hero-input"
                />
              </div>
              <button onClick={handleSearch} className="hero-button">
                Search Lot
              </button>
              <button onClick={fetchSheetData} className="hero-button secondary">
                Refresh Data
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedJob ? (
        <div className="dashboard">
          {/* Previously Issued Summary Panel */}
          {issueHistory.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px',
              color: 'white'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, fontSize: '18px' }}>📊 Previously Issued Summary for Lot {selectedJob['Lot Number']}</h3>
                <div style={{ fontSize: '14px', background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '8px' }}>
                  Total Issued: {getTotalIssuedWeight().toFixed(2)} kg
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                {getShadesWithIds(selectedJob['Shade']).map((shadeObj) => {
                  const shadeName = shadeObj.name;
                  const shadeEntryNum = shadeObj.originalIndex + 1;

                  const previouslyIssued = getTotalIssuedWeightForShade(shadeName, shadeEntryNum);
                  const wasPreviouslyIssued = previouslyIssued.totalRolls > 0;

                  if (!wasPreviouslyIssued) return null;

                  return (
                    <div key={`prev-${shadeObj.id}`} style={{
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      padding: '12px',
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                        {shadeName} {getShadesWithIds(selectedJob['Shade']).filter(s => normalizeShadeName(s.name) === normalizeShadeName(shadeName)).length > 1 && `(Entry ${shadeEntryNum})`}
                      </div>
                      <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                        📦 Rolls: <strong>{previouslyIssued.totalRolls}</strong> | ⚖️ Weight: <strong>{previouslyIssued.totalWeight.toFixed(2)} kg</strong>
                      </div>
                      {previouslyIssued.allBarcodes.length > 0 && (
                        <details>
                          <summary style={{ fontSize: '11px', cursor: 'pointer', opacity: 0.8 }}>
                            🏷️ Barcodes ({previouslyIssued.allBarcodes.length})
                          </summary>
                          <div style={{ marginTop: '5px', fontSize: '10px', maxHeight: '60px', overflowY: 'auto' }}>
                            {previouslyIssued.allBarcodes.map((barcode, idx) => (
                              <div key={idx} style={{ fontFamily: 'monospace' }}>{barcode}</div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action & Search Bar */}
          <div className="top-bar-container">
            <div className="top-search-group">
              <div className="top-search-wrapper">
                <span className="top-search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Enter Lot Number (e.g., 11028)"
                  value={searchLot}
                  onChange={(e) => setSearchLot(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="top-search-input"
                />
              </div>
              <button onClick={handleSearch} className="top-search-btn">
                Search Lot
              </button>
              <button onClick={fetchSheetData} className="top-refresh-btn">
                Refresh Data
              </button>
            </div>
            <button
              onClick={() => setShowReceiving(true)}
              className="top-receiving-btn"
            >
              <span style={{ fontSize: '18px' }}>📥</span>
              Receive Returned Fabric
            </button>
          </div>

          {/* Barcode Scanner Section */}
          <div className="scanner-section-modern">
            <div className="scanner-header-modern">
              <div className="scanner-title">
                <span className="scanner-icon">📷</span>
                <h3>Barcode Scanner</h3>
              </div>
              <div className="scanner-stats">
                <div className="stat-badge-sm">
                  <span>Total Scanned Rolls:</span>
                  <strong>{Object.values(issueQuantity).reduce((a, b) => a + b, 0)}</strong>
                </div>
              </div>
            </div>
            <div className="scanner-grid-split">
              {/* Left Panel: Scanner (Auto-adds to transaction) */}
              <div className="scanner-box-panel">
                <h4>📷 Scanner (Auto-adds to transaction)</h4>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={handleBarcodeChange}
                  onKeyPress={handleKeyPress}
                  placeholder="Scan barcode to issue... (Format: BarcodeID|Weight)"
                  className="scanner-input-modern"
                  autoFocus
                  disabled={isSubmitting}
                />
                <div className="scanner-hint-modern">
                  <span>💡 Tip: Scan barcode in format <strong>BarcodeID|Weight</strong> (e.g., 181200|15.75)</span>
                  <span>🔒 System verifies fabric type & shade match (ignores [1], [2] suffixes)</span>
                  <span>🎨 Each shade entry is treated separately</span>
                  <span>⚠️ <strong>Global Tracking:</strong> Barcodes cannot be re-used across ANY lot</span>
                  <span>✨ <strong>Auto-focus:</strong> Input automatically focuses when shade is selected</span>
                </div>
              </div>

              {/* Right Panel: Search (Query roll details without issuing) */}
              <div className="scanner-box-panel">
                <h4>🔍 Quick Barcode Search (Inspect roll details)</h4>
                <div className="search-input-wrapper">
                  <input
                    type="text"
                    value={searchBarcodeInput}
                    onChange={(e) => setSearchBarcodeInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleBarcodeSearch(searchBarcodeInput)}
                    placeholder="Type barcode ID here and press Enter..."
                    className="scanner-input-modern"
                  />
                  <button
                    onClick={() => handleBarcodeSearch(searchBarcodeInput)}
                    className="search-barcode-btn"
                    disabled={isSearchingRoll}
                  >
                    {isSearchingRoll ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {searchRollError && (
                  <div className="searched-roll-card error">
                    ❌ {searchRollError}
                  </div>
                )}

                {searchedRoll && (
                  <div className="searched-roll-card success">
                    <div className="searched-roll-header">
                      <strong>🏷️ Barcode: {searchedRoll['Barcode ID']}</strong>
                      <span className={`searched-roll-status ${searchedRoll['Status'] === 'issued' ? 'issued' : 'in_stock'}`}>
                        {searchedRoll['Status'] === 'issued' ? 'Issued' : 'In Stock'}
                      </span>
                    </div>
                    <div className="searched-roll-details">
                      <div className="searched-roll-item">
                        <span className="searched-roll-label">Fabric / Item Description</span>
                        <span className="searched-roll-value">{searchedRoll['Item Description']}</span>
                      </div>
                      <div className="searched-roll-item">
                        <span className="searched-roll-label">Shade</span>
                        <span className="searched-roll-value">{searchedRoll['Shade'] || '—'}</span>
                      </div>
                      <div className="searched-roll-item">
                        <span className="searched-roll-label">Weight</span>
                        <span className="searched-roll-value">{searchedRoll['Weight (KG)']} kg</span>
                      </div>
                      <div className="searched-roll-item">
                        <span className="searched-roll-label">Party / Source</span>
                        <span className="searched-roll-value">{searchedRoll['Party'] || searchedRoll['cmfName'] || '—'}</span>
                      </div>
                    </div>
                    {searchedRoll['Status'] !== 'issued' && (
                      <button
                        onClick={() => {
                          processBarcode(searchedRoll['Barcode ID']);
                          setSearchedRoll(null);
                          setSearchBarcodeInput('');
                        }}
                        style={{
                          marginTop: '12px',
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'block',
                          width: '100%',
                          textAlign: 'center',
                          transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.background = '#059669'}
                        onMouseOut={(e) => e.target.style.background = '#10b981'}
                      >
                        ➕ Add to Issue List
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {isLoadingBarcodes && (
              <div style={{
                marginTop: '8px',
                padding: '6px 12px',
                background: '#e0f2fe',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#0369a1',
                textAlign: 'center'
              }}>
                🔄 Loading global barcode registry...
              </div>
            )}
            {!isLoadingBarcodes && globalIssuedBarcodes.size > 0 && (
              <div style={{
                marginTop: '8px',
                padding: '4px 8px',
                background: '#d1fae5',
                borderRadius: '4px',
                fontSize: '10px',
                color: '#065f46',
                textAlign: 'center'
              }}>
                ✓ {globalIssuedBarcodes.size} unique barcodes tracked globally (no duplicates allowed)
              </div>
            )}

            {scannedRoll && (
              <div className="scan-success-card">
                <div className="success-icon">✓</div>
                <div className="success-details">
                  <div className="success-title">Last Scan Successful</div>
                  <div className="success-info">
                    <span>📦 {scannedRoll.rollNumber}</span>
                    <span>🧵 {scannedRoll.fabric}</span>
                    <span>🎨 {scannedRoll.shade} {scannedRoll.shadeEntry && `(Entry ${scannedRoll.shadeEntry})`}</span>
                    <span>⚖️ {scannedRoll.weight} kg</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Job Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card">
              <div className="card-icon">📋</div>
              <div className="card-content">
                <span className="card-label">Job Order</span>
                <span className="card-value">{selectedJob['Job Order No']}</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-icon">🏷️</div>
              <div className="card-content">
                <span className="card-label">Lot Number</span>
                <span className="card-value highlight">{selectedJob['Lot Number']}</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-icon">🧵</div>
              <div className="card-content">
                <span className="card-label">Fabric Type</span>
                <span className="card-value">{selectedJob['Fabric']}</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-icon">📦</div>
              <div className="card-content">
                <span className="card-label">Total Quantity</span>
                <span className="card-value">{selectedJob['Quantity']} {selectedJob['Unit']}</span>
              </div>
            </div>
          </div>

          {/* Shade Selection Toolbar */}
          <div className="shade-toolbar">
            <div className="shade-toolbar-left">
              <span className="shade-toolbar-label">🎨 Select Shade Entry to Scan:</span>
              <div className="shade-toolbar-buttons">
                <button onClick={selectFirstShade} className="shade-btn select-all" disabled={isSubmitting}>
                  ✓ Select First Shade
                </button>
                <button onClick={deselectAllShades} className="shade-btn deselect-all" disabled={isSubmitting}>
                  ✗ Deselect All
                </button>
              </div>
            </div>
            <div className="shade-selection-count">
              {currentSelectedShade ? `Scanning: ${currentSelectedShade.name} (Entry ${currentSelectedShade.originalIndex + 1})` : 'No shade selected'}
            </div>
          </div>

          {/* Main Dashboard Grid */}
          <div className="dashboard-grid-two-col">
            {/* Left Column - Job Details */}
            <div className="info-panel">
              <div className="panel-header">
                <div className="panel-title">
                  <span className="title-icon">📄</span>
                  <h3>Job Order Details</h3>
                </div>
              </div>
              <div className="panel-body">
                <div className="info-grid">
                  <div className="info-group">
                    <h4>Basic Information</h4>
                    <div className="info-row">
                      <span className="info-label">Date:</span>
                      <span className="info-value">{selectedJob['Date']}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Fabric:</span>
                      <span className="info-value">{selectedJob['Fabric']}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Brand:</span>
                      <span className="info-value">{selectedJob['Brand']}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Size:</span>
                      <span className="info-value">{selectedJob['Size']}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Unit:</span>
                      <span className="info-value">{selectedJob['Unit']}</span>
                    </div>
                  </div>

                  <div className="info-group">
                    <h4>Production Details</h4>
                    <div className="info-row">
                      <span className="info-label">Garment Type:</span>
                      <span className="info-value">{selectedJob['Garment Type']}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Section:</span>
                      <span className="info-value">{selectedJob['Section']}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Season:</span>
                      <span className="info-value">{selectedJob['Season']}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Pattern/Style:</span>
                      <span className="info-value">{selectedJob['Pattern']} / {selectedJob['Style']}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Current Issuance */}
            <div className="issuance-panel">
              <div className="panel-header">
                <div className="panel-title">
                  <span className="title-icon">✂️</span>
                  <h3>Current Issuance</h3>
                </div>
                <div className="issuance-stats">
                  <div className="stat-chip">
                    <span>📊 Total Rolls</span>
                    <strong>{Object.values(issueQuantity).reduce((a, b) => a + b, 0)}</strong>
                  </div>
                  <div className="stat-chip">
                    <span>⚖️ Total Weight</span>
                    <strong>{Object.values(issueWeight).reduce((a, b) => a + b, 0).toFixed(2)} kg</strong>
                  </div>
                </div>
              </div>
              <div className="panel-body">
                <div className="shades-list">
                  {getShadesWithIds(selectedJob['Shade']).map((shadeObj, idx) => {
                    const shadeId = shadeObj.id;
                    const shadeName = shadeObj.name;
                    const shadeEntryNum = shadeObj.originalIndex + 1;

                    const previouslyIssued = getTotalIssuedWeightForShade(shadeName, shadeEntryNum);
                    const totalIssuedQty = previouslyIssued.totalRolls;
                    const totalIssuedWeight = previouslyIssued.totalWeight;
                    const currentQty = issueQuantity[shadeId] || 0;
                    const currentWeight = issueWeight[shadeId] || 0;
                    const isSelected = selectedShades[shadeId] || false;
                    const scannedCount = scannedBarcodes[shadeId]?.length || 0;
                    const wasPreviouslyIssued = totalIssuedQty > 0;

                    return (
                      <div className={`shade-item ${isSelected ? 'selected' : ''}`} key={shadeId}>
                        <div className="shade-item-header">
                          <label className="shade-select">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleShadeSelection(shadeId)}
                              disabled={isSubmitting}
                            />
                            <span className="shade-indicator">
                              <span className="shade-dot" style={{ backgroundColor: getShadeColor(normalizeShadeName(shadeName)) }}></span>
                              <span className="shade-name">
                                {shadeName} {getShadesWithIds(selectedJob['Shade']).filter(s => normalizeShadeName(s.name) === normalizeShadeName(shadeName)).length > 1 && `(Entry ${shadeEntryNum})`}
                              </span>
                            </span>
                          </label>
                          <div className="shade-stats">
                            {wasPreviouslyIssued && (
                              <span className="shade-issued-prev" style={{ color: '#f59e0b', fontWeight: 'bold' }}>
                                📜 Previously Issued: {totalIssuedQty} rolls ({totalIssuedWeight.toFixed(2)} kg)
                              </span>
                            )}
                            {!wasPreviouslyIssued && (
                              <span className="shade-issued-prev" style={{ color: '#10b981' }}>
                                ✨ No previous issuance
                              </span>
                            )}
                          </div>
                        </div>

                        {wasPreviouslyIssued && previouslyIssued.allBarcodes.length > 0 && (
                          <div style={{ marginTop: '8px', padding: '8px', background: '#fef3c7', borderRadius: '6px' }}>
                            <details>
                              <summary style={{ fontSize: '11px', cursor: 'pointer', color: '#92400e' }}>
                                🏷️ Previously Used Barcodes ({previouslyIssued.allBarcodes.length})
                              </summary>
                              <div style={{ marginTop: '5px', fontSize: '10px', maxHeight: '80px', overflowY: 'auto' }}>
                                {previouslyIssued.allBarcodes.map((barcode, idx) => (
                                  <div key={idx} style={{ padding: '2px 0', fontFamily: 'monospace', color: '#78350f' }}>
                                    {barcode}
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}

                        {(currentQty > 0 || currentWeight > 0) && (
                          <div className="shade-current-badge">
                            <span>📌 Current Session: {currentQty} rolls ({currentWeight.toFixed(2)} kg)</span>
                            {scannedCount > 0 && (
                              <div className="scanned-barcodes-list">
                                <details>
                                  <summary style={{ fontSize: '11px', cursor: 'pointer', color: '#666' }}>
                                    🏷️ New Barcodes ({scannedCount})
                                  </summary>
                                  <div style={{ marginTop: '5px', fontSize: '10px', maxHeight: '100px', overflowY: 'auto' }}>
                                    {scannedBarcodes[shadeId]?.map((barcode, idx) => (
                                      <div key={idx} style={{ padding: '2px 0', fontFamily: 'monospace' }}>
                                        {barcode}
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="issuance-action">
                  <button
                    onClick={handleIssueFabric}
                    className="confirm-button"
                    disabled={Object.values(issueQuantity).reduce((a, b) => a + b, 0) === 0 || isSubmitting}
                  >
                    {isSubmitting ? '⏳ Processing...' : '✓ Confirm Issuance'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* History Section with Infinite Scroll */}
          {issueHistory.length > 0 && (
            <div className="history-section">
              <div className="history-header">
                <div className="history-title">
                  <span className="title-icon">📜</span>
                  <h3>Issuance History</h3>
                </div>
                <div className="history-stats">
                  <span className="history-stat">{historyTotalRows || issueHistory.length} total transactions</span>
                  <span className="history-stat">Total: {(parseFloat(getTotalIssuedWeight()) || 0).toFixed(2)} kg</span>
                  {loadingHistory && <span className="history-stat loading">Loading...</span>}
                </div>
              </div>
              <div className="history-list">
                {issueHistory.map((record, index) => (
                  <div className="history-card" key={record.id || record.issuanceId || index}>
                    <div className="history-card-header">
                      <div className="history-date">
                        {new Date(record.issuedAt || record.timestamp).toLocaleString()}
                      </div>
                      <div className="history-badge">
                        {parseInt(record.totalQuantity || record.totalQty) || 0} rolls · {(parseFloat(record.totalWeight) || 0).toFixed(2)} kg
                      </div>
                      {record.issuanceId && (
                        <div className="history-id">
                          ID: {record.issuanceId}
                        </div>
                      )}
                      {record.offline && (
                        <div className="history-offline-badge" style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '12px', fontSize: '10px' }}>
                          📱 Offline
                        </div>
                      )}
                    </div>
                    <div className="history-items">
                      {(record.items || record.issuedItems || []).map((item, i) => (
                        <span key={i} className="history-item-tag">
                          {item.shade}{item.shadeEntry > 1 && ` (Entry ${item.shadeEntry})`}: {parseInt(item.qty || item.quantity) || 0} rolls ({(parseFloat(item.weight) || 0).toFixed(2)} kg)
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Intersection observer target for infinite scroll */}
                <div ref={historyEndRef} style={{ height: '20px', margin: '10px 0' }} />

                {/* Loading more indicator */}
                {loadingHistory && (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                    <span>Loading more history...</span>
                  </div>
                )}

                {/* End of history message */}
                {!hasMoreHistory && issueHistory.length > 0 && (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: '12px' }}>
                    ✓ End of history
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-content">
            <div className="empty-icon">🔍</div>
            <h3>No Lot Selected</h3>
            <p>Enter a valid Lot Number above to view job details and issue fabric</p>
          </div>
        </div>
      )}

      {/* Fabric Receiving Modal */}
      {showReceiving && selectedJob && (
        <FabricReceiving
          selectedJob={selectedJob}
          onClose={() => setShowReceiving(false)}
          onReceiveComplete={handleReceiveComplete}
        />
      )}
    </div>
  );
};

export default FabricIssued;