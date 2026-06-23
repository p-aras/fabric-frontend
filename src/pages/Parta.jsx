import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
  useTransition,
} from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx-js-style";

const fetchWithRetry = async (url, options = {}, maxRetries = 3) => {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return response;
      }

      // Don't retry on client errors (4xx), only on server errors (5xx) and network issues
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

    } catch (error) {
      lastError = error;
    }

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries - 1) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};


const indexToCol = (index) => {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const splitMulti = (val) => {
  if (!val) return [];
  const parts = String(val)
    .split(/[,\/|]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(p);
    }
  }
  return out;
};

const uniq = (arr) => {
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const k = String(v).trim().toLowerCase();
    if (!k) continue;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
};

const generateCollar = (type, item, style, fabric) => {
  const parts = [];
  if (type) parts.push(type);
  if (item) parts.push(item.toUpperCase().replace(/\s+/g, '_').replace(/[^\w_]/g, ''));
  if (style) parts.push(style.toUpperCase().replace(/\s+/g, '_').replace(/[^\w_]/g, ''));
  if (fabric) parts.push(fabric.toUpperCase().replace(/\s+/g, '_').replace(/[^\w_]/g, ''));

  return parts.join('-');
};

const parseDecimal = (val) => {
  if (!val && val !== 0) return 0;
  const str = String(val).replace(/,/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export default function Parta() {
  // ---- Config ----
  const apiKey = "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk";
  const spreadsheetId = "1fKSwGBIpzWEFk566WRQ4bzQ0anJlmasoY8TwrTLQHXI";
  const sheetName = "JobOrder";
  const headerRange = `${sheetName}!A1:W1`;
  const rowRangePrefix = `${sheetName}!A`;

  // SEPARATE URLs FOR GET AND POST
  const GET_APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxTvtHG8PvIO7joStX6htOoyeQ8l0V1ItzZEEWhNFLxbXyU22KEUCD3rE8Q2TtW7verzQ/exec";

  const POST_APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbykzeaPpb40K8p_k11FqOTlVN0LV5s1XIiB1W1bvSwcAMXy2_LJCLwRTXYYP1DVExpw/exec"; // REPLACE WITH YOUR NEW SAVE SCRIPT ID
  // Add this with your other URLs
  const RANGE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzVpZC3YYNr1b-1PRvSYYIhYY8nsW8Aw7OAh8Cgz8zyti2MWOPGRPxN3RxhzanJ1WjLJA/exec";

  const [retryCount, setRetryCount] = useState(0);

  // ---- Server calls ----
  async function saveMatrixExpanded({
    meta,
    sizes,
    shades,
    cutting,
    cells,
    rolls,
    kgs,
    kapdaLayerWT,
    layerPcs,
    layerInch,
    dia,
    cuttingWeight,
    kapdaWapsi,
    proposedWeightPerPcs,
    netWeight,
    actualWeightPerPcs,
    diff,
    grossWeightPerPcs,
    netWeightPerPcs,
    wastagePercentage,
    wastageKgs,
    kharchaEntries,
    remarks,
    standardValue,
    minRange,
    maxRange,
    totalGrossWeightPerPcs,
    totalNetWeightPerPcs,
    totalWithKharcha,
    isNormalSave = false
  }) {
    try {
      const dataToSend = {
        meta,
        sizes,
        shades,
        cutting,
        cells,
        rolls,
        kgs,
        kapdaLayerWT,
        layerPcs,
        layerInch,
        dia,
        cuttingWeight,
        kapdaWapsi,
        proposedWeightPerPcs,
        netWeight,
        actualWeightPerPcs,
        diff,
        grossWeightPerPcs,
        netWeightPerPcs,
        wastagePercentage,
        wastageKgs,
        kharchaEntries,
        remarks,
        standardValue,
        minRange,
        maxRange,
        totalGrossWeightPerPcs,
        totalNetWeightPerPcs,
        totalWithKharcha,
        isNormalSave
      };

      console.log("Saving data for lot:", meta?.lotNumber);

      const isSaveToMySQL = (meta?.kharcha !== "" && parseDecimal(meta?.kharcha) === 0 && meta?.checkedBySahilSir === "yes") || isNormalSave;

      if (isSaveToMySQL) {
        console.log("Saving to MySQL database...");
        const res = await fetch("http://localhost:5001/api/parta/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lotNumber: meta.lotNumber,
            data: dataToSend
          })
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`MySQL save failed: ${errText || res.statusText}`);
        }
        console.log("Save request to MySQL successful");
        return { ok: true };
      }

      // Create form data
      const formData = new URLSearchParams();
      formData.append('payload', JSON.stringify(dataToSend));

      console.log("Sending to URL:", POST_APPS_SCRIPT_URL);

      const res = await fetch(POST_APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors", // Add this to handle CORS
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      // With no-cors mode, we can't read the response
      // So we'll assume it worked if we get here
      console.log("Save request sent successfully");

      // Return a success response
      return { ok: true };

    } catch (error) {
      console.error("Save error details:", error);
      throw error;
    }
  }

  async function loadLatestMatrixBlock(lotNumber) {
    try {
      console.log("Checking MySQL database for lot:", lotNumber);
      const localUrl = `http://localhost:5001/api/parta/load/${encodeURIComponent(lotNumber)}`;
      const localRes = await fetch(localUrl, { method: "GET", keepalive: true });
      if (localRes.ok) {
        const localJson = await localRes.json();
        if (localJson.success && localJson.data) {
          console.log("Loaded lot data from MySQL database:", lotNumber);
          return { ok: true, ...localJson.data };
        }
      }
    } catch (e) {
      console.warn("Failed to check/load from MySQL database, falling back to Google Sheets:", e);
    }

    // USE GET_APPS_SCRIPT_URL FOR FETCHING
    console.log("Loading lot data from Google Sheets:", lotNumber);
    const url = `${GET_APPS_SCRIPT_URL}?lot=${encodeURIComponent(lotNumber)}`;
    const res = await fetch(url, { method: "GET", keepalive: true });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Load failed");
    return json;
  }

  // ---- State ----
  const [lot, setLot] = useState("");
  const [headers, setHeaders] = useState([]);
  const [row, setRow] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [shades, setShades] = useState([]);
  const [cutting, setCutting] = useState({});
  const [cells, setCells] = useState({});
  // Add these to your state section
  const [existingRanges, setExistingRanges] = useState([]);
  const [selectedExistingRange, setSelectedExistingRange] = useState(null);
  const [dbIssuedWeightByShade, setDbIssuedWeightByShade] = useState({});
  const [dbIssuedRollsByShade, setDbIssuedRollsByShade] = useState({});
  const [dbReturnedWeightByShade, setDbReturnedWeightByShade] = useState({});
  const [dbTotalIssuedWeight, setDbTotalIssuedWeight] = useState(0);
  const [dbTotalIssuedRolls, setDbTotalIssuedRolls] = useState(0);
  const [dbTotalReturnedWeight, setDbTotalReturnedWeight] = useState(0);


  const [loadingJobOrders, setLoadingJobOrders] = useState(false);
  const [showRangeDialog, setShowRangeDialog] = useState(false);
  const [dropdownValues, setDropdownValues] = useState({
    items: [],
    styles: [],
    fabrics: [],
    brands: [], // Optional
    garments: [] // Optional
  });
  const [rangeData, setRangeData] = useState({
    type: "M", // M/W/K
    item: "",
    style: "",
    fabric: "",
    minRange: "",
    maxRange: "",
    collar: "" // Auto-collab based on item, style, fabric
  });
  const [savedRanges, setSavedRanges] = useState([]);
  const [savingRange, setSavingRange] = useState(false);

  const normalizeValue = (value) => {
    if (!value) return '';
    // Remove extra spaces, convert to proper case, trim
    return value
      .toString()
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\s*\/\s*/g, '/') // Normalize slashes
      .replace(/\s*,\s*/g, ', ') // Normalize commas
      .split(' ') // Split by spaces
      .map(word => {
        // Capitalize first letter, lowercase the rest
        if (word.length === 0) return '';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  };


  // Update the fetchJobOrderValues function
  const fetchJobOrderValues = async () => {
    try {
      const jobOrderSheetName = "JobOrder";
      const jobOrderRange = `${jobOrderSheetName}!A2:Z1000`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        jobOrderRange
      )}?key=${apiKey}`;

      const response = await fetchWithRetry(url);
      const json = await response.json();

      if (json.values) {
        const items = new Map(); // Use Map to store normalized values
        const styles = new Map();
        const fabrics = new Map();
        const brands = new Map();

        json.values.forEach(row => {
          // Normalize and store values
          if (row[9]) { // Column J: Garment Type (Item)
            const normalized = normalizeValue(row[9]);
            if (normalized) {
              items.set(normalized.toLowerCase(), normalized);
            }
          }

          if (row[17]) { // Column R: Style
            const normalized = normalizeValue(row[17]);
            if (normalized) {
              styles.set(normalized.toLowerCase(), normalized);
            }
          }

          if (row[2]) { // Column C: Fabric
            const normalized = normalizeValue(row[2]);
            if (normalized) {
              fabrics.set(normalized.toLowerCase(), normalized);
            }
          }

          if (row[3]) { // Column D: Brand
            const normalized = normalizeValue(row[3]);
            if (normalized) {
              brands.set(normalized.toLowerCase(), normalized);
            }
          }
        });

        // Convert Map values to arrays and sort
        const getSortedValues = (map) => {
          return Array.from(map.values()).sort((a, b) => {
            // Sort alphabetically, case-insensitive
            return a.localeCompare(b, undefined, { sensitivity: 'base' });
          });
        };

        return {
          items: getSortedValues(items),
          styles: getSortedValues(styles),
          fabrics: getSortedValues(fabrics),
          brands: getSortedValues(brands)
        };
      }
      return { items: [], styles: [], fabrics: [], brands: [] };
    } catch (error) {
      console.error("Error fetching job order values:", error);
      return { items: [], styles: [], fabrics: [], brands: [] };
    }
  };
  // Add this function to fetch existing ranges
  // Update the fetchExistingRanges function
  // Update the fetchExistingRanges function

  const fetchExistingRanges = async (showAll = false) => {
    try {
      console.log(`Fetching ranges (showAll: ${showAll})...`);

      // Build query parameters
      const params = new URLSearchParams();

      if (showAll) {
        // Fetch ALL ranges
        params.append('getAll', '1');
      } else {
        // Fetch filtered ranges based on current selection
        if (rangeData.item) params.append('item', rangeData.item);
        if (rangeData.style) params.append('style', rangeData.style);
        if (rangeData.fabric) params.append('fabric', rangeData.fabric);
        if (rangeData.type) params.append('type', rangeData.type);
        if (rangeData.collar) params.append('collar', rangeData.collar);
      }

      const url = `${RANGE_APPS_SCRIPT_URL}?${params.toString()}`;
      console.log("Fetching ranges from URL:", url);

      const res = await fetch(url, {
        method: "GET",
        keepalive: true
      });

      const json = await res.json();
      console.log("Ranges API response:", json);

      if (json.ok && json.ranges) {
        setExistingRanges(json.ranges);

        // If showing filtered ranges and we have matches, auto-select the latest
        if (!showAll && json.ranges.length > 0) {
          const sortedRanges = [...json.ranges].sort((a, b) => {
            const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
            const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
            return dateB - dateA;
          });

          const latestRange = sortedRanges[0];
          setSelectedExistingRange(latestRange.id);
          setRangeData(prev => ({
            ...prev,
            minRange: latestRange.minRange,
            maxRange: latestRange.maxRange
          }));
        }

        return json.ranges;
      } else {
        setExistingRanges([]);
        return [];
      }
    } catch (error) {
      console.warn("Failed to fetch ranges:", error);
      setExistingRanges([]);
      return [];
    }
  };
  const fetchAllRanges = async () => {
    try {
      console.log("Fetching ALL ranges from sheet...");

      const url = `${RANGE_APPS_SCRIPT_URL}?getAll=1`;
      const res = await fetch(url, { method: "GET", keepalive: true });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const json = await res.json();

      if (json.ok && json.ranges) {
        console.log(`Found ${json.ranges.length} total ranges`);
        return json.ranges;
      }
      return [];
    } catch (error) {
      console.warn("Failed to fetch all ranges:", error);
      return [];
    }
  };
  // Existing state for columns
  const [rolls, setRolls] = useState({});
  const [kgs, setKgs] = useState({});
  const [kapdaLayerWT, setKapdaLayerWT] = useState({});
  const [layerPcs, setLayerPcs] = useState({});
  const [layerInch, setLayerInch] = useState({});
  const [dia, setDia] = useState({});
  const [cuttingWeight, setCuttingWeight] = useState({});
  const [kapdaWapsi, setKapdaWapsi] = useState({});
  // Add to your state section with other states
  const [standardValue, setStandardValue] = useState(0.20); // Default 0.20
  // Add these with your other state variables
  const [showAllRangesMode, setShowAllRangesMode] = useState(false);

  // New state for additional columns
  const [proposedWeightPerPcs, setProposedWeightPerPcs] = useState({});
  const [netWeight, setNetWeight] = useState({});
  const [actualWeightPerPcs, setActualWeightPerPcs] = useState({});
  const [diff, setDiff] = useState({});

  // New state for weight per piece calculations
  const [grossWeightPerPcs, setGrossWeightPerPcs] = useState({});
  const [netWeightPerPcs, setNetWeightPerPcs] = useState({});

  // Kharcha state
  const [kharchaEntries, setKharchaEntries] = useState([]);

  // Combined Remarks state
  const [remarks, setRemarks] = useState("");

  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [minRange, setMinRange] = useState(0);
  const [maxRange, setMaxRange] = useState(0);

  const lotInputRef = useRef(null);
  const navigate = useNavigate();

  const headerCacheRef = useRef(null);
  const activeSearchAbortRef = useRef(null);

  const [, startTransition] = useTransition();

  const [meta, setMeta] = useState({
    fabric: "",
    garmentType: "",
    lotNumber: "",
    style: "",
    brand: "",
    kharcha: "",
    checkedBySahilSir: "no",
  });
  const [isInitiallyLocked, setIsInitiallyLocked] = useState(false);
  const user = useMemo(() => {
    try {
      const u = localStorage.getItem('twms_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }, []);
  const isAdmin = user?.role === 'Admin';

  // ---- Debounced update helpers ----
  const debouncersRef = useRef(new Map());
  const debounce = (key, fn, delay = 120) => {
    const map = debouncersRef.current;
    if (map.has(key)) clearTimeout(map.get(key));
    const t = setTimeout(fn, delay);
    map.set(key, t);
  };

  const clearAll = (focus = true) => {
    setLot("");
    setRow([]);
    setSizes([]);
    setShades([]);
    setCutting({});
    setCells({});
    // Clear all columns
    setRolls({});
    setKgs({});
    setKapdaLayerWT({});
    setLayerPcs({});
    setLayerInch({});
    setDia({});
    setCuttingWeight({});
    setKapdaWapsi({});
    // Clear new columns
    setProposedWeightPerPcs({});
    setNetWeight({});
    setActualWeightPerPcs({});
    setDiff({});
    // Clear weight per piece columns
    setGrossWeightPerPcs({});
    setNetWeightPerPcs({});
    // Clear kharcha entries
    setKharchaEntries([]);
    // Clear combined remarks
    setRemarks("");
    setMeta({ fabric: "", garmentType: "", lotNumber: "", style: "", brand: "", kharcha: "", checkedBySahilSir: "no" });
    setDbIssuedWeightByShade({});
    setDbIssuedRollsByShade({});
    setDbReturnedWeightByShade({});
    setDbTotalIssuedWeight(0);
    setDbTotalIssuedRolls(0);
    setDbTotalReturnedWeight(0);
    setIsInitiallyLocked(false);
    setError(null);
    if (focus) setTimeout(() => lotInputRef.current?.focus(), 0);
  };

  const handleBackSafe = useCallback(() => {
    const canGoBack =
      (window.history && typeof window.history.length === "number" && window.history.length > 1) ||
      (window.history && window.history.state && typeof window.history.state.idx === "number" && window.history.state.idx > 0);

    if (canGoBack) navigate(-1);
    else navigate("/", { replace: true });
  }, [navigate]);

  const handleView = () => navigate("/details");

  // ---- Totals ----
  const num = (v) => {
    const n = parseDecimal(v);
    return Number.isFinite(n) ? n : 0;
  };

  const rowTotal = useCallback(
    (shade) => sizes.reduce((a, s) => a + num(cells[`${shade}|${s}`]), 0),
    [sizes, cells]
  );

  const colTotal = useCallback(
    (size) => shades.reduce((a, sh) => a + num(cells[`${sh}|${size}`]), 0),
    [shades, cells]
  );

  const grandTotal = useCallback(
    () => shades.reduce((a, sh) => a + rowTotal(sh), 0),
    [shades, rowTotal]
  );

  // Calculate total of Kgs(MTR)
  const totalKgsMtr = useMemo(() => {
    return shades.reduce((a, sh) => a + parseDecimal(kgs[sh] || 0), 0);
  }, [shades, kgs]);

  // Calculate total of Net Weight
  const totalNetWeight = useMemo(() => {
    return shades.reduce((a, sh) => {
      const kgsVal = parseDecimal(kgs[sh] || 0);
      const kapdaWapsiVal = parseDecimal(kapdaWapsi[sh] || 0);
      return a + (kgsVal - kapdaWapsiVal);
    }, 0);
  }, [shades, kgs, kapdaWapsi]);

  // Calculate total of Cutting Weight
  const totalCuttingWeight = useMemo(() => {
    return shades.reduce((a, sh) => a + parseDecimal(cuttingWeight[sh] || 0), 0);
  }, [shades, cuttingWeight]);

  // Calculate wastage percentage
  const wastagePercentage = useMemo(() => {
    if (totalNetWeight === 0) return 0;
    const wastage = 1 - (totalCuttingWeight / totalNetWeight);
    return wastage * 100; // Convert to percentage
  }, [totalCuttingWeight, totalNetWeight]);

  // Calculate wastage in kgs
  const wastageKgs = useMemo(() => {
    return totalNetWeight - totalCuttingWeight;
  }, [totalNetWeight, totalCuttingWeight]);

  // Calculate total Gross Weight per Piece (Total Kgs / Total Pcs)
  const totalGrossWeightPerPcs = useMemo(() => {
    const totalPcs = grandTotal();
    if (totalPcs === 0) return 0;
    return totalKgsMtr / totalPcs;
  }, [totalKgsMtr, grandTotal]);

  // Calculate total Net Weight per Piece (Total Net Weight / Total Pcs)
  const totalNetWeightPerPcs = useMemo(() => {
    const totalPcs = grandTotal();
    if (totalPcs === 0) return 0;
    return totalNetWeight / totalPcs;
  }, [totalNetWeight, grandTotal]);

  // Calculate total kharcha kgs and pieces (only included entries)
  // Calculate total kharcha kgs and pieces (only included entries)
  const totalKharchaKgs = useMemo(() => {
    return kharchaEntries
      .filter(entry => entry.includeInTotal) // Only included entries
      .reduce((total, entry) => total + parseDecimal(entry.kgs || 0), 0);
  }, [kharchaEntries]);

  const totalKharchaPcs = useMemo(() => {
    return kharchaEntries
      .filter(entry => entry.includeInTotal) // Only included entries
      .reduce((total, entry) => total + parseDecimal(entry.pcs || 0), 0);
  }, [kharchaEntries]);

  const totalPerPcsSum = useMemo(() => {
    return kharchaEntries
      .filter(entry => entry.includeInTotal) // Only included entries
      .reduce((total, entry) => {
        return total + parseDecimal(entry.perPcs || 0);
      }, 0);
  }, [kharchaEntries]);

  // ADD THIS NEW CALCULATION for the Total card
  const totalWithKharcha = useMemo(() => {
    if (grandTotal() === 0) return 0;

    // Calculate base Net Weight per piece (without kharcha)
    const baseNetWeightPerPc = totalNetWeight / grandTotal();

    // Add Per Pcs sum from kharcha
    const result = baseNetWeightPerPc + totalPerPcsSum;

    // Return rounded to 3 decimals
    return parseFloat(result.toFixed(3));
  }, [totalNetWeight, grandTotal, totalPerPcsSum]);

  // Helper function to calculate Gross Weight Per Pcs (Kgs / Total Pcs)
  const calculateGrossWeightPerPcs = useCallback((shade) => {
    const kgsVal = parseDecimal(kgs[shade] || 0);
    const totalPcs = rowTotal(shade);

    if (totalPcs > 0) {
      return (kgsVal / totalPcs).toFixed(3);
    }
    return "";
  }, [kgs, rowTotal]);

  // Helper function to calculate Net Weight Per Pcs (Net Weight / Total Pcs)
  const calculateNetWeightPerPcs = useCallback((shade) => {
    const netWeightVal = parseDecimal(netWeight[shade] || 0);
    const totalPcs = rowTotal(shade);

    if (totalPcs > 0) {
      return (netWeightVal / totalPcs).toFixed(3);
    }
    return "";
  }, [netWeight, rowTotal]);

  // Helper function to calculate Actual Weight Per Pcs
  const calculateActualWeightPerPcs = useCallback((shade) => {
    const netWeightVal = parseDecimal(netWeight[shade] || 0);
    const totalPcs = rowTotal(shade);

    if (totalPcs > 0) {
      return (netWeightVal / totalPcs).toFixed(3);
    }
    return "";
  }, [netWeight, rowTotal]);

  // Helper function to calculate Diff
  const calculateDiff = useCallback((shade) => {
    const actualWeightVal = parseDecimal(actualWeightPerPcs[shade] || 0);
    const proposedWeightVal = parseDecimal(proposedWeightPerPcs[shade] || 0);

    if (actualWeightVal !== 0 || proposedWeightVal !== 0) {
      return (actualWeightVal - proposedWeightVal).toFixed(3);
    }
    return "";
  }, [actualWeightPerPcs, proposedWeightPerPcs]);

  // Function to update all calculated fields for a shade
  const updateCalculatedFields = useCallback((shade) => {
    // Calculate Gross Weight Per Pcs
    const calculatedGrossWeightPerPcs = calculateGrossWeightPerPcs(shade);
    setGrossWeightPerPcs((prev) => ({
      ...prev,
      [shade]: calculatedGrossWeightPerPcs
    }));


    // Calculate Net Weight Per Pcs
    const calculatedNetWeightPerPcs = calculateNetWeightPerPcs(shade);
    setNetWeightPerPcs((prev) => ({
      ...prev,
      [shade]: calculatedNetWeightPerPcs
    }));

    // Calculate Actual Weight Per Pcs
    const calculatedActualWeightPerPcs = calculateActualWeightPerPcs(shade);
    setActualWeightPerPcs((prev) => ({
      ...prev,
      [shade]: calculatedActualWeightPerPcs
    }));

    // Calculate Diff
    const calculatedDiff = calculateDiff(shade);
    setDiff((prev) => ({
      ...prev,
      [shade]: calculatedDiff
    }));
  }, [calculateGrossWeightPerPcs, calculateNetWeightPerPcs, calculateActualWeightPerPcs, calculateDiff]);

  const applyDbWeight = (shade, weight, rollsVal) => {
    const wVal = parseFloat(weight) || 0;
    const rVal = parseInt(rollsVal) || 0;
    const shadeKey = shade.trim().toLowerCase();
    const retVal = parseFloat(dbReturnedWeightByShade[shadeKey] || 0);

    setKg(shade, String(wVal.toFixed(3)));
    const kgsInput = document.getElementById(`kgs-${shade}`);
    if (kgsInput) kgsInput.value = String(wVal.toFixed(3));

    setRoll(shade, String(rVal));
    const rollsInput = document.getElementById(`rolls-${shade}`);
    if (rollsInput) rollsInput.value = String(rVal);

    // Set Kapda Wapsi as well
    setKapdaWapsi((p) => ({ ...p, [shade]: String(retVal.toFixed(3)) }));
    const wapsiInput = document.getElementById(`wapsi-${shade}`);
    if (wapsiInput) wapsiInput.value = String(retVal.toFixed(3));

    // Update netWeight as well (Kgs - Kapda Wapsi)
    const calculatedNetWeight = (wVal - retVal).toFixed(3);
    setNetWeight((p) => ({ ...p, [shade]: calculatedNetWeight }));

    // Recalculate values
    setTimeout(() => {
      updateCalculatedFields(shade);
    }, 50);
  };

  const autoFillAllDbWeights = () => {
    let count = 0;
    shades.forEach(shade => {
      const shadeLower = shade.trim().toLowerCase();
      const weight = dbIssuedWeightByShade[shadeLower];
      const rollsVal = dbIssuedRollsByShade[shadeLower];
      if (weight !== undefined || rollsVal !== undefined) {
        applyDbWeight(shade, weight || 0, rollsVal || 0);
        count++;
      }
    });
    if (count > 0) {
      setNotice({ type: "success", text: `Successfully auto-filled ${count} shades from SQL database!` });
    } else {
      setNotice({ type: "warning", text: "No matching database issued rolls found for current shades." });
    }
    setTimeout(() => setNotice(null), 3000);
  };

  // Function to auto-fill range dialog with current lot data
  const autoFillRangeDialog = async () => {
    setShowRangeDialog(true);

    // Auto-fill with current lot data
    setRangeData({
      type: "M",
      item: meta.garmentType || "",
      style: meta.style || "",
      fabric: meta.fabric || "",
      minRange: "",
      maxRange: "",
      collar: generateCollar("M", meta.garmentType || "", meta.style || "", meta.fabric || "")
    });

    // Load dropdown values
    if (dropdownValues.items.length === 0) {
      setLoadingJobOrders(true);
      try {
        const values = await fetchJobOrderValues();
        setDropdownValues(values);
      } catch (error) {
        console.error("Failed to load dropdown values:", error);
        setNotice({ type: "error", text: "Failed to load job order data" });
        setTimeout(() => setNotice(null), 3000);
      } finally {
        setLoadingJobOrders(false);
      }
    }

    // Fetch ALL ranges immediately when dialog opens
    setTimeout(async () => {
      const allRanges = await fetchAllRanges();
      if (allRanges.length > 0) {
        setExistingRanges(allRanges);
        setNotice({
          type: "success",
          text: `Loaded ${allRanges.length} ranges from sheet`
        });
        setTimeout(() => setNotice(null), 2000);
      }
    }, 300);
  };
  // Search function (with header caching + abort control)
  const search = useCallback(async (isRetry = false) => {
    setNotice(null);
    setError(null);
    setRow([]);
    setSizes([]);
    setShades([]);
    setCutting({});
    setCells({});
    // Clear all columns on new search
    setRolls({});
    setKgs({});
    setKapdaLayerWT({});
    setLayerPcs({});
    setLayerInch({});
    setDia({});
    setCuttingWeight({});
    setKapdaWapsi({});
    // Clear new columns
    setProposedWeightPerPcs({});
    setNetWeight({});
    setActualWeightPerPcs({});
    setDiff({});
    // Clear weight per piece columns
    setGrossWeightPerPcs({});
    setNetWeightPerPcs({});
    // Clear kharcha entries
    setKharchaEntries([]);
    // Clear combined remarks
    setRemarks("");
    setMeta({ fabric: "", garmentType: "", lotNumber: "", style: "", brand: "" });
    setIsInitiallyLocked(false);

    if (activeSearchAbortRef.current) activeSearchAbortRef.current.abort();
    const abortController = new AbortController();
    activeSearchAbortRef.current = abortController;

    setLoading(true);
    try {
      const lotQuery = lot.trim();
      if (!lotQuery) {
        setLoading(false);
        setError("Enter a Lot Number to search.");
        return;
      }

      // Cache key for fallback
      const cacheKey = `sheets-cache-${spreadsheetId}-${sheetName}-${lotQuery}`;

      // 1) Headers (cache with retry)
      let headerVals = headerCacheRef.current;
      if (!headerVals) {
        const headerURL = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
          headerRange
        )}?key=${apiKey}`;

        const headRes = await fetchWithRetry(headerURL, {
          signal: abortController.signal
        }, 3);

        if (!headRes.ok) throw new Error(`Header HTTP ${headRes.status}`);
        const headJson = await headRes.json();
        headerVals = headJson?.values?.[0] || [];
        if (!headerVals.length) throw new Error("Header row is empty.");
        headerCacheRef.current = headerVals;
        setHeaders(headerVals);
      } else if (headers.length === 0) {
        setHeaders(headerVals);
      }

      const norm = (x) => String(x || "").trim().toLowerCase();
      const findCol = (names) => headerVals.findIndex((h) => names.includes(norm(h)));

      const lotColIndex = findCol(["lot number", "lot no", "lot no.", "lot"]);
      const sizeColIndex = findCol(["sizes", "size"]);
      const shadeColIndex = findCol(["shade", "shades", "color", "colour"]);
      const fabricColIndex = findCol(["fabric type", "fabric", "fabric_name"]);
      const garmentColIndex = findCol(["item", "garment type", "garment", "product"]);
      const styleColIndex = findCol(["style", "style no", "style no."]);
      const brandColIndex = findCol(["brand", "buyer", "customer", "client"]);

      if (lotColIndex === -1) throw new Error('Couldn\'t find "Lot Number" column.');
      if (sizeColIndex === -1) throw new Error('Couldn\'t find "Size" column.');
      if (shadeColIndex === -1) throw new Error('Couldn\'t find "Shade" column.');

      // 2) Find row by lot with retry
      const lotColLetter = indexToCol(lotColIndex);
      const colRange = `${sheetName}!${lotColLetter}2:${lotColLetter}`;
      const colURL = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        colRange
      )}?valueRenderOption=UNFORMATTED_VALUE&key=${apiKey}`;

      const colRes = await fetchWithRetry(colURL, {
        signal: abortController.signal
      }, 2);

      if (!colRes.ok) throw new Error(`Column HTTP ${colRes.status}`);
      const colJson = await colRes.json();
      const colValues = (colJson?.values || []).map((a) => a?.[0] ?? "");

      let matchedRowNumber = null;
      const isNum = !Number.isNaN(Number(lotQuery));
      for (let i = 0; i < colValues.length; i++) {
        const v = colValues[i];
        const rn = i + 2;
        const sMatch = String(v).trim().toLowerCase() === lotQuery.toLowerCase();
        const nMatch = isNum && Number(v) === Number(lotQuery);
        if (sMatch || nMatch) {
          matchedRowNumber = rn;
          break;
        }
      }
      if (!matchedRowNumber) throw new Error("No matching row found for that Lot Number.");

      // 3) Fetch matched row with retry
      const rowRange = `${rowRangePrefix}${matchedRowNumber}:W${matchedRowNumber}`;
      const rowURL = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        rowRange
      )}?valueRenderOption=UNFORMATTED_VALUE&key=${apiKey}`;

      const rowRes = await fetchWithRetry(rowURL, {
        signal: abortController.signal
      }, 2);

      if (!rowRes.ok) throw new Error(`Row HTTP ${rowRes.status}`);
      const rowJson = await rowRes.json();
      const theRow = rowJson?.values?.[0] || [];
      setRow(theRow);

      // 4) Parse axes from sheet row
      const parsedSizes = splitMulti(theRow[sizeColIndex] ?? "");
      const parsedShades = splitMulti(theRow[shadeColIndex] ?? "");

      // 5) Meta
      const fabricVal = fabricColIndex !== -1 ? theRow[fabricColIndex] ?? "" : "";
      const garmentVal = garmentColIndex !== -1 ? theRow[garmentColIndex] ?? "" : "";
      const styleVal = styleColIndex !== -1 ? theRow[styleColIndex] ?? "" : "";
      const brandVal = brandColIndex !== -1 ? theRow[brandColIndex] ?? "" : "";
      const lotVal = theRow[lotColIndex] ?? lotQuery;
      const baseMeta = {
        fabric: String(fabricVal || ""),
        garmentType: String(garmentVal || ""),
        lotNumber: String(lotVal || ""),
        style: String(styleVal || ""),
        brand: String(brandVal || ""),
        kharcha: "",
        checkedBySahilSir: "no",
      };
      setMeta(baseMeta);

      // Fetch issued rolls from Node/MySQL backend
      let fetchedIssuedWeightByShade = {};
      let fetchedIssuedRollsByShade = {};
      let fetchedReturnedWeightByShade = {};
      let totalIssuedWeight = 0;
      let totalIssuedRolls = 0;
      let totalReturnedWeightVal = 0;

      try {
        const issuedRollsURL = `http://localhost:5001/api/fabric-receiving/issued-rolls/${encodeURIComponent(lotVal)}`;
        const issuedRes = await fetch(issuedRollsURL);
        if (issuedRes.ok) {
          const issuedJson = await issuedRes.json();
          if (issuedJson.success && Array.isArray(issuedJson.data)) {
            const rollsData = issuedJson.data;
            rollsData.forEach(roll => {
              const shadeKey = String(roll.shade || "").trim().toLowerCase();
              const w = parseFloat(roll.originalIssuedWeight !== undefined ? roll.originalIssuedWeight : roll.weight || 0);
              const retW = parseFloat(roll.totalReturnedWeight || 0);

              fetchedIssuedWeightByShade[shadeKey] = (fetchedIssuedWeightByShade[shadeKey] || 0) + w;
              fetchedIssuedRollsByShade[shadeKey] = (fetchedIssuedRollsByShade[shadeKey] || 0) + 1;
              fetchedReturnedWeightByShade[shadeKey] = (fetchedReturnedWeightByShade[shadeKey] || 0) + retW;

              totalIssuedWeight += w;
              totalIssuedRolls += 1;
              totalReturnedWeightVal += retW;
            });
            console.log("Fetched issued rolls from DB:", rollsData);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch issued rolls from backend API:", err);
      }

      setDbIssuedWeightByShade(fetchedIssuedWeightByShade);
      setDbIssuedRollsByShade(fetchedIssuedRollsByShade);
      setDbReturnedWeightByShade(fetchedReturnedWeightByShade);
      setDbTotalIssuedWeight(totalIssuedWeight);
      setDbTotalIssuedRolls(totalIssuedRolls);
      setDbTotalReturnedWeight(totalReturnedWeightVal);

      // 6) Try to hydrate last saved and UNION axes (sheet ⊔ saved) so manual shades persist
      let finalShades = parsedShades.slice();
      let finalSizes = parsedSizes.slice();
      let prefillCutting = {};
      let prefillCells = {};
      let prefillRolls = {};
      let prefillKgs = {};
      let prefillKapdaLayerWT = {};
      let prefillLayerPcs = {};
      let prefillLayerInch = {};
      let prefillDia = {};
      let prefillCuttingWeight = {};
      let prefillKapdaWapsi = {};
      let prefillProposedWeightPerPcs = {};
      let prefillNetWeight = {};
      let prefillActualWeightPerPcs = {};
      let prefillDiff = {};
      let prefillGrossWeightPerPcs = {};
      let prefillNetWeightPerPcs = {};

      let loadRes = null;
      try {
        loadRes = await loadLatestMatrixBlock(String(lotVal));
      } catch (e) {
        console.warn("Previous matrix load failed:", e);
      }

      if (isAdmin && (!loadRes || !loadRes.ok || loadRes.meta?.checkedBySahilSir !== "yes")) {
        throw new Error("No matching row found for that Lot Number.");
      }

      try {
        if (loadRes && loadRes.ok) {
          // Prefer explicit arrays if script returns them; otherwise derive from keys
          const savedShades =
            (Array.isArray(loadRes.shades) && loadRes.shades) ||
            (loadRes.cutting ? Object.keys(loadRes.cutting) : []) ||
            [];
          const savedSizes =
            (Array.isArray(loadRes.sizes) && loadRes.sizes) ||
            (loadRes.cells
              ? uniq(
                Object.keys(loadRes.cells).map((k) => String(k).split("|")[1] ?? "").filter(Boolean)
              )
              : []) ||
            [];

          finalShades = uniq([...parsedShades, ...savedShades]);
          finalSizes = uniq([...parsedSizes, ...savedSizes]);

          // Fill from saved where possible
          if (loadRes.cutting) prefillCutting = { ...loadRes.cutting };
          if (loadRes.cells) prefillCells = { ...loadRes.cells };
          if (loadRes.rolls) prefillRolls = { ...loadRes.rolls };
          if (loadRes.kgs) prefillKgs = { ...loadRes.kgs };
          if (loadRes.kapdaLayerWT) prefillKapdaLayerWT = { ...loadRes.kapdaLayerWT };
          if (loadRes.layerPcs) prefillLayerPcs = { ...loadRes.layerPcs };
          if (loadRes.layerInch) prefillLayerInch = { ...loadRes.layerInch };
          if (loadRes.dia) prefillDia = { ...loadRes.dia };
          if (loadRes.cuttingWeight) prefillCuttingWeight = { ...loadRes.cuttingWeight };
          if (loadRes.kapdaWapsi) prefillKapdaWapsi = { ...loadRes.kapdaWapsi };

          if (loadRes.proposedWeightPerPcs) prefillProposedWeightPerPcs = { ...loadRes.proposedWeightPerPcs };
          if (loadRes.netWeight) prefillNetWeight = { ...loadRes.netWeight };
          if (loadRes.actualWeightPerPcs) prefillActualWeightPerPcs = { ...loadRes.actualWeightPerPcs };
          if (loadRes.diff) prefillDiff = { ...loadRes.diff };
          if (loadRes.grossWeightPerPcs) prefillGrossWeightPerPcs = { ...loadRes.grossWeightPerPcs };
          if (loadRes.netWeightPerPcs) prefillNetWeightPerPcs = { ...loadRes.netWeightPerPcs };

          // Load kharcha entries if they exist
          if (loadRes.kharchaEntries) setKharchaEntries(loadRes.kharchaEntries);

          // Load combined remarks if they exist
          if (loadRes.remarks) setRemarks(loadRes.remarks);

          // enrich meta from saved if missing
          setMeta((prev) => ({
            fabric: prev.fabric || loadRes.meta?.fabric || "",
            garmentType: prev.garmentType || loadRes.meta?.garmentType || "",
            lotNumber: prev.lotNumber || loadRes.meta?.lotNumber || String(lotVal) || "",
            style: prev.style || loadRes.meta?.style || "",
            brand: prev.brand || loadRes.meta?.brand || "",
            kharcha: prev.kharcha !== undefined && prev.kharcha !== "" ? prev.kharcha : (loadRes.meta?.kharcha || ""),
            checkedBySahilSir: prev.checkedBySahilSir !== undefined && prev.checkedBySahilSir !== "no" ? prev.checkedBySahilSir : (loadRes.meta?.checkedBySahilSir || "no"),
          }));

          if (loadRes.meta?.checkedBySahilSir === "yes") {
            setIsInitiallyLocked(true);
          }
        }
      } catch (e) {
        console.warn("Processing saved matrix failed:", e);
      }

      // 7) Initialize state using FINAL axes (union), prefilling with saved values where available
      const initCut = {};
      const initCells = {};
      const initRolls = {};
      const initKgs = {};
      const initKapdaLayerWT = {};
      const initLayerPcs = {};
      const initLayerInch = {};
      const initDia = {};
      const initCuttingWeight = {};
      const initKapdaWapsi = {};
      // New columns initialization
      const initProposedWeightPerPcs = {};
      const initNetWeight = {};
      const initActualWeightPerPcs = {};
      const initDiff = {};
      const initGrossWeightPerPcs = {};
      const initNetWeightPerPcs = {};

      for (const sh of finalShades) {
        const shadeLower = sh.trim().toLowerCase();
        const dbWeight = fetchedIssuedWeightByShade[shadeLower];
        const dbRolls = fetchedIssuedRollsByShade[shadeLower];
        const dbReturned = fetchedReturnedWeightByShade[shadeLower];

        initCut[sh] = String(prefillCutting[sh] ?? "");
        initRolls[sh] = String(
          prefillRolls[sh] !== undefined && prefillRolls[sh] !== "" && prefillRolls[sh] !== "0"
            ? prefillRolls[sh]
            : (dbRolls !== undefined ? dbRolls : "")
        );
        initKgs[sh] = String(
          prefillKgs[sh] !== undefined && prefillKgs[sh] !== "" && prefillKgs[sh] !== "0" && parseFloat(prefillKgs[sh]) > 0
            ? prefillKgs[sh]
            : (dbWeight !== undefined ? dbWeight.toFixed(3) : "")
        );
        initKapdaLayerWT[sh] = String(prefillKapdaLayerWT[sh] ?? "");
        initLayerPcs[sh] = String(prefillLayerPcs[sh] ?? "");
        initLayerInch[sh] = String(prefillLayerInch[sh] ?? "");
        initDia[sh] = String(prefillDia[sh] ?? "");
        initCuttingWeight[sh] = String(prefillCuttingWeight[sh] ?? "");
        initKapdaWapsi[sh] = String(
          prefillKapdaWapsi[sh] !== undefined && prefillKapdaWapsi[sh] !== "" && prefillKapdaWapsi[sh] !== "0"
            ? prefillKapdaWapsi[sh]
            : (dbReturned !== undefined && dbReturned > 0 ? dbReturned.toFixed(3) : "")
        );

        // Calculate proposed weight per pcs on initialization
        const layerWT = parseDecimal(initKapdaLayerWT[sh] || 0);
        const layerPcsVal = parseDecimal(initLayerPcs[sh] || 0);
        const calculatedProposedWeight = layerPcsVal > 0 ? (layerWT / layerPcsVal).toFixed(3) : "";

        // Calculate net weight on initialization (Kgs - Kapda Wapsi)
        const kgsVal = parseDecimal(initKgs[sh] || 0);
        const kapdaWapsiVal = parseDecimal(initKapdaWapsi[sh] || 0);
        const calculatedNetWeight = (kgsVal - kapdaWapsiVal).toFixed(3);

        // Calculate gross weight per pcs on initialization (Kgs / Total Pcs)
        const totalPcs = sizes.reduce((a, sz) => a + num(prefillCells[`${sh}|${sz}`] ?? ""), 0);
        const calculatedGrossWeightPerPcs = totalPcs > 0 ? (kgsVal / totalPcs).toFixed(3) : "";

        // Calculate net weight per pcs on initialization (Net Weight / Total Pcs)
        const calculatedNetWeightPerPcs = totalPcs > 0 ? (parseDecimal(calculatedNetWeight) / totalPcs).toFixed(3) : "";

        // Calculate actual weight per pcs (Net Weight / Total Pcs) - same as net weight per pcs
        const calculatedActualWeightPerPcs = calculatedNetWeightPerPcs;

        // Calculate diff (Actual Weight Per Pcs - Proposed Weight Per Pcs)
        const calculatedDiff = calculatedActualWeightPerPcs && calculatedProposedWeight
          ? (parseDecimal(calculatedActualWeightPerPcs) - parseDecimal(calculatedProposedWeight)).toFixed(3)
          : "";

        initProposedWeightPerPcs[sh] = calculatedProposedWeight || String(prefillProposedWeightPerPcs[sh] ?? "");
        initNetWeight[sh] = calculatedNetWeight || String(prefillNetWeight[sh] ?? "");
        initGrossWeightPerPcs[sh] = calculatedGrossWeightPerPcs || String(prefillGrossWeightPerPcs[sh] ?? "");
        initNetWeightPerPcs[sh] = calculatedNetWeightPerPcs || String(prefillNetWeightPerPcs[sh] ?? "");
        initActualWeightPerPcs[sh] = calculatedActualWeightPerPcs || String(prefillActualWeightPerPcs[sh] ?? "");
        initDiff[sh] = calculatedDiff || String(prefillDiff[sh] ?? "");
      }

      for (const sh of finalShades)
        for (const sz of finalSizes) {
          const k = `${sh}|${sz}`;
          initCells[k] = String(prefillCells[k] ?? "");
        }

      startTransition(() => {
        setSizes(finalSizes);
        setShades(finalShades);
        setCutting(initCut);
        setCells(initCells);
        setRolls(initRolls);
        setKgs(initKgs);
        setKapdaLayerWT(initKapdaLayerWT);
        setLayerPcs(initLayerPcs);
        setLayerInch(initLayerInch);
        setDia(initDia);
        setCuttingWeight(initCuttingWeight);
        setKapdaWapsi(initKapdaWapsi);
        // New columns
        setProposedWeightPerPcs(initProposedWeightPerPcs);
        setNetWeight(initNetWeight);
        setActualWeightPerPcs(initActualWeightPerPcs);
        setDiff(initDiff);
        // Weight per piece columns
        setGrossWeightPerPcs(initGrossWeightPerPcs);
        setNetWeightPerPcs(initNetWeightPerPcs);
      });

      // Cache successful response
      try {
        const cacheData = {
          headers: headerVals,
          row: theRow,
          sizes: finalSizes,
          shades: finalShades,
          meta: baseMeta,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (e) {
        console.warn('Failed to cache data:', e);
      }

    } catch (e) {
      if (e?.name === "AbortError") {
        return;
      }

      // Try to use cached data as fallback for server errors
      const cacheKey = `sheets-cache-${spreadsheetId}-${sheetName}-${lot.trim()}`;
      if ((e.message?.includes('HTTP 500') || e.message?.includes('Failed to fetch')) && !isRetry) {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const cacheData = JSON.parse(cached);
            // Use cache if it's less than 10 minutes old
            if (Date.now() - cacheData.timestamp < 10 * 60 * 1000) {
              setHeaders(cacheData.headers);
              setRow(cacheData.row);
              setSizes(cacheData.sizes);
              setShades(cacheData.shades);
              setMeta(cacheData.meta);
              if (cacheData.meta?.checkedBySahilSir === "yes") {
                setIsInitiallyLocked(true);
              }
              setError("Using cached data (temporary server issue)");
              setLoading(false);
              return;
            }
          }
        } catch (cacheError) {
          console.warn('Cache read failed:', cacheError);
        }

        // Auto-retry once after 2 seconds
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          search(true);
        }, 2000);
        setError("Temporary server issue, retrying...");
        return;
      }

      // User-friendly error messages
      if (e.message?.includes('HTTP 500')) {
        setError("Google Sheets is temporarily unavailable. Please try again in a moment.");
      } else if (e.message?.includes('HTTP 403')) {
        setError("Access denied. Please check if the spreadsheet is shared properly.");
      } else if (e.message?.includes('HTTP 404')) {
        setError("Spreadsheet not found. Please check the spreadsheet ID.");
      } else if (e.message?.includes('Failed to fetch')) {
        setError("Network connection issue. Please check your internet connection.");
      } else {
        setError(e?.message || "Something went wrong while searching.");
      }

      console.error("Search error:", e);
    } finally {
      if (!abortController.signal.aborted) setLoading(false);
    }
  }, [apiKey, headerRange, rowRangePrefix, sheetName, spreadsheetId, lot, headers.length, num, isAdmin]);
  // Handle save range
  // Add function to load saved ranges from Google Sheets
  const loadSavedRanges = async () => {
    try {
      const params = new URLSearchParams();
      if (meta.garmentType) params.append('item', meta.garmentType);
      if (meta.style) params.append('style', meta.style);
      if (meta.fabric) params.append('fabric', meta.fabric);

      const url = `${RANGE_APPS_SCRIPT_URL}?${params.toString()}`;
      const res = await fetch(url, { method: "GET", keepalive: true });
      const json = await res.json();

      if (json.ok && json.ranges) {
        setSavedRanges(json.ranges);

        // Auto-load the most recent matching range
        if (json.ranges.length > 0) {
          const latestRange = json.ranges.reduce((latest, current) => {
            const currentTime = new Date(current.timestamp).getTime();
            const latestTime = new Date(latest.timestamp).getTime();
            return currentTime > latestTime ? current : latest;
          });

          setMinRange(latestRange.minRange);
          setMaxRange(latestRange.maxRange);
        }
      }
    } catch (error) {
      console.warn("Failed to load saved ranges:", error);
      setSavedRanges([]);
    }
  };
  // REPLACE THIS ENTIRE FUNCTION
  // UPDATED handleSaveRange function with update support
  // REPLACE THE ENTIRE handleSaveRange FUNCTION WITH THIS VERSION
  const handleSaveRange = async (e) => {
    e.preventDefault();

    // Validate
    if (!rangeData.type || !rangeData.item || !rangeData.style || !rangeData.fabric || !rangeData.minRange || !rangeData.maxRange) {
      setNotice({ type: "error", text: "Please fill all required fields (Type, Item, Style, Fabric, Min Range, Max Range)" });
      setTimeout(() => setNotice(null), 3000);
      return;
    }

    const min = parseFloat(rangeData.minRange);
    const max = parseFloat(rangeData.maxRange);

    if (isNaN(min) || isNaN(max)) {
      setNotice({ type: "error", text: "Please enter valid numbers for min and max range" });
      setTimeout(() => setNotice(null), 3000);
      return;
    }

    if (min >= max) {
      setNotice({ type: "error", text: "Minimum range must be less than maximum range" });
      setTimeout(() => setNotice(null), 3000);
      return;
    }

    try {
      setSavingRange(true);

      // Generate collar if not already set
      const collar = rangeData.collar || generateCollar(
        rangeData.type,
        rangeData.item,
        rangeData.style,
        rangeData.fabric
      );

      // Prepare range object for saving
      const rangeToSave = {
        type: rangeData.type,
        item: rangeData.item,
        style: rangeData.style,
        fabric: rangeData.fabric,
        collar: collar,
        minRange: min,
        maxRange: max
      };

      // Determine if we're updating an existing range
      // Check if there's a selected existing range AND if it matches the current form data
      if (selectedExistingRange) {
        // We're updating - find the existing range
        const existingRange = existingRanges.find(range => range.id === selectedExistingRange);

        if (existingRange) {
          // Use the existing ID for update
          rangeToSave.id = selectedExistingRange;
          rangeToSave.action = "update";
          rangeToSave.originalId = selectedExistingRange;
        } else {
          // If no matching range found, create new
          rangeToSave.id = Date.now().toString();
          rangeToSave.action = "create";
        }
      } else {
        // No selection - create new range
        rangeToSave.id = Date.now().toString();
        rangeToSave.action = "create";
      }

      // Save to Google Sheets
      const payload = JSON.stringify({
        meta: {
          lotNumber: meta.lotNumber,
          fabric: meta.fabric,
          garmentType: meta.garmentType,
          style: meta.style
        },
        ranges: [rangeToSave]
      });

      console.log("Saving range:", rangeToSave);

      const res = await fetch(RANGE_APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        keepalive: true,
        body: new URLSearchParams({ payload }),
      });

      const json = await res.json();
      console.log("Save response:", json);

      if (!json.ok) throw new Error(json.error || "Save failed");

      // Update local state
      if (rangeToSave.action === "update") {
        // Update the existing range in the list
        setExistingRanges(prev => prev.map(range =>
          range.id === selectedExistingRange
            ? { ...range, ...rangeToSave, timestamp: new Date().toISOString() }
            : range
        ));

        setNotice({ type: "success", text: `✓ Range updated: ${rangeToSave.collar} (${min.toFixed(3)} - ${max.toFixed(3)})` });
      } else {
        // Add new range to the list
        const newRange = {
          ...rangeToSave,
          id: rangeToSave.id,
          timestamp: new Date().toISOString()
        };

        setExistingRanges(prev => [...prev, newRange]);
        setNotice({ type: "success", text: `✓ New range saved: ${rangeToSave.collar} (${min.toFixed(3)} - ${max.toFixed(3)})` });
      }

      // Set the min/max range in the summary cards
      setMinRange(min);
      setMaxRange(max);

      setTimeout(() => setNotice(null), 3000);

      // Don't clear selection after update - allows further edits
      // setSelectedExistingRange(null);

    } catch (error) {
      console.error("Failed to save range:", error);
      setNotice({ type: "error", text: `Failed to save range: ${error.message}` });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingRange(false);
    }
  };

  // Handle close range dialog
  const handleCloseRangeDialog = () => {
    setShowRangeDialog(false);
    setRangeData({
      type: "M",
      item: "",
      style: "",
      fabric: "",
      minRange: "",
      maxRange: "",
      collar: ""
    });
  };

  // ---- Updaters (debounced) ----
  const setCut = (shade, val) => {
    debounce(`cut-${shade}`, () => {
      setCutting((p) => (p[shade] === val ? p : { ...p, [shade]: val }));
    });
  };

  const setCell = (shade, size, val) => {
    const key = `${shade}|${size}`;
    debounce(`cell-${key}`, () => {
      setCells((p) => {
        const updated = { ...p, [key]: val };

        // After updating cell, recalculate all weight fields
        setTimeout(() => {
          updateCalculatedFields(shade);
        }, 10);

        return updated;
      });
    });
  };

  // Existing column updaters
  const setRoll = (shade, val) => {
    debounce(`roll-${shade}`, () => {
      setRolls((p) => (p[shade] === val ? p : { ...p, [shade]: val }));
    });
  };

  const setKg = (shade, val) => {
    debounce(`kg-${shade}`, () => {
      setKgs((p) => ({ ...p, [shade]: val }));
      // When Kgs changes, recalculate net weight (Kgs - Kapda Wapsi) and all weight per piece fields
      const kgsVal = parseDecimal(val || 0);
      const kapdaWapsiVal = parseDecimal(kapdaWapsi[shade] || 0);
      const calculatedNetWeight = (kgsVal - kapdaWapsiVal).toFixed(3);
      setNetWeight((p) => ({ ...p, [shade]: calculatedNetWeight }));

      // Update all calculated fields
      setTimeout(() => {
        updateCalculatedFields(shade);
      }, 10);
    });
  };

  const setKapdaLayerWTVal = (shade, val) => {
    debounce(`kapda-layer-wt-${shade}`, () => {
      setKapdaLayerWT((p) => ({ ...p, [shade]: val }));
      // When Kapda Layer WT changes, recalculate proposed weight per pcs
      const layerWT = parseDecimal(val || 0);
      const layerPcsVal = parseDecimal(layerPcs[shade] || 0);
      if (layerPcsVal > 0) {
        const calculatedWeight = (layerWT / layerPcsVal).toFixed(3);
        setProposedWeightPerPcs((p) => ({ ...p, [shade]: calculatedWeight }));

        // Also update Diff since Proposed Weight changed
        setTimeout(() => {
          const calculatedDiff = calculateDiff(shade);
          setDiff((p) => ({ ...p, [shade]: calculatedDiff }));
        }, 10);
      } else {
        setProposedWeightPerPcs((p) => ({ ...p, [shade]: "" }));
      }
    });
  };

  const setLayerPc = (shade, val) => {
    debounce(`layer-pcs-${shade}`, () => {
      setLayerPcs((p) => ({ ...p, [shade]: val }));
      // When Layer Pcs changes, recalculate proposed weight per pcs
      const layerWT = parseDecimal(kapdaLayerWT[shade] || 0);
      const layerPcsVal = parseDecimal(val || 0);
      if (layerPcsVal > 0) {
        const calculatedWeight = (layerWT / layerPcsVal).toFixed(3);
        setProposedWeightPerPcs((p) => ({ ...p, [shade]: calculatedWeight }));

        // Also update Diff since Proposed Weight changed
        setTimeout(() => {
          const calculatedDiff = calculateDiff(shade);
          setDiff((p) => ({ ...p, [shade]: calculatedDiff }));
        }, 10);
      } else {
        setProposedWeightPerPcs((p) => ({ ...p, [shade]: "" }));
      }
    });
  };

  const setLayerInchVal = (shade, val) => {
    debounce(`layer-inch-${shade}`, () => {
      setLayerInch((p) => (p[shade] === val ? p : { ...p, [shade]: val }));
    });
  };

  const setDiaVal = (shade, val) => {
    debounce(`dia-${shade}`, () => {
      setDia((p) => (p[shade] === val ? p : { ...p, [shade]: val }));
    });
  };

  const setCuttingWeightVal = (shade, val) => {
    debounce(`cutting-weight-${shade}`, () => {
      setCuttingWeight((p) => ({ ...p, [shade]: val }));
    });
  };

  const setKapdaWapsiVal = (shade, val) => {
    debounce(`kapda-wapsi-${shade}`, () => {
      setKapdaWapsi((p) => ({ ...p, [shade]: val }));
      // When Kapda Wapsi changes, recalculate net weight (Kgs - Kapda Wapsi)
      const kgsVal = parseDecimal(kgs[shade] || 0);
      const kapdaWapsiVal = parseDecimal(val || 0);
      const calculatedNetWeight = (kgsVal - kapdaWapsiVal).toFixed(3);
      setNetWeight((p) => ({ ...p, [shade]: calculatedNetWeight }));

      // Update all weight per piece calculations
      setTimeout(() => {
        updateCalculatedFields(shade);
      }, 10);
    });
  };

  // New column updaters
  const setProposedWeightPerPcsVal = (shade, val) => {
    debounce(`proposed-weight-${shade}`, () => {
      setProposedWeightPerPcs((p) => ({ ...p, [shade]: val }));

      // Update Diff when Proposed Weight changes
      setTimeout(() => {
        const calculatedDiff = calculateDiff(shade);
        setDiff((p) => ({ ...p, [shade]: calculatedDiff }));
      }, 10);
    });
  };

  const setNetWeightVal = (shade, val) => {
    debounce(`net-weight-${shade}`, () => {
      setNetWeight((p) => ({ ...p, [shade]: val }));

      // Update all weight per piece calculations when Net Weight changes
      setTimeout(() => {
        updateCalculatedFields(shade);
      }, 10);
    });
  };

  const setActualWeightPerPcsVal = (shade, val) => {
    debounce(`actual-weight-${shade}`, () => {
      setActualWeightPerPcs((p) => ({ ...p, [shade]: val }));

      // Update Diff when Actual Weight Per Pcs changes
      setTimeout(() => {
        const calculatedDiff = calculateDiff(shade);
        setDiff((p) => ({ ...p, [shade]: calculatedDiff }));
      }, 10);
    });
  };

  const setDiffVal = (shade, val) => {
    debounce(`diff-${shade}`, () => {
      setDiff((p) => ({ ...p, [shade]: val }));
    });
  };

  // Combined remarks updater with debouncing
  const handleRemarksChange = (e) => {
    const value = e.target.value;
    setRemarks(value);

    // Debounce the save
    debounce(`remarks`, () => {
      // Just update state, actual save happens on save button click
    }, 500);
  };

  const handleKharchaBlurOrEnter = (e) => {
    if (e.type === "keydown" && e.key !== "Enter") return;
    const kharchaNum = parseDecimal(meta.kharcha);
    const isKharchaZero = meta.kharcha !== "" && kharchaNum === 0;
    const isSahilYes = meta.checkedBySahilSir === "yes";
    if (isKharchaZero && isSahilYes) {
      handleSave();
    }
  };

  // Kharcha toggle function
  const toggleKharchaInclusion = (id) => {
    setKharchaEntries((prev) =>
      prev.map(entry =>
        entry.id === id
          ? { ...entry, includeInTotal: !entry.includeInTotal }
          : entry
      )
    );
  };

  // Update minTableWidth calculation (no change needed)
  const minTableWidth = useMemo(() => Math.max(1600, (sizes.length + 18) * 100), [sizes.length]);

  // ---- Save Matrix (refresh page on success) ----
  const handleSave = async (overrideMetaOrOptions) => {
    let activeMeta = meta;
    let isNormalSave = false;

    if (overrideMetaOrOptions && typeof overrideMetaOrOptions === "object") {
      if ("isNormalSave" in overrideMetaOrOptions) {
        isNormalSave = !!overrideMetaOrOptions.isNormalSave;
      } else {
        activeMeta = overrideMetaOrOptions;
      }
    }

    try {
      if (!activeMeta.lotNumber) {
        setNotice({ type: "error", text: "Search a lot first." });
        return;
      }
      if (!sizes.length || !shades.length) {
        setNotice({ type: "error", text: "Nothing to save." });
        return;
      }
      setNotice(null);
      setSaving(true);
      await saveMatrixExpanded({
        meta: activeMeta,
        sizes,
        shades,
        cutting,
        cells,
        rolls,
        kgs,
        kapdaLayerWT,
        layerPcs,
        layerInch,
        dia,
        cuttingWeight,
        kapdaWapsi,
        proposedWeightPerPcs,
        netWeight,
        actualWeightPerPcs,
        diff,
        grossWeightPerPcs,
        netWeightPerPcs,
        wastagePercentage,
        wastageKgs,
        kharchaEntries,
        remarks, // Include combined remarks
        standardValue,
        minRange,
        maxRange,
        totalGrossWeightPerPcs,
        totalNetWeightPerPcs,
        totalWithKharcha,
        isNormalSave
      });
      setNotice({ type: "success", text: "Saved! Refreshing…" });
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (err) {
      console.error(err);
      setNotice({ type: "error", text: `Save failed: ${String(err?.message || err)}` });
      setTimeout(() => setNotice(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  // ---- Excel Export (save first, then download) ----
  const handleExport = async () => {
    try {
      if (!meta.lotNumber) {
        alert("Lot Number is required to name the worksheet/file.");
        return;
      }
      if (!meta.brand) {
        alert("Brand is required before exporting to Excel.");
        return;
      }
      if (!sizes.length || !shades.length) {
        alert("Nothing to export — load a lot and enter some data first.");
        return;
      }
      const ok = window.confirm(
        "Before downloading, we need to store the current matrix to Google Sheets.\n\nProceed to save and then download?"
      );
      if (!ok) return;
      setExporting(true);
      await saveMatrixExpanded({
        meta,
        sizes,
        shades,
        cutting,
        cells,
        rolls,
        kgs,
        kapdaLayerWT,
        layerPcs,
        layerInch,
        dia,
        cuttingWeight,
        kapdaWapsi,
        proposedWeightPerPcs,
        netWeight,
        actualWeightPerPcs,
        diff,
        grossWeightPerPcs,
        netWeightPerPcs,
        wastagePercentage,
        wastageKgs,
        kharchaEntries,
        remarks, // Include combined remarks
        standardValue,
        minRange,
        maxRange,
        totalGrossWeightPerPcs,
        totalNetWeightPerPcs,
        totalWithKharcha
      });
      downloadExcelInner();
    } catch (err) {
      console.error(err);
      alert(`Save failed: ${String(err?.message || err)}\n\nExcel will not be downloaded.`);
    } finally {
      setExporting(false);
    }
  };

  // Excel builder function with formulas - Updated to include Combined Remarks section
  const downloadExcelInner = () => {
    const title = `Cutting Matrix — Lot ${meta.lotNumber}`;
    const tableHeader = [
      "Color",
      "Cutting Table",
      ...sizes,
      "Total Pcs",
      "Rolls",
      "Kgs(MTR)",
      "Kapda Layer WT",
      "Layer Pcs",
      "Layer Inch",
      "DIA",
      "Cutting Weight",
      "Kapda Wapsi",
      "Plan Weight/pcs",
      "Net weight",
      "Actual weight/pcs",
      "Diff",
      "Gross Weight/pcs",
      "Net Weight/pcs"
    ];

    // Calculate total number of rows including summary
    const totalRows = shades.length + 1; // +1 for summary row
    const summaryRowIndex = shades.length; // 0-based index for summary row

    const rows2D = shades.map((shade, rowIndex) => {
      const perSizes = sizes.map((sz) => {
        const v = String(cells[`${shade}|${sz}`] ?? "").trim();
        const n = parseDecimal(v);
        return Number.isFinite(n) ? n : v;
      });
      const total = perSizes.reduce((a, v) => a + (parseDecimal(v) || 0), 0);

      // Calculate row index for Excel formulas (1-based)
      const excelRow = rowIndex + 8; // Starting from row 8 (header row is 7)

      // Calculate plan weight per pcs using formula: Layer Weight / Layer Pcs
      const layerWT = parseDecimal(kapdaLayerWT[shade] || 0);
      const layerPcsVal = parseDecimal(layerPcs[shade] || 0);
      const planWeight = layerPcsVal > 0 ? (layerWT / layerPcsVal).toFixed(3) : "";

      // Calculate net weight using formula: Kgs - Kapda Wapsi
      const kgsVal = parseDecimal(kgs[shade] || 0);
      const kapdaWapsiVal = parseDecimal(kapdaWapsi[shade] || 0);
      const netWeightVal = (kgsVal - kapdaWapsiVal).toFixed(3);

      // Calculate actual weight per pcs using formula: Net Weight / Total Pcs
      const actualWeightPerPcsVal = total > 0 ? (parseDecimal(netWeightVal) / total).toFixed(3) : "";

      // Calculate gross weight per pcs using formula: Kgs / Total Pcs
      const grossWeightPerPcsVal = total > 0 ? (kgsVal / total).toFixed(3) : "";

      // Calculate net weight per pcs using formula: Net Weight / Total Pcs (same as actual weight per pcs)
      const netWeightPerPcsVal = actualWeightPerPcsVal;

      // Calculate diff using formula: Actual Weight Per Pcs - Plan Weight Per Pcs
      const diffVal = actualWeightPerPcsVal && planWeight
        ? (parseDecimal(actualWeightPerPcsVal) - parseDecimal(planWeight)).toFixed(3)
        : "";

      return [
        shade,
        cutting[shade] ?? "",
        ...perSizes,
        { f: `SUM(${indexToCol(2)}${excelRow}:${indexToCol(1 + sizes.length)}${excelRow})` }, // Total Pcs formula
        rolls[shade] ?? "",
        kgs[shade] ?? "",
        kapdaLayerWT[shade] ?? "",
        layerPcs[shade] ?? "",
        layerInch[shade] ?? "",
        dia[shade] ?? "",
        cuttingWeight[shade] ?? "",
        kapdaWapsi[shade] ?? "",
        layerPcsVal > 0 ? { f: `IF(${indexToCol(8)}${excelRow}>0, ${indexToCol(7)}${excelRow}/${indexToCol(8)}${excelRow}, "")` } : "", // Plan Weight formula
        { f: `IF(${indexToCol(6)}${excelRow}<>"", ${indexToCol(6)}${excelRow}-${indexToCol(11)}${excelRow}, "")` }, // Net weight formula
        { f: `IF(${indexToCol(2 + sizes.length)}${excelRow}>0, ${indexToCol(13)}${excelRow}/${indexToCol(2 + sizes.length)}${excelRow}, "")` }, // Actual weight/pcs formula
        { f: `IF(AND(${indexToCol(14)}${excelRow}<>"", ${indexToCol(12)}${excelRow}<>""), ${indexToCol(14)}${excelRow}-${indexToCol(12)}${excelRow}, "")` }, // Diff formula
        { f: `IF(${indexToCol(2 + sizes.length)}${excelRow}>0, ${indexToCol(6)}${excelRow}/${indexToCol(2 + sizes.length)}${excelRow}, "")` }, // Gross Weight/pcs formula
        { f: `IF(${indexToCol(2 + sizes.length)}${excelRow}>0, ${indexToCol(13)}${excelRow}/${indexToCol(2 + sizes.length)}${excelRow}, "")` } // Net Weight/pcs formula
      ];
    });

    // Add summary row
    const summaryRowStart = 8 + shades.length; // Row number for summary
    const sizeColStart = 2; // Column C (0-based index 2)
    const sizeColEnd = 1 + sizes.length; // Last size column

    // Create formula for each size column total
    const colTotalFormulas = sizes.map((_, index) => {
      const colLetter = indexToCol(sizeColStart + index);
      return { f: `SUM(${colLetter}8:${colLetter}${summaryRowStart - 1})` };
    });

    // Summary row
    const summaryRow = [
      "Total",
      "",
      ...colTotalFormulas,
      { f: `SUM(${indexToCol(sizeColEnd + 1)}8:${indexToCol(sizeColEnd + 1)}${summaryRowStart - 1})` }, // Total Pcs
      { f: `SUM(${indexToCol(sizeColEnd + 2)}8:${indexToCol(sizeColEnd + 2)}${summaryRowStart - 1})` }, // Rolls
      { f: `SUM(${indexToCol(sizeColEnd + 3)}8:${indexToCol(sizeColEnd + 3)}${summaryRowStart - 1})` }, // Kgs(MTR)
      { f: `SUM(${indexToCol(sizeColEnd + 4)}8:${indexToCol(sizeColEnd + 4)}${summaryRowStart - 1})` }, // Kapda Layer WT
      { f: `SUM(${indexToCol(sizeColEnd + 5)}8:${indexToCol(sizeColEnd + 5)}${summaryRowStart - 1})` }, // Layer Pcs
      { f: `SUM(${indexToCol(sizeColEnd + 6)}8:${indexToCol(sizeColEnd + 6)}${summaryRowStart - 1})` }, // Layer Inch
      { f: `SUM(${indexToCol(sizeColEnd + 7)}8:${indexToCol(sizeColEnd + 7)}${summaryRowStart - 1})` }, // DIA
      { f: `SUM(${indexToCol(sizeColEnd + 8)}8:${indexToCol(sizeColEnd + 8)}${summaryRowStart - 1})` }, // Cutting Weight
      { f: `SUM(${indexToCol(sizeColEnd + 9)}8:${indexToCol(sizeColEnd + 9)}${summaryRowStart - 1})` }, // Kapda Wapsi
      { f: `SUM(${indexToCol(sizeColEnd + 10)}8:${indexToCol(sizeColEnd + 10)}${summaryRowStart - 1})` }, // Plan Weight/pcs
      { f: `SUM(${indexToCol(sizeColEnd + 3)}${summaryRowStart}:${indexToCol(sizeColEnd + 3)}${summaryRowStart})-SUM(${indexToCol(sizeColEnd + 9)}${summaryRowStart}:${indexToCol(sizeColEnd + 9)}${summaryRowStart})` }, // Net weight
      "", // Actual weight/pcs (not calculated in summary)
      { f: `SUM(${indexToCol(sizeColEnd + 12)}8:${indexToCol(sizeColEnd + 12)}${summaryRowStart - 1})` }, // Diff
      { f: `IF(${indexToCol(sizeColEnd + 1)}${summaryRowStart}>0, ${indexToCol(sizeColEnd + 3)}${summaryRowStart}/${indexToCol(sizeColEnd + 1)}${summaryRowStart}, "")` }, // Gross Weight/pcs formula
      { f: `IF(${indexToCol(sizeColEnd + 1)}${summaryRowStart}>0, ${indexToCol(sizeColEnd + 11)}${summaryRowStart}/${indexToCol(sizeColEnd + 1)}${summaryRowStart}, "")` } // Net Weight/pcs formula
    ];

    // Add wastage calculation row
    const wastageRowIndex = summaryRowStart + 1;
    const wastageRow = [
      "Wastage Analysis",
      "",
      ...Array(sizes.length + 1).fill(""), // Fill size columns and total pcs
      "", // Rolls
      "", // Kgs(MTR)
      "", // Kapda Layer WT
      "", // Layer Pcs
      "", // Layer Inch
      "", // DIA
      "Total Cutting Weight:",
      { f: `${indexToCol(sizeColEnd + 8)}${summaryRowStart}` },
      "", // Plan Weight/pcs
      "Total Net Weight:",
      { f: `${indexToCol(sizeColEnd + 11)}${summaryRowStart}` },
      "", // Actual weight/pcs
      "", // Diff
      "", // Gross Weight/pcs
      "", // Net Weight/pcs
      "Wastage %:",
      { f: `IF(${indexToCol(sizeColEnd + 11)}${summaryRowStart}>0, (1-(${indexToCol(sizeColEnd + 8)}${summaryRowStart}/${indexToCol(sizeColEnd + 11)}${summaryRowStart}))*100, 0)` },
      "Wastage (Kgs):",
      { f: `${indexToCol(sizeColEnd + 11)}${summaryRowStart}-${indexToCol(sizeColEnd + 8)}${summaryRowStart}` }
    ];

    // Add Combined Remarks section
    const remarksRowIndex = wastageRowIndex + 1;
    const remarksHeader = ["Remarks / Notes"];
    const remarksData = [remarks || ""];

    // Add Kharcha section
    const kharchaRowIndex = remarksRowIndex + 3; // +3 for remarks section (header + data + empty row)
    const kharchaHeader = ["Kharcha Details", "", "", "", ""];
    const kharchaSubHeader = ["Type", "Description", "Kgs", "Pcs", "Per Pcs"];

    // Filter kharcha entries to only include those with includeInTotal: true
    const includedKharchaEntries = kharchaEntries.filter(entry => entry.includeInTotal);

    const kharchaRows = includedKharchaEntries.map((entry, index) => {
      const excelRow = kharchaRowIndex + 2 + index;
      return [
        entry.type || "",
        entry.description || "",
        entry.kgs || "",
        entry.pcs || "",
        { f: `IF(${indexToCol(2)}${excelRow}>0, ${indexToCol(0)}${excelRow}/${indexToCol(2)}${excelRow}, "")` } // Per Pcs formula
      ];
    });

    // Add Kharcha totals row
    const kharchaTotalRowIndex = kharchaRowIndex + 2 + includedKharchaEntries.length;
    const kharchaTotalRow = [
      "Total Kharcha",
      "",
      { f: `SUM(${indexToCol(0)}${kharchaRowIndex + 2}:${indexToCol(0)}${kharchaTotalRowIndex - 1})` }, // Total Kgs
      { f: `SUM(${indexToCol(2)}${kharchaRowIndex + 2}:${indexToCol(2)}${kharchaTotalRowIndex - 1})` }, // Total Pcs
      { f: `IF(${indexToCol(2)}${kharchaTotalRowIndex}>0, ${indexToCol(0)}${kharchaTotalRowIndex}/${indexToCol(2)}${kharchaTotalRowIndex}, "")` } // Average Per Pcs
    ];

    const metaRow1 = ["Lot Number:", meta.lotNumber || "", "Style:", meta.style || "", "Brand:", meta.brand || ""];
    const metaRow2 = ["Fabric:", meta.fabric || "", "Garment Type:", meta.garmentType || "", "Kharcha:", meta.kharcha || "", "Checked By Sahil Sir:", meta.checkedBySahilSir || "no"];

    const startOfTableRowIndex = 5;
    const data2D = [
      [title],
      [],
      metaRow1,
      metaRow2,
      [],
      tableHeader,
      ...rows2D,
      summaryRow,
      wastageRow,
      [],
      remarksHeader,
      remarksData,
      [],
      kharchaHeader,
      kharchaSubHeader,
      ...kharchaRows,
      kharchaTotalRow
    ];

    const ws = XLSX.utils.aoa_to_sheet(data2D);
    const totalCols = Math.max(tableHeader.length, wastageRow.length, 5); // At least 5 for kharcha
    const lastColIdx = totalCols - 1;
    const lastColLetter = XLSX.utils.encode_col(lastColIdx);

    ws["!merges"] = ws["!merges"] || [];
    ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastColIdx } });
    // Merge wastage analysis label
    ws["!merges"].push({ s: { r: wastageRowIndex, c: 0 }, e: { r: wastageRowIndex, c: 1 } });
    // Merge wastage analysis cells
    ws["!merges"].push({ s: { r: wastageRowIndex, c: sizeColEnd + 8 }, e: { r: wastageRowIndex, c: sizeColEnd + 9 } }); // Cutting Weight
    ws["!merges"].push({ s: { r: wastageRowIndex, c: sizeColEnd + 11 }, e: { r: wastageRowIndex, c: sizeColEnd + 12 } }); // Net Weight
    ws["!merges"].push({ s: { r: wastageRowIndex, c: sizeColEnd + 17 }, e: { r: wastageRowIndex, c: sizeColEnd + 18 } }); // Wastage %
    ws["!merges"].push({ s: { r: wastageRowIndex, c: sizeColEnd + 19 }, e: { r: wastageRowIndex, c: sizeColEnd + 20 } }); // Wastage Kgs
    // Merge remarks header
    ws["!merges"].push({ s: { r: remarksRowIndex, c: 0 }, e: { r: remarksRowIndex, c: lastColIdx } });
    // Merge remarks data
    ws["!merges"].push({ s: { r: remarksRowIndex + 1, c: 0 }, e: { r: remarksRowIndex + 1, c: lastColIdx } });
    // Merge kharcha header
    ws["!merges"].push({ s: { r: kharchaRowIndex, c: 0 }, e: { r: kharchaRowIndex, c: 4 } });

    // Adjust column widths
    const sizeCols = sizes.map(() => ({ wch: 6 }));
    ws["!cols"] = [
      { wch: 25 }, // Color
      { wch: 12 }, // Cutting Table
      ...sizeCols,
      { wch: 10 }, // Total Pcs
      { wch: 8 },  // Rolls
      { wch: 10 },  // Kgs(MTR) - slightly wider
      { wch: 12 }, // Kapda Layer WT
      { wch: 10 }, // Layer Pcs
      { wch: 10 }, // Layer Inch
      { wch: 8 },  // DIA
      { wch: 12 }, // Cutting Weight
      { wch: 12 }, // Kapda Wapsi
      { wch: 15 }, // Plan Weight/pcs
      { wch: 12 }, // Net weight
      { wch: 15 }, // Actual weight/pcs
      { wch: 10 }, // Diff
      { wch: 15 }, // Gross Weight/pcs
      { wch: 15 }, // Net Weight/pcs
      { wch: 12 }, // Extra column for wastage
      { wch: 12 }, // Extra column for wastage
      { wch: 15 }, // Kharcha Type
      { wch: 20 }, // Kharcha Description
      { wch: 10 }, // Kharcha Kgs
      { wch: 10 }, // Kharcha Pcs
      { wch: 12 }  // Kharcha Per Pcs
    ];

    const firstDataRowExcel = startOfTableRowIndex + 1;
    const lastRowExcel = data2D.length;
    ws["!autofilter"] = { ref: `A${firstDataRowExcel}:${lastColLetter}${lastRowExcel - includedKharchaEntries.length - 7}` }; // Exclude summary, wastage, remarks and kharcha from filter

    const setStyle = (r, c, style) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      ws[ref].s = { ...(ws[ref].s || {}), ...style };
    };
    const addBorderToRange = (r1, c1, r2, c2) => {
      const border = {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      };
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const ref = XLSX.utils.encode_cell({ r, c });
          if (!ws[ref]) ws[ref] = { t: "s", v: "" };
          ws[ref].s = { ...(ws[ref].s || {}), border };
        }
      }
    };

    setStyle(0, 0, {
      font: { bold: true, sz: 16, color: { rgb: "111827" } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "E5E7EB" } },
    });

    const metaLabelStyle = { font: { bold: true }, alignment: { horizontal: "left" } };
    const metaValueStyle = { alignment: { horizontal: "left" } };
    [[2, 0], [2, 2], [2, 4], [3, 0], [3, 2], [3, 4], [3, 6]].forEach(([r, c]) => setStyle(r, c, metaLabelStyle));
    [[2, 1], [2, 3], [2, 5], [3, 1], [3, 3], [3, 5], [3, 7]].forEach(([r, c]) => setStyle(r, c, metaValueStyle));
    addBorderToRange(2, 0, 3, 7);

    for (let c = 0; c <= lastColIdx; c++) {
      setStyle(startOfTableRowIndex, c, {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: "2563EB" } },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      });
    }

    const dataStartR = startOfTableRowIndex + 1;
    const dataEndR = data2D.length - includedKharchaEntries.length - 7; // Exclude summary, wastage, remarks and kharcha rows
    for (let r = dataStartR; r <= dataEndR; r++) {
      const isAlt = (r - dataStartR) % 2 === 1;
      for (let c = 0; c <= lastColIdx; c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (!ws[ref]) continue;
        ws[ref].s = {
          ...(ws[ref].s || {}),
          alignment: {
            horizontal: (c >= 2 && c < 2 + sizes.length) || c === (2 + sizes.length) ||
              (c >= 4 && c <= 5) || (c >= 12 && c <= 17) ? "center" : "left",
            vertical: "center"
          },
          fill: isAlt ? { fgColor: { rgb: "F8FAFC" } } : undefined,
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
          ...((c >= 2 && c < 2 + sizes.length) || c === (2 + sizes.length) ||
            (c >= 4 && c <= 11) || (c >= 12 && c <= 17) ? { numFmt: "0.000" } : {})
        };
      }
    }

    // Style summary row
    const summaryR = data2D.length - includedKharchaEntries.length - 7;
    for (let c = 0; c <= lastColIdx; c++) {
      setStyle(summaryR, c, {
        font: { bold: true, color: { rgb: "111827" } },
        alignment: {
          horizontal: (c >= 2 && c < 2 + sizes.length) || c === (2 + sizes.length) ||
            (c >= 4 && c <= 5) || (c >= 12 && c <= 17) ? "center" : "left",
          vertical: "center"
        },
        fill: { fgColor: { rgb: "DCFCE7" } },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
        ...((c >= 2 && c < 2 + sizes.length) || c === (2 + sizes.length) ||
          (c >= 4 && c <= 11) || (c >= 12 && c <= 17) ? { numFmt: "0.000" } : {}),
      });
    }

    // Style wastage row
    const wastageR = data2D.length - includedKharchaEntries.length - 6;
    for (let c = 0; c <= lastColIdx; c++) {
      setStyle(wastageR, c, {
        font: { bold: true, color: { rgb: "111827" } },
        alignment: { horizontal: "left", vertical: "center" },
        fill: { fgColor: { rgb: "FFF7ED" } },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      });
    }

    // Style specific cells in wastage row
    setStyle(wastageR, sizeColEnd + 8, {
      font: { bold: true, color: { rgb: "111827" } },
      alignment: { horizontal: "right", vertical: "center" },
      fill: { fgColor: { rgb: "FFF7ED" } },
    });

    setStyle(wastageR, sizeColEnd + 10, {
      font: { bold: true, color: { rgb: "111827" } },
      alignment: { horizontal: "right", vertical: "center" },
      fill: { fgColor: { rgb: "FFF7ED" } },
    });

    setStyle(wastageR, sizeColEnd + 16, {
      font: { bold: true, color: { rgb: "111827" } },
      alignment: { horizontal: "right", vertical: "center" },
      fill: { fgColor: { rgb: "FFF7ED" } },
    });

    setStyle(wastageR, sizeColEnd + 18, {
      font: { bold: true, color: { rgb: "111827" } },
      alignment: { horizontal: "right", vertical: "center" },
      fill: { fgColor: { rgb: "FFF7ED" } },
    });

    setStyle(wastageR, sizeColEnd + 9, {
      font: { bold: true, color: { rgb: "B45309" } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "FEF3C7" } },
      numFmt: "0.000"
    });

    setStyle(wastageR, sizeColEnd + 11, {
      font: { bold: true, color: { rgb: "B45309" } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "FEF3C7" } },
      numFmt: "0.000"
    });

    setStyle(wastageR, sizeColEnd + 17, {
      font: { bold: true, color: { rgb: "DC2626" } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "FEE2E2" } },
      numFmt: "0.00%"
    });

    setStyle(wastageR, sizeColEnd + 19, {
      font: { bold: true, color: { rgb: "DC2626" } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "FEE2E2" } },
      numFmt: "0.000"
    });

    // Style remarks section
    setStyle(remarksRowIndex, 0, {
      font: { bold: true, sz: 14, color: { rgb: "111827" } },
      alignment: { horizontal: "left", vertical: "center" },
      fill: { fgColor: { rgb: "F0F9FF" } },
      border: {
        top: { style: "medium", color: { rgb: "3B82F6" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    });

    setStyle(remarksRowIndex + 1, 0, {
      font: { sz: 12, color: { rgb: "111827" } },
      alignment: {
        horizontal: "left",
        vertical: "top",
        wrapText: true
      },
      fill: { fgColor: { rgb: "F8FAFC" } },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "medium", color: { rgb: "3B82F6" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    });

    // Style kharcha section
    setStyle(kharchaRowIndex, 0, {
      font: { bold: true, sz: 14, color: { rgb: "111827" } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "E0E7FF" } },
    });

    // Style kharcha subheader
    for (let c = 0; c < 5; c++) {
      setStyle(kharchaRowIndex + 1, c, {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: "4F46E5" } },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      });
    }

    // Style kharcha data rows
    for (let r = kharchaRowIndex + 2; r < kharchaTotalRowIndex; r++) {
      const isAlt = (r - kharchaRowIndex - 2) % 2 === 1;
      for (let c = 0; c < 5; c++) {
        setStyle(r, c, {
          font: { color: { rgb: "111827" } },
          alignment: {
            horizontal: c >= 2 ? "center" : "left",
            vertical: "center"
          },
          fill: isAlt ? { fgColor: { rgb: "F8FAFC" } } : { fgColor: { rgb: "FFFFFF" } },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
          ...(c >= 2 ? { numFmt: "0.000" } : {})
        });
      }
    }

    // Style kharcha total row
    for (let c = 0; c < 5; c++) {
      setStyle(kharchaTotalRowIndex, c, {
        font: { bold: true, color: { rgb: "111827" } },
        alignment: {
          horizontal: c >= 2 ? "center" : "left",
          vertical: "center"
        },
        fill: { fgColor: { rgb: "FEF3C7" } },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
        ...(c >= 2 ? { numFmt: "0.000" } : {})
      });
    }

    addBorderToRange(startOfTableRowIndex, 0, kharchaTotalRowIndex, lastColIdx);

    const wb = XLSX.utils.book_new();
    const safeName = String(meta.lotNumber).replace(/[\\/*?:\\[\]]/g, "_").slice(0, 31) || "Sheet1";
    XLSX.utils.book_append_sheet(wb, ws, safeName);
    XLSX.writeFile(wb, `CuttingMatrix_${safeName}.xlsx`);
  };

  // ---- Add Shade Dialog ----
  const tableScrollRef = useRef(null);
  const [showShadeDialog, setShowShadeDialog] = useState(false);
  const [newShade, setNewShade] = useState("");

  const openAddShade = () => {
    setNewShade("");
    setShowShadeDialog(true);
    setTimeout(() => {
      const el = document.getElementById("shadeNameInput");
      el?.focus();
      el?.select?.();
    }, 0);
  };
  const closeAddShade = () => setShowShadeDialog(false);

  const confirmAddShade = (e) => {
    e?.preventDefault?.();
    const shadeName = (newShade || "").trim();
    if (!shadeName) {
      setNotice({ type: "error", text: "Shade name cannot be empty." });
      setTimeout(() => setNotice(null), 2200);
      return;
    }
    const exists = shades.some((s) => s.toLowerCase() === shadeName.toLowerCase());
    if (exists) {
      setNotice({ type: "error", text: `Shade "${shadeName}" already exists.` });
      setTimeout(() => setNotice(null), 2200);
      return;
    }

    setShades((prev) => [...prev, shadeName]);
    setCutting((prev) => ({ ...prev, [shadeName]: "" }));
    setRolls((prev) => ({ ...prev, [shadeName]: "" }));
    setKgs((prev) => ({ ...prev, [shadeName]: "" }));
    setKapdaLayerWT((prev) => ({ ...prev, [shadeName]: "" }));
    setLayerPcs((prev) => ({ ...prev, [shadeName]: "" }));
    setLayerInch((prev) => ({ ...prev, [shadeName]: "" }));
    setDia((prev) => ({ ...prev, [shadeName]: "" }));
    setCuttingWeight((prev) => ({ ...prev, [shadeName]: "" }));
    setKapdaWapsi((prev) => ({ ...prev, [shadeName]: "" }));
    // Initialize new columns
    setProposedWeightPerPcs((prev) => ({ ...prev, [shadeName]: "" }));
    setNetWeight((prev) => ({ ...prev, [shadeName]: "" }));
    setActualWeightPerPcs((prev) => ({ ...prev, [shadeName]: "" }));
    setDiff((prev) => ({ ...prev, [shadeName]: "" }));
    // Initialize weight per piece columns
    setGrossWeightPerPcs((prev) => ({ ...prev, [shadeName]: "" }));
    setNetWeightPerPcs((prev) => ({ ...prev, [shadeName]: "" }));

    setCells((prev) => {
      const next = { ...prev };
      for (const sz of sizes) next[`${shadeName}|${sz}`] = "";
      return next;
    });

    setShowShadeDialog(false);
    setNotice({ type: "success", text: `Added shade "${shadeName}".` });
    setTimeout(() => setNotice(null), 1600);
    requestAnimationFrame(() => {
      const el = tableScrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  // ---- Kharcha Dialog ----
  const [showKharchaDialog, setShowKharchaDialog] = useState(false);
  const [newKharchaEntry, setNewKharchaEntry] = useState({
    type: "",
    description: "",
    kgs: "",
    pcs: "",
  });

  const openAddKharcha = () => {
    setNewKharchaEntry({
      type: "",
      description: "",
      kgs: "",
      pcs: grandTotal().toString(), // Auto-fill with grand total
    });
    setShowKharchaDialog(true);
    setTimeout(() => {
      const el = document.getElementById("kharchaTypeInput");
      el?.focus();
      el?.select?.();
    }, 0);
  };

  const closeAddKharcha = () => setShowKharchaDialog(false);

  const confirmAddKharcha = (e) => {
    e?.preventDefault?.();

    const type = (newKharchaEntry.type || "").trim();
    const description = (newKharchaEntry.description || "").trim();
    const kgs = parseDecimal(newKharchaEntry.kgs || 0);
    const pcs = parseDecimal(newKharchaEntry.pcs || 0);

    if (!type) {
      setNotice({ type: "error", text: "Kharcha Type cannot be empty." });
      setTimeout(() => setNotice(null), 2200);
      return;
    }

    if (kgs === 0 && pcs === 0) {
      setNotice({ type: "error", text: "Please enter at least Kgs or Pcs." });
      setTimeout(() => setNotice(null), 2200);
      return;
    }

    // Calculate per pcs if pcs > 0
    const perPcs = pcs > 0 ? (kgs / pcs).toFixed(3) : "0.000";

    const newEntry = {
      type,
      description,
      kgs: kgs.toFixed(3),
      pcs: pcs.toFixed(3),
      perPcs, // This will be calculated based on user input
      includeInTotal: false, // Default to excluded
      id: Date.now()
    };

    setKharchaEntries((prev) => [...prev, newEntry]);
    setShowKharchaDialog(false);
    setNotice({ type: "success", text: `Added kharcha entry: ${type}` });
    setTimeout(() => setNotice(null), 1600);
  };

  const removeKharchaEntry = (id) => {
    setKharchaEntries((prev) => prev.filter(entry => entry.id !== id));
    setNotice({ type: "success", text: "Kharcha entry removed." });
    setTimeout(() => setNotice(null), 1600);
  };

  // ---- Enter-as-Tab across matrix inputs ----
  const handleEnterNav = useCallback((e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const inputs = document.querySelectorAll(".matrix-input");
    const list = Array.from(inputs);
    const i = list.indexOf(e.currentTarget);
    if (i === -1) return;

    const next = e.shiftKey ? i - 1 : i + 1;
    if (next >= 0 && next < list.length) {
      list[next].focus();
      if (list[next].select) list[next].select();
    } else {
      document.getElementById("saveBtn")?.focus();
    }
  }, []);

  // ---- Simple Row Virtualization ----
  const VIRT_THRESHOLD = 120;
  const ROW_HEIGHT = 56;
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    const onResize = () => setViewportH(el.clientHeight);
    onResize();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [tableScrollRef, shades.length]);
  // Add this useEffect after your state declarations
  // Update the useEffect for fetching ranges
  useEffect(() => {
    if (showRangeDialog && rangeData.item && rangeData.style && rangeData.fabric) {
      console.log("Dialog open with sufficient data, fetching ranges...");
      fetchExistingRanges();
    }
  }, [showRangeDialog, rangeData.item, rangeData.style, rangeData.fabric]);

  // Keep the existing useEffect for collar changes
  useEffect(() => {
    if (rangeData.collar && showRangeDialog) {
      console.log("Collar changed in dialog:", rangeData.collar);
    }
  }, [rangeData.collar, showRangeDialog]);

  const useVirtual = shades.length > VIRT_THRESHOLD;
  const headerRows = 1;
  const footerRows = 1;
  const totalDataRows = shades.length;
  const startIdx = useMemo(() => {
    if (!useVirtual) return 0;
    const approx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 10);
    return Math.min(approx, totalDataRows - 1);
  }, [scrollTop, useVirtual, totalDataRows]);

  const visibleCount = useMemo(() => {
    if (!useVirtual) return totalDataRows;
    const rowsVisible = Math.ceil((viewportH || 600) / ROW_HEIGHT) + 20;
    return Math.min(rowsVisible, totalDataRows - startIdx);
  }, [viewportH, useVirtual, totalDataRows, startIdx]);

  const endIdx = startIdx + visibleCount;

  // Add CSS for Kharcha section and Combined Remarks
  const kharchaStyles = `
    .kharcha-section {
      margin-top: 24px;
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 22px;
      box-shadow: var(--shadow);
    }
    
    .kharcha-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    
    .kharcha-title {
      font-size: 20px;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    /* Update or add these styles to your kharchaStyles section */
    .kharcha-table {
      width: 100%;
      border-collapse: collapse;
      border-spacing: 0;
      margin-top: 12px;
      table-layout: fixed;
    }

    .kharcha-table th,
    .kharcha-table td {
      padding: 12px 10px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      vertical-align: middle;
    }

    .kharcha-table th {
      background: linear-gradient(180deg, #7C3AED, #6D28D9);
      color: white;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .06em;
      font-weight: 800;
      border-bottom: 2px solid rgba(0, 0, 0, 0.1);
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .kharcha-table tbody tr:nth-child(even) {
      background: #F8FAFC;
    }

    .kharcha-table tbody tr:hover {
      background: #F5F3FF;
    }

    .kharcha-table tfoot tr {
      background: #FEF3C7 !important;
      font-weight: 800;
      border-top: 3px solid rgba(245, 158, 11, 0.5);
    }

    .kharcha-empty {
      text-align: center;
      padding: 60px 20px;
      color: var(--muted);
      background: #F8FAFC;
      border-radius: 12px;
      border: 2px dashed #CBD5E1;
      margin-top: 20px;
    }
/* Add these styles to your existing CSS */
.range-warning {
  background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%) !important;
  border-left: 4px solid #DC2626 !important;
  animation: pulse 2s infinite;
}

.range-warning .summary-card-icon {
  background: #FEE2E2 !important;
  color: #DC2626 !important;
}

.range-warning .summary-card-value {
  color: #DC2626 !important;
  text-shadow: 0 1px 2px rgba(220, 38, 38, 0.1);
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }
  50% {
    box-shadow: 0 2px 8px rgba(220, 38, 38, 0.2);
  }
}
    .kharcha-summary {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
      margin-top: 12px;
      margin-bottom: 20px;
    }

    .kharcha-summary-item {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 700;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .kharcha-summary-value {
      color: #7C3AED;
      font-weight: 800;
      font-size: 16px;
      margin-left: 8px;
    }

    .kharcha-included-count {
      color: #16A34A;
      font-weight: 800;
      font-size: 16px;
      margin-left: 8px;
    }

    .kharcha-excluded-count {
      color: #DC2626;
      font-weight: 800;
      font-size: 16px;
      margin-left: 8px;
    }

    .kharcha-toggle-btn {
      background: #F1F5F9;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: .2s ease;
      font-size: 16px;
      margin: 0 auto;
    }

    .kharcha-toggle-btn:hover {
      background: #E2E8F0;
      border-color: #94A3B8;
    }

    .kharcha-toggle-btn.active {
      background: #DCFCE7;
      border-color: #86EFAC;
      color: #16A34A;
    }

.ring {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, var(--brand), #7C3AED, #EC4899, #F59E0B, var(--brand));
  animation: spin 1s linear infinite;
  -webkit-mask: radial-gradient(farthest-side, #0000 calc(100% - 3px), #000 0);
  mask: radial-gradient(farthest-side, #0000 calc(100% - 3px), #000 0);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
    .kharcha-remove-btn {
      background: #FEF2F2;
      color: #DC2626;
      border: 1px solid #FCA5A5;
      border-radius: 6px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
      transition: .2s ease;
      white-space: nowrap;
    }

    .kharcha-remove-btn:hover {
      background: #FEE2E2;
      transform: translateY(-1px);
    }
    
    /* Add these to your existing CSS */
    .diff-positive {
      background-color: #40f880 !important; /* Light green */
      color: #000000 !important; /* Black text */
      border: 1px solid rgba(22, 163, 74, 0.3) !important;
    }

    .diff-negative {
      background-color: #ff7474 !important; /* Proper red - lighter shade */
      color: #000000 !important; /* Black text */
      border: 1px solid rgba(241, 66, 66, 0.3) !important;
    }

    .diff-zero {
      background-color: #F1F5F9 !important; /* Light gray */
      color: #64748B !important; /* Muted text */
      border: 1px solid rgba(100, 116, 139, 0.3) !important;
    }

    .diff-empty {
      background-color: #F1F5F9 !important; /* Light gray */
      color: #64748B !important; /* Muted text */
      border: 1px solid var(--border) !important;
    }

    /* Alternative if you want darker red */
    .diff-negative-dark {
      background-color: #FCA5A5 !important; /* Medium red */
      color: #000000 !important;
      border: 1px solid rgba(239, 68, 68, 0.5) !important;
    }
    
    .kharcha-input {
      width: 100%;
      padding: 8px 6px;
      border-radius: 6px;
      background: #FFFFFF;
      color: var(--text);
      border: 1px solid var(--border);
      outline: none;
      transition: .15s ease;
      font-size: 14px;
    }
    
    .kharcha-input:focus {
      box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.2);
      border-color: rgba(124, 58, 237, 0.35);
    }
    
    .kharcha-remove-btn {
      background: #FEF2F2;
      color: #DC2626;
      border: 1px solid #FCA5A5;
      border-radius: 6px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
      transition: .2s ease;
    }
    
    .kharcha-remove-btn:hover {
      background: #FEE2E2;
    }
    
    .kharcha-empty {
      text-align: center;
      padding: 40px 20px;
      color: var(--muted);
      font-style: italic;
    }
    
    .kharcha-summary {
      display: flex;
      gap: 16px;
      margin-top: 12px;
      flex-wrap: wrap;
    }
    
    .kharcha-summary-item {
      background: #F8FAFC;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 14px;
      font-weight: 700;
    }
    
    .kharcha-summary-value {
      color: #7C3AED;
      font-weight: 800;
    }
      /* Add to your existing CSS */
.range-dialog-section {
  margin-bottom: 16px;
}

.range-type-selector {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.range-type-btn {
  flex: 1;
  padding: 10px;
  border: 2px solid #E2E8F0;
  border-radius: 8px;
  background: #FFFFFF;
  color: #64748B;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.range-type-btn.active {
  border-color: #2563EB;
  background: #EFF6FF;
  color: #2563EB;
}

.range-type-btn:hover {
  border-color: #CBD5E1;
}

.auto-collar-display {
  padding: 12px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  background: #F8FAFC;
  color: #334155;
  font-weight: 600;
  min-height: 44px;
}

.saved-ranges-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 8px;
}

.range-item {
  padding: 8px;
  border-bottom: 1px solid #F1F5F9;
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.range-item:last-child {
  border-bottom: none;
}
    
    .kharcha-toggle-btn {
      background: #F1F5F9;
      border: 1px solid #CBD5E1;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: .2s ease;
      font-size: 14px;
    }
    
    .kharcha-toggle-btn:hover {
      background: #E2E8F0;
      border-color: #94A3B8;
    }
    
    .kharcha-toggle-btn.active {
      background: #DCFCE7;
      border-color: #86EFAC;
      color: #16A34A;
    }
    
    .kharcha-included-count {
      color: #16A34A;
      font-weight: 800;
    }
    
    .kharcha-excluded-count {
      color: #DC2626;
      font-weight: 800;
    }
    
    /* Combined Remarks section styles */
    .remarks-section {
      margin-top: 24px;
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 22px;
      box-shadow: var(--shadow);
    }
    
    .remarks-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    
    .remarks-title {
      font-size: 20px;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .remarks-textarea {
      width: 100%;
      min-height: 120px;
      padding: 16px;
      border-radius: 12px;
      background: #FFFFFF;
      color: var(--text);
      border: 1px solid var(--border);
      outline: none;
      transition: .2s ease;
      font-size: 14px;
      line-height: 1.5;
      resize: vertical;
      font-family: inherit;
    }
    
    .remarks-textarea:focus {
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
      border-color: rgba(59, 130, 246, 0.35);
    }
      /* Add to your CSS styles */
.diff-exceeds-standard {
  background-color: #ff4747 !important; /* Bright red */
  color: #FFFFFF !important; /* White text */
  font-weight: 800 !important;
  border: 2px solid #dc2626 !important;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important;
}

/* Update existing diff styles for consistency */
.diff-positive {
  background-color: #d1fae5 !important; /* Light green */
  color: #065f46 !important; /* Dark green text */
  border: 1px solid #10b981 !important;
}

.diff-negative {
  background-color: #fef3c7 !important; /* Light yellow */
  color: #92400e !important; /* Dark amber text */
  border: 1px solid #f59e0b !important;
}

.diff-zero {
  background-color: #f1f5f9 !important; /* Light gray */
  color: #64748b !important; /* Muted text */
  border: 1px solid #cbd5e1 !important;
}

.diff-empty {
  background-color: #f8fafc !important; /* Very light gray */
  color: #94a3b8 !important; /* Light muted text */
  border: 1px solid #e2e8f0 !important;
}

/* Optional: Add warning icon for exceeds standard */
.diff-exceeds-standard::before {
  content: "⚠️ ";
  font-size: 12px;
  margin-right: 4px;
}
    
    .remarks-textarea::placeholder {
      color: #94A3B8;
      font-style: italic;
    }
    
    .remarks-char-count {
      margin-top: 8px;
      font-size: 12px;
      color: #64748B;
      text-align: right;
      font-weight: 600;
    }
    
    .remarks-empty {
      color: #94A3B8;
      font-style: italic;
      text-align: center;
      padding: 40px 20px;
    }
  `;

  // ---- UI ----
  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

        :root {
          --bg: #F1F5F9;
          --card: rgba(255, 255, 255, 0.85);
          --muted: #64748B;
          --text: #0F172A;
          --brand: #6366F1;
          --brand-2: #4F46E5;
          --brand-light: #EEF2FF;
          --accent: #10B981;
          --accent-hover: #059669;
          --warning: #F59E0B;
          --danger: #EF4444;
          --ring: 0 0 0 4px rgba(99, 102, 241, 0.15);
          --shadow: 0 10px 30px rgba(99, 102, 241, 0.05);
          --border: rgba(99, 102, 241, 0.08);
          --radius: 16px;
        }

        * { box-sizing: border-box; }
        body { 
          background-color: var(--bg);
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .app { min-height: 100vh; color: var(--text); padding: 12px; }
        .container { max-width: 2000px; margin: 0 auto; }

        /* Modernized Header */
        .modern-header {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
          border: 1px solid var(--border);
          border-radius: 18px; 
          padding: 24px; 
          margin-bottom: 20px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.015);
        }
        .header-content { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
        .title { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; display: flex; gap: 10px; align-items: center; color: #1E1B4B; }
        .subtitle { color: var(--muted); margin-top: 4px; font-size: 14px; font-weight: 500; }

        /* Inputs & Buttons */
        .input-container { position: relative; min-width: 280px; }
        .search-input {
          width: 100%; 
          padding: 12px 16px 12px 42px; 
          border-radius: 12px;
          border: 1px solid rgba(99, 102, 241, 0.2); 
          background: #FFFFFF;
          color: var(--text); 
          outline: none; 
          transition: all 0.25s ease;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);
          font-weight: 600;
        }
        .search-input:focus { box-shadow: var(--ring); border-color: var(--brand); }
        .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); opacity: 0.6; }
        .search-hint {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          font-size: 11px; color: #4F46E5; background: #EEF2FF; border: 1px solid #C7D2FE;
          padding: 2px 6px; border-radius: 6px; font-weight: 800;
        }
        .btn {
          display: inline-flex; 
          align-items: center; 
          gap: 8px; 
          border-radius: 12px; 
          padding: 10px 18px;
          font-weight: 700; 
          cursor: pointer; 
          border: 1px solid rgba(99, 102, 241, 0.15); 
          transition: all 0.2s ease; 
          white-space: nowrap;
          background: #FFFFFF;
          color: #4F46E5;
        }
        .btn:hover:not(:disabled) {
          background: var(--brand-light);
          border-color: var(--brand);
          color: var(--brand-2);
          transform: translateY(-1px);
        }
        .btn:active:not(:disabled) { transform: translateY(1px); }
        .btn-primary { background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%); color: white; border-color: transparent; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15); }
        .btn-primary:hover:not(:disabled) { background: linear-gradient(135deg, var(--brand-2) 0%, #3730A3 100%); box-shadow: var(--ring), 0 6px 16px rgba(99, 102, 241, 0.25); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Main Workspace Wrapper */
        .main-content {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(12px);
          border: 1px solid var(--border); 
          border-radius: 18px; 
          padding: 24px; 
          box-shadow: var(--shadow);
        }

        /* Database suggestions badges */
        .db-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          color: #4F46E5;
          background-color: #EEF2FF;
          border: 1px solid rgba(79, 70, 229, 0.25);
          border-radius: 20px;
          padding: 3px 8px;
          margin-top: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(79, 70, 229, 0.03);
        }
        .db-badge:hover {
          background-color: #4F46E5;
          color: #FFFFFF;
          border-color: #4F46E5;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(79, 70, 229, 0.2);
        }
        .db-badge-weight {
          color: #10B981;
          background-color: #ECFDF5;
          border-color: rgba(16, 185, 129, 0.25);
        }
        .db-badge-weight:hover {
          background-color: #10B981;
          color: #FFFFFF;
          border-color: #10B981;
          box-shadow: 0 4px 8px rgba(16, 185, 129, 0.2);
        }

        /* Notices */
        .error-message, .notice {
          border-radius: 12px; padding: 14px 16px; margin: 12px 0; font-weight: 700; display: flex; gap: 10px; align-items: center;
          border: 1px solid; animation: slideIn 0.3s ease-out;
        }
        .error-message { background: #FEF2F2; color: #991B1B; border-color: #FCA5A5; }
        .notice { background: #ECFDF5; color: #065F46; border-color: #A7F3D0; }
        .notice.error { background: #FEF2F2; color: #991B1B; border-color: #FCA5A5; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

        /* Meta Deck */
        .meta-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-top: 14px; }
        .meta-item {
          background: rgba(255, 255, 255, 0.7); 
          border: 1px solid var(--border); 
          border-radius: 14px; 
          padding: 16px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.005);
          transition: all 0.2s ease;
        }
        .meta-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(99, 102, 241, 0.05);
          border-color: var(--brand);
        }
        .meta-label { color: var(--muted); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
        .meta-value { font-size: 16px; font-weight: 700; margin-top: 6px; color: var(--text); }

        /* Sizing slabs validation warnings */
        .range-warning {
          background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%) !important;
          border-left: 4px solid #DC2626 !important;
          animation: pulse 2.2s infinite;
        }
        .range-warning .summary-card-icon { background: #FEE2E2 !important; color: #DC2626 !important; }
        .range-warning .summary-card-value { color: #DC2626 !important; }
        @keyframes pulse { 0%, 100% { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); } 50% { box-shadow: 0 2px 12px rgba(220, 38, 38, 0.15); } }

        /* Enhanced Summary Cards Deck */
        .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 20px; margin-bottom: 20px; }
        .summary-card {
          background: linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 18px 16px;
          display: flex;
          flex-direction: column;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
          position: relative;
          overflow: hidden;
          min-height: 120px;
        }
        .summary-card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06); border-color: rgba(99, 102, 241, 0.15); }
        .summary-card-title { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
        .summary-card-icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; }
        .summary-card-value {
          font-size: 26px; font-weight: 800; line-height: 1.1; margin-top: 10px; margin-bottom: 4px; color: var(--text);
          background: linear-gradient(135deg, var(--text) 0%, #475569 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .summary-card-subtitle { font-size: 12px; color: var(--muted); font-weight: 600; }

        /* Card theme variants */
        .card-primary { border-left: 4px solid var(--brand); background: linear-gradient(135deg, #FFFFFF 0%, #EEF2FF 100%); }
        .card-primary .summary-card-icon { background: #EEF2FF; color: var(--brand); }
        
        .card-success { border-left: 4px solid var(--accent); background: linear-gradient(135deg, #FFFFFF 0%, #ECFDF5 100%); }
        .card-success .summary-card-icon { background: #ECFDF5; color: var(--accent); }
        
        .card-warning { border-left: 4px solid var(--warning); background: linear-gradient(135deg, #FFFFFF 0%, #FFFBEB 100%); }
        .card-warning .summary-card-icon { background: #FFFBEB; color: var(--warning); }
        
        .card-danger { border-left: 4px solid var(--danger); background: linear-gradient(135deg, #FFFFFF 0%, #FEF2F2 100%); }
        .card-danger .summary-card-icon { background: #FEF2F2; color: var(--danger); }
        
        .card-info { border-left: 4px solid #7C3AED; background: linear-gradient(135deg, #FFFFFF 0%, #F5F3FF 100%); }
        .card-info .summary-card-icon { background: #F5F3FF; color: #7C3AED; }

        /* Matrix Table Grid Layout */
        .table-container { margin-top: 20px; background: #FFFFFF; border: 1px solid rgba(99, 102, 241, 0.08); border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.01); }
        .table-scroll { overflow: auto; max-height: 72vh; }
        .data-table { width: 100%; border-collapse: separate; border-spacing: 0; min-width: ${minTableWidth}px; font-size: 14px; }
        thead th {
          position: sticky; top: 0; 
          background: linear-gradient(135deg, #4F46E5, #3730A3);
          color: white; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; font-weight: 800;
          padding: 14px 10px; border-bottom: 2px solid rgba(0,0,0,.08); z-index: 2;
          text-align: center;
        }
        thead th:first-child { text-align: left; }
        tbody td { padding: 12px 10px; border-bottom: 1px solid rgba(99,102,241,0.04); text-align: center; }
        tbody td:first-child { text-align: left; }
        tbody tr:nth-child(even) { background: rgba(99, 102, 241, 0.01); }
        tbody tr:hover { background: rgba(99, 102, 241, 0.03); }
        
        .shade-cell { font-weight: 800; min-width: 170px; max-width: 190px; color: #1E1B4B; }

        /* Table Inputs */
        .cell-input,
        .rolls-input, 
        .kgs-input, 
        .kapda-input, 
        .layer-input, 
        .dia-input, 
        .weight-input, 
        .wapsi-input,
        .cutting-input,
        .proposed-weight-input,
        .net-weight-input,
        .actual-weight-input,
        .diff-input,
        .gross-weight-pcs-input,
        .net-weight-pcs-input {
          width: 100%;
          padding: 8px 6px;
          border-radius: 8px;
          background: #FFFFFF;
          color: var(--text);
          border: 1px solid rgba(99, 102, 241, 0.15);
          outline: none;
          text-align: center;
          transition: all 0.2s ease;
          font-size: 13px;
          font-weight: 600;
        }
        .cell-input:focus,
        .rolls-input:focus, 
        .kgs-input:focus, 
        .kapda-input:focus, 
        .layer-input:focus, 
        .dia-input:focus, 
        .weight-input:focus, 
        .wapsi-input:focus,
        .cutting-input:focus {
          box-shadow: var(--ring);
          border-color: var(--brand);
        }
        
        /* Disabled & Calculated Input cells */
        .proposed-weight-input, .net-weight-input, .actual-weight-input, .diff-input,
        .gross-weight-pcs-input, .net-weight-pcs-input {
          background-color: #F8FAFC !important;
          border-color: rgba(99, 102, 241, 0.06) !important;
          cursor: not-allowed;
          font-weight: 700;
          color: #475569;
        }

        .total-cell { font-weight: 800; text-align: right !important; color: #1E1B4B; }
        .footer-row td { border-top: 2px solid rgba(16, 185, 129, 0.3); background: #ECFDF5 !important; font-weight: 800; color: #065F46; }

        /* Difference states */
        .diff-positive { background-color: #DCFCE7 !important; color: #15803D !important; border: 1.5px solid #86EFAC !important; }
        .diff-negative { background-color: #FEF3C7 !important; color: #B45309 !important; border: 1.5px solid #FDE68A !important; }
        .diff-zero { background-color: #F1F5F9 !important; color: #64748B !important; border: 1.5px solid rgba(100, 116, 139, 0.15) !important; }
        .diff-empty { background-color: #F1F5F9 !important; color: #64748B !important; border: 1.5px solid rgba(100, 116, 139, 0.15) !important; }
        .diff-exceeds-standard {
          background-color: #FEE2E2 !important; color: #B91C1C !important; font-weight: 800 !important;
          border: 1.5px solid #FCA5A5 !important; animation: shake 0.5s ease-in-out;
        }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }

        /* Empty & Loading states */
        .empty-state { text-align: center; padding: 70px 20px; color: var(--muted); }
        .empty-icon { font-size: 64px; margin-bottom: 12px; opacity: 0.6; }

        .loading-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.15); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; }
        .loading-card { background: #FFFFFF; border: 1px solid rgba(99, 102, 241, 0.1); border-radius: 16px; padding: 24px; min-width: 320px; display: grid; gap: 12px; place-items: center; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
        .progress { width: 100%; height: 6px; border-radius: 999px; background: #E2E8F0; overflow: hidden; }
        .progress::after {
          content: ""; display: block; width: 45%; height: 100%; 
          background: linear-gradient(90deg, #6366F1, #8B5CF6, #6366F1);
          animation: slide 1.2s ease-in-out infinite; border-radius: 999px;
        }
        @keyframes slide { 0% { transform: translateX(-50%) } 50% { transform: translateX(150%) } 100% { transform: translateX(-50%) } }

        /* Sticky bottom action bar */
        .action-bar {
          position: sticky; bottom: 0; margin-top: 20px;
          background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(12px);
          border: 1px solid var(--border); border-radius: 16px; padding: 14px 20px; display: flex; gap: 14px; align-items: center;
          justify-content: space-between; box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.03); z-index: 10;
        }
        .totals { display: flex; gap: 14px; align-items: center; color: #1E293B; font-weight: 800; font-size: 14px; }
        .pill { padding: 6px 12px; border-radius: 999px; background: #EEF2FF; border: 1px solid #C7D2FE; color: #4F46E5; }

        /* Range Config Dialog Overlay */
        .dialog-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 999; }
        .dialog-card {
          background: #FFFFFF; border: 1px solid rgba(99, 102, 241, 0.1); border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.15);
          width: min(92vw, 440px); padding: 24px; display: grid; gap: 14px; animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .dialog-title { font-size: 20px; font-weight: 800; color: #1E1B4B; }
        .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }

        @media (max-width: 768px) {
          .header-content { flex-direction: column; align-items: stretch; }
          .title { justify-content: center; }
          .summary-cards { grid-template-columns: 1fr; }
          .action-bar { flex-direction: column; gap: 12px; }
        }
        
        ${kharchaStyles}
      `}</style>

      <div className="container" role="region" aria-label="Cutting Matrix Dashboard">
        {/* Header */}
        <div className="modern-header">
          <div className="header-content">
            <div>
              <h1 className="title">📊 Parta Details</h1>
              <div className="subtitle">Cutting Matrix Dashboard</div>
            </div>

            <div className="search-section" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="input-container">
                <span className="search-icon">🔍</span>
                <input
                  ref={lotInputRef}
                  className="search-input"
                  type="text"
                  value={lot}
                  onChange={(e) => setLot(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                  placeholder="Enter Lot Number..."
                  aria-label="Lot Number"
                />
                <span className="search-hint">Enter</span>
              </div>

              <button onClick={search} disabled={loading || saving} className="btn btn-primary" aria-busy={loading}>
                {loading && <div className="ring" />}
                {loading ? "Searching..." : "Search Lot"}
              </button>

              <button
                onClick={async () => {
                  if (isAdmin) return;
                  setShowRangeDialog(true);

                  // Auto-fill dialog with current lot data
                  autoFillRangeDialog();

                  // Load dropdown values when dialog opens
                  if (dropdownValues.items.length === 0) {
                    setLoadingJobOrders(true);
                    try {
                      const values = await fetchJobOrderValues();
                      setDropdownValues(values);
                    } catch (error) {
                      console.error("Failed to load dropdown values:", error);
                      setNotice({ type: "error", text: "Failed to load job order data" });
                      setTimeout(() => setNotice(null), 3000);
                    } finally {
                      setLoadingJobOrders(false);
                    }
                  }
                }}
                className="btn"
                disabled={isAdmin}
                title={isAdmin ? "Disabled in Admin mode" : "Define measurement ranges"}
              >
                📏 Define Range
              </button>

              <button
                onClick={handleExport}
                className="btn btn-primary"
                disabled={exporting || saving || !meta.lotNumber || !sizes.length || !shades.length}
                title={!meta.lotNumber ? "Search a lot first" : ""}
                aria-busy={exporting}
              >
                {exporting && <div className="ring" />}
                {exporting ? "Saving & Downloading..." : "Download Excel"}
              </button>

              <button
                onClick={handleView}
                className="btn"
                disabled={saving || loading || exporting}
                title="View Details"
              >
                👁️ View
              </button>

              <button
                onClick={() => clearAll(true)}
                className="btn"
                disabled={loading || exporting || saving}
                title="Clear everything"
              >
                🔄 Refresh
              </button>

              <button
                type="button"
                onClick={handleBackSafe}
                className="btn"
                disabled={loading || exporting || saving}
                title="Go back"
                aria-label="Go back"
              >
                ⬅️ Back
              </button>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="main-content" aria-live="polite">
          {error && (
            <div className="error-message" role="alert">
              <span>⚠️</span>
              <div style={{ flex: 1 }}>
                {error}
                {(error.includes('HTTP 500') || error.includes('temporary server issue') || error.includes('retrying')) && (
                  <div style={{ fontSize: '14px', marginTop: '4px', opacity: 0.8, fontWeight: 'normal' }}>
                    This is usually temporary. The app will automatically retry, or you can try again in a moment.
                  </div>
                )}
                {error.includes('cached data') && (
                  <div style={{ fontSize: '14px', marginTop: '4px', opacity: 0.8, fontWeight: 'normal' }}>
                    Showing last successful data fetch. Some information might be outdated.
                  </div>
                )}
              </div>
              {!error.includes('retrying') && !error.includes('cached data') && (
                <button
                  onClick={() => search()}
                  className="btn"
                  style={{ marginLeft: '12px', padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                >
                  Retry Search
                </button>
              )}
            </div>
          )}

          {notice && (
            <div className={`notice ${notice.type === "error" ? "error" : ""}`} role="status">
              <span>{notice.type === "success" ? "✅" : "⚠️"}</span>
              {notice.text}
            </div>
          )}

          {isAdmin && (
            <div className="notice" style={{ background: '#EFF6FF', color: '#1E40AF', borderColor: '#BFDBFE' }} role="status">
              <span>ℹ️</span>
              Admin View-Only Mode: You can search and inspect lot matrices, but editing and saving is disabled.
            </div>
          )}

          {(meta.fabric || meta.garmentType || meta.lotNumber || meta.style || meta.brand) && (
            <div className="meta-container">
              <div className="meta-item">
                <div className="meta-label">Brand</div>
                <div className="meta-value">{meta.brand || "—"}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Fabric</div>
                <div className="meta-value">{meta.fabric || "—"}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Garment Type</div>
                <div className="meta-value">{meta.garmentType || "—"}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Lot Number</div>
                <div className="meta-value">{meta.lotNumber || "—"}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Style</div>
                <div className="meta-value">{meta.style || "—"}</div>
              </div>
              <div className="meta-item" style={{ border: '1px solid rgba(99, 102, 241, 0.25)', background: 'rgba(255, 255, 255, 0.9)' }}>
                <div className="meta-label" style={{ color: 'var(--brand)', fontWeight: 'bold' }}>Kharcha (Expense)</div>
                <input
                  type="number"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    marginTop: '8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    background: '#FFFFFF',
                    color: 'var(--text)',
                    outline: 'none',
                    fontSize: '14px',
                    fontWeight: '700',
                    transition: 'all 0.2s ease'
                  }}
                  value={meta.kharcha || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMeta(prev => ({ ...prev, kharcha: val }));
                  }}
                  onBlur={handleKharchaBlurOrEnter}
                  onKeyDown={handleKharchaBlurOrEnter}
                  placeholder="Enter Kharcha..."
                  disabled={isAdmin || meta.checkedBySahilSir === "yes"}
                  aria-label="Kharcha Amount"
                />
              </div>
              <div className="meta-item" style={{ border: '1px solid rgba(99, 102, 241, 0.25)', background: 'rgba(255, 255, 255, 0.9)' }}>
                <div className="meta-label" style={{ color: 'var(--brand)', fontWeight: 'bold' }}>Checked By Sahil Sir</div>
                <select
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    marginTop: '8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    background: '#FFFFFF',
                    color: 'var(--text)',
                    outline: 'none',
                    fontSize: '14px',
                    fontWeight: '700',
                    appearance: 'auto',
                    transition: 'all 0.2s ease'
                  }}
                  value={meta.checkedBySahilSir || "no"}
                  disabled={isAdmin}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "yes") {
                      const confirmLock = window.confirm("Are you sure you want to confirm and lock this Parta? This will disable editing for all data.");
                      if (confirmLock) {
                        setMeta(prev => ({ ...prev, checkedBySahilSir: "yes" }));
                      } else {
                        // Revert selection
                        e.target.value = "no";
                      }
                    } else {
                      const confirmUnlock = window.confirm("Are you sure you want to unlock this Parta?");
                      if (confirmUnlock) {
                        setMeta(prev => ({ ...prev, checkedBySahilSir: "no" }));
                      } else {
                        // Revert selection
                        e.target.value = "yes";
                      }
                    }
                  }}
                  aria-label="Checked By Sahil Sir confirmation dropdown"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          {shades.length > 0 && (
            <div className="summary-cards">
              <div className="summary-card card-primary">
                <div className="summary-card-title">
                  <span className="summary-card-icon">📦</span>
                  Total Pieces
                </div>
                <div className="summary-card-value">{grandTotal()}</div>
                <div className="summary-card-subtitle">Across all shades and sizes</div>
              </div>

              <div className="summary-card card-success">
                <div className="summary-card-title">
                  <span className="summary-card-icon">⚖️</span>
                  Gross Weight/Pc
                </div>
                <div className="summary-card-value">{totalGrossWeightPerPcs.toFixed(3)}</div>
                <div className="summary-card-subtitle">Total Kgs ÷ Total Pieces</div>
              </div>

              <div className="summary-card card-info">
                <div className="summary-card-title">
                  <span className="summary-card-icon">⚖️</span>
                  Net Weight/Pc
                </div>
                <div className="summary-card-value">{totalNetWeightPerPcs.toFixed(3)}</div>
                <div className="summary-card-subtitle">Net Weight ÷ Total Pieces</div>
              </div>

              <div className="summary-card card-warning">
                <div className="summary-card-title">
                  <span className="summary-card-icon">📊</span>
                  Wastage %
                </div>
                <div className="summary-card-value">{wastagePercentage.toFixed(2)}%</div>
                <div className="summary-card-subtitle">1 - (Cutting Weight ÷ Net Weight)</div>
              </div>

              {dbTotalIssuedWeight > 0 && (
                <div className="summary-card card-info" style={{ borderLeft: '4px solid #10B981' }}>
                  <div className="summary-card-title">
                    <span className="summary-card-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>⚖️</span>
                    SQL Issued Weight
                  </div>
                  <div className="summary-card-value" style={{ color: '#10B981', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    {dbTotalIssuedWeight.toFixed(2)} <span style={{ fontSize: '14px', fontWeight: '800' }}>KG</span>
                  </div>
                  <div className="summary-card-subtitle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 'auto' }}>
                    <span>{dbTotalIssuedRolls} Rolls ({dbTotalReturnedWeight.toFixed(2)} KG Ret)</span>
                    <button
                      onClick={autoFillAllDbWeights}
                      className="btn"
                      disabled={isAdmin}
                      style={{ padding: '3px 8px', fontSize: '11px', height: '24px', borderRadius: '6px', background: '#ECFDF5', color: '#047857', border: '1px solid rgba(16, 185, 129, 0.2)' }}
                      title={isAdmin ? "Disabled in Admin mode" : "Auto-fill Rolls, Kgs, and Returns for all matching colors from database"}
                    >
                      📥 Auto-Fill
                    </button>
                  </div>
                </div>
              )}

              {/* New Total card */}
              <div className="summary-card"
                style={{
                  borderLeft: '4px solid #7C3AED',
                  background: (() => {
                    const totalValue = grandTotal() > 0 ? totalWithKharcha : 0;

                    // Check if range is set and total is outside range
                    if (minRange > 0 || maxRange > 0) {
                      if (minRange > 0 && totalValue < minRange) {
                        return 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)'; // Red gradient for below min
                      }
                      if (maxRange > 0 && totalValue > maxRange) {
                        return 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)'; // Red gradient for above max
                      }
                    }

                    // Default gradient if within range or no range set
                    return 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)';
                  })(),
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                <div className="summary-card-title">
                  <span className="summary-card-icon" style={{
                    background: (() => {
                      const totalValue = grandTotal() > 0 ? totalWithKharcha : 0;
                      if (minRange > 0 || maxRange > 0) {
                        if ((minRange > 0 && totalValue < minRange) || (maxRange > 0 && totalValue > maxRange)) {
                          return '#FEF2F2';
                        }
                      }
                      return '#F5F3FF';
                    })(),
                    color: (() => {
                      const totalValue = grandTotal() > 0 ? totalWithKharcha : 0;
                      if (minRange > 0 || maxRange > 0) {
                        if ((minRange > 0 && totalValue < minRange) || (maxRange > 0 && totalValue > maxRange)) {
                          return '#DC2626';
                        }
                      }
                      return '#7C3AED';
                    })()
                  }}>📊</span>
                  Total
                </div>
                <div className="summary-card-value" style={{
                  color: (() => {
                    const totalValue = grandTotal() > 0 ? totalWithKharcha : 0;
                    if (minRange > 0 || maxRange > 0) {
                      if ((minRange > 0 && totalValue < minRange) || (maxRange > 0 && totalValue > maxRange)) {
                        return '#DC2626';
                      }
                    }
                    return 'inherit';
                  })()
                }}>
                  {grandTotal() > 0 ? totalWithKharcha.toFixed(3) : "0.000"}
                </div>
                <div className="summary-card-subtitle">
                  {(() => {
                    const totalValue = grandTotal() > 0 ? totalWithKharcha : 0;

                    if (minRange > 0 && maxRange > 0) {
                      if (totalValue < minRange) {
                        return `❌ Below minimum (${minRange.toFixed(3)})`;
                      } else if (totalValue > maxRange) {
                        return `❌ Above maximum (${maxRange.toFixed(3)})`;
                      } else {
                        return `✓ Within range (${minRange.toFixed(3)} - ${maxRange.toFixed(3)})`;
                      }
                    } else if (minRange > 0) {
                      if (totalValue < minRange) {
                        return `❌ Below minimum (${minRange.toFixed(3)})`;
                      } else {
                        return `✓ Above minimum (${minRange.toFixed(3)})`;
                      }
                    } else if (maxRange > 0) {
                      if (totalValue > maxRange) {
                        return `❌ Above maximum (${maxRange.toFixed(3)})`;
                      } else {
                        return `✓ Below maximum (${maxRange.toFixed(3)})`;
                      }
                    }

                    return `Net Weight/Pc ${totalPerPcsSum > 0 ? '(with kharcha)' : ''}`;
                  })()}
                </div>

                {/* Add warning indicator for out-of-range */}
                {(() => {
                  const totalValue = grandTotal() > 0 ? totalWithKharcha : 0;
                  if ((minRange > 0 && totalValue < minRange) || (maxRange > 0 && totalValue > maxRange)) {
                    return (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: '#DC2626',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        ⚠️
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="summary-card" style={{ borderLeft: '4px solid #9333EA' }}>
                <div className="summary-card-title">
                  <span className="summary-card-icon" style={{ background: '#FAF5FF', color: '#9333EA' }}>📐</span>
                  Standard
                </div>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={standardValue}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty string or valid decimal numbers
                    if (value === '') {
                      setStandardValue(0);
                    } else {
                      const num = parseFloat(value);
                      // Only set if it's a valid number and non-negative
                      if (!isNaN(num) && num >= 0) {
                        setStandardValue(num);
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    // Allow decimal point
                    if (e.key === '.') return;
                    // Allow navigation keys
                    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Backspace', 'Tab', 'Enter'].includes(e.key)) return;
                    // Allow numbers
                    if (!/^\d$/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '26px',
                    fontWeight: '900',
                    color: '#9333EA',
                    outline: 'none',
                    textAlign: 'center',
                    padding: '4px 0',
                    fontFamily: 'inherit'
                  }}
                  aria-label="Standard value for comparison"
                  title="Change standard value (default: 0.20)"
                />
                <div className="summary-card-subtitle">Set tolerance limit for diff</div>
              </div>

              <div className="summary-card" style={{ borderLeft: '4px solid #10B981' }}>
                <div className="summary-card-title">
                  <span className="summary-card-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>⬇️</span>
                  Min Range
                </div>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={minRange}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setMinRange(0);
                    } else {
                      const num = parseFloat(value);
                      if (!isNaN(num)) {
                        setMinRange(num);
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '26px',
                    fontWeight: '900',
                    color: '#10B981',
                    outline: 'none',
                    textAlign: 'center',
                    padding: '4px 0',
                    fontFamily: 'inherit'
                  }}
                  aria-label="Minimum range value"
                  title="Set minimum acceptable value"
                />
                <div className="summary-card-subtitle">Set minimum acceptable value</div>
              </div>

              <div className="summary-card" style={{ borderLeft: '4px solid #F59E0B' }}>
                <div className="summary-card-title">
                  <span className="summary-card-icon" style={{ background: '#FFFBEB', color: '#F59E0B' }}>⬆️</span>
                  Max Range
                </div>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={maxRange}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setMaxRange(0);
                    } else {
                      const num = parseFloat(value);
                      if (!isNaN(num)) {
                        setMaxRange(num);
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '26px',
                    fontWeight: '900',
                    color: '#F59E0B',
                    outline: 'none',
                    textAlign: 'center',
                    padding: '4px 0',
                    fontFamily: 'inherit'
                  }}
                  aria-label="Maximum range value"
                  title="Set maximum acceptable value"
                />
                <div className="summary-card-subtitle">Set maximum acceptable value</div>
              </div>
            </div>
          )}

          {/* Matrix Table */}
          {shades.length || sizes.length ? (
            <>
              <div className="table-container">
                <div className="table-scroll" ref={tableScrollRef} aria-label="Cutting matrix table">
                  <table className="data-table" role="grid" aria-rowcount={shades.length}>
                    <thead>
                      <tr>
                        <th>Color</th>
                        <th>Cutting Table</th>
                        {sizes.map((sz) => (
                          <th key={`h-${sz}`}>{sz}</th>
                        ))}
                        <th>Total Pcs</th>
                        <th>Rolls</th>
                        <th>Kgs(MTR)</th>
                        <th>Kapda Layer WT</th>
                        <th>Layer Pcs</th>
                        <th>Layer Inch</th>
                        <th>DIA</th>
                        <th>Cutting Weight</th>
                        <th>Kapda Wapsi</th>
                        <th>Plan Weight/pcs</th>
                        <th>Net weight</th>
                        <th>Actual weight/pcs</th>
                        <th>Diff</th>
                      </tr>
                    </thead>

                    <tbody>
                      {useVirtual && startIdx > 0 && (
                        <tr style={{ height: (startIdx) * ROW_HEIGHT }} aria-hidden="true">
                          <td colSpan={sizes.length + 18} />
                        </tr>
                      )}

                      {(useVirtual ? shades.slice(startIdx, endIdx) : shades).map((shade, idx) => {
                        const actualIndex = useVirtual ? startIdx + idx : idx;

                        // Calculate plan weight per pcs automatically
                        const layerWT = parseDecimal(kapdaLayerWT[shade] || 0);
                        const layerPcsVal = parseDecimal(layerPcs[shade] || 0);
                        const autoCalculatedPlanWeight = layerPcsVal > 0 ? (layerWT / layerPcsVal).toFixed(3) : "";

                        // Calculate net weight automatically (Kgs - Kapda Wapsi)
                        const kgsVal = parseDecimal(kgs[shade] || 0);
                        const kapdaWapsiVal = parseDecimal(kapdaWapsi[shade] || 0);
                        const autoCalculatedNetWeight = (kgsVal - kapdaWapsiVal).toFixed(3);

                        // Calculate actual weight per pcs automatically (Net Weight / Total Pcs)
                        const totalPcs = rowTotal(shade);
                        const autoCalculatedActualWeightPerPcs = totalPcs > 0 ?
                          (parseDecimal(autoCalculatedNetWeight) / totalPcs).toFixed(3) : "";

                        // Calculate diff automatically (Actual Weight Per Pcs - Plan Weight Per Pcs)
                        const autoCalculatedDiff = () => {
                          const actualWeight = parseDecimal(autoCalculatedActualWeightPerPcs || 0);
                          const planWeight = parseDecimal(autoCalculatedPlanWeight || 0);

                          // Only calculate if we have valid numbers
                          if (isNaN(actualWeight) || isNaN(planWeight)) return "";

                          const diff = actualWeight - planWeight;
                          return diff.toFixed(3);
                        };

                        return (
                          <tr key={`r-${shade}-${actualIndex}`} style={{ height: ROW_HEIGHT }}>
                            <td className="shade-cell">{shade}</td>

                            {/* Cutting Table */}
                            <td>
                              <input
                                className="cell-input cutting-input matrix-input"
                                defaultValue={cutting[shade] ?? ""}
                                onChange={(e) => setCut(shade, e.target.value)}
                                onKeyDown={handleEnterNav}
                                placeholder="—"
                                aria-label={`Cutting table for ${shade}`}
                                disabled={isAdmin || meta.checkedBySahilSir === "yes"}
                              />
                            </td>

                            {/* Size columns */}
                            {sizes.map((sz) => {
                              const k = `${shade}|${sz}`;
                              return (
                                <td key={`c-${shade}-${sz}`}>
                                  <input
                                    className="cell-input matrix-input"
                                    inputMode="decimal"
                                    defaultValue={cells[k] ?? ""}
                                    onChange={(e) => setCell(shade, sz, e.target.value)}
                                    onKeyDown={handleEnterNav}
                                    aria-label={`Qty ${shade} ${sz}`}
                                    disabled={isAdmin || meta.checkedBySahilSir === "yes"}
                                  />
                                </td>
                              );
                            })}

                            {/* Total Pcs */}
                            <td className="total-cell" aria-label={`Row total for ${shade}`}>
                              {rowTotal(shade)}
                            </td>

                            {/* Rolls */}
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <input
                                  id={`rolls-${shade}`}
                                  className="rolls-input matrix-input"
                                  defaultValue={rolls[shade] ?? ""}
                                  onChange={(e) => setRoll(shade, e.target.value)}
                                  onKeyDown={handleEnterNav}
                                  placeholder="—"
                                  aria-label={`Rolls for ${shade}`}
                                  disabled={isAdmin || meta.checkedBySahilSir === "yes"}
                                />
                              </div>
                            </td>

                            {/* Kgs(MTR) */}
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <input
                                  id={`kgs-${shade}`}
                                  className="kgs-input matrix-input"
                                  defaultValue={kgs[shade] ?? ""}
                                  onChange={(e) => setKg(shade, e.target.value)}
                                  onKeyDown={handleEnterNav}
                                  placeholder="—"
                                  aria-label={`Kgs(MTR) for ${shade}`}
                                  disabled={isAdmin || meta.checkedBySahilSir === "yes"}
                                />
                              </div>
                            </td>

                            {/* Kapda Layer WT */}
                            <td>
                              <input
                                className="kapda-input matrix-input"
                                defaultValue={kapdaLayerWT[shade] ?? ""}
                                onChange={(e) => setKapdaLayerWTVal(shade, e.target.value)}
                                onKeyDown={handleEnterNav}
                                placeholder="—"
                                aria-label={`Kapda Layer WT for ${shade}`}
                                disabled={isAdmin || meta.checkedBySahilSir === "yes"}
                              />
                            </td>

                            {/* Layer Pcs */}
                            <td>
                              <input
                                className="layer-input matrix-input"
                                defaultValue={layerPcs[shade] ?? ""}
                                onChange={(e) => setLayerPc(shade, e.target.value)}
                                onKeyDown={handleEnterNav}
                                placeholder="—"
                                aria-label={`Layer Pcs for ${shade}`}
                                disabled={isAdmin || meta.checkedBySahilSir === "yes"}
                              />
                            </td>

                            {/* Layer Inch */}
                            <td>
                              <input
                                className="layer-input matrix-input"
                                defaultValue={layerInch[shade] ?? ""}
                                onChange={(e) => setLayerInchVal(shade, e.target.value)}
                                onKeyDown={handleEnterNav}
                                placeholder="—"
                                aria-label={`Layer Inch for ${shade}`}
                                disabled={isAdmin || meta.checkedBySahilSir === "yes"}
                              />
                            </td>

                            {/* DIA */}
                            <td>
                              <input
                                className="dia-input matrix-input"
                                defaultValue={dia[shade] ?? ""}
                                onChange={(e) => setDiaVal(shade, e.target.value)}
                                onKeyDown={handleEnterNav}
                                placeholder="—"
                                aria-label={`DIA for ${shade}`}
                                disabled={isAdmin || meta.checkedBySahilSir === "yes"}
                              />
                            </td>

                            {/* Cutting Weight */}
                            <td>
                              <input
                                className="weight-input matrix-input"
                                defaultValue={cuttingWeight[shade] ?? ""}
                                onChange={(e) => setCuttingWeightVal(shade, e.target.value)}
                                onKeyDown={handleEnterNav}
                                placeholder="—"
                                aria-label={`Cutting Weight for ${shade}`}
                                disabled={isAdmin || meta.checkedBySahilSir === "yes"}
                              />
                            </td>

                            {/* Kapda Wapsi */}
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <input
                                  id={`wapsi-${shade}`}
                                  className="wapsi-input matrix-input"
                                  defaultValue={kapdaWapsi[shade] ?? ""}
                                  onChange={(e) => setKapdaWapsiVal(shade, e.target.value)}
                                  onKeyDown={handleEnterNav}
                                  placeholder="—"
                                  aria-label={`Kapda Wapsi for ${shade}`}
                                  disabled={isAdmin || meta.checkedBySahilSir === "yes"}
                                />
                                {/* {dbReturnedWeightByShade[shade.trim().toLowerCase()] !== undefined && dbReturnedWeightByShade[shade.trim().toLowerCase()] > 0 && (
                                  <div
                                    className="db-badge db-badge-weight"
                                    style={{ background: '#FEF2F2', color: '#991B1B', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                    onClick={() => {
                                      const retVal = dbReturnedWeightByShade[shade.trim().toLowerCase()];
                                      setKapdaWapsi((p) => ({ ...p, [shade]: String(retVal.toFixed(3)) }));
                                      const wapsiInput = document.getElementById(`wapsi-${shade}`);
                                      if (wapsiInput) wapsiInput.value = String(retVal.toFixed(3));
                                      setTimeout(() => updateCalculatedFields(shade), 50);
                                    }}
                                    title="Click to apply database returned weight"
                                  >
                                    ↩️ DB: {dbReturnedWeightByShade[shade.trim().toLowerCase()].toFixed(2)} KG
                                  </div>
                                )} */}
                              </div>
                            </td>

                            {/* Plan Weight per pcs (Auto-calculated) */}
                            <td>
                              <input
                                className="proposed-weight-input matrix-input"
                                value={autoCalculatedPlanWeight || ""}
                                readOnly
                                title={`Auto-calculated: ${layerWT || 0} ÷ ${layerPcsVal || 0} = ${autoCalculatedPlanWeight || 'N/A'}`}
                                aria-label={`Auto-calculated Plan Weight per pcs for ${shade}: ${autoCalculatedPlanWeight || 'N/A'}`}
                              />
                            </td>

                            {/* Net weight (Auto-calculated: Kgs(MTR) - Kapda Wapsi) */}
                            <td>
                              <input
                                className="net-weight-input matrix-input"
                                value={autoCalculatedNetWeight || ""}
                                readOnly
                                title={`Auto-calculated: ${kgsVal || 0} - ${kapdaWapsiVal || 0} = ${autoCalculatedNetWeight || 'N/A'}`}
                                aria-label={`Auto-calculated Net weight for ${shade}: ${autoCalculatedNetWeight || 'N/A'}`}
                              />
                            </td>

                            {/* Actual weight per pcs (Auto-calculated: Net Weight / Total Pcs) */}
                            <td>
                              <input
                                className="actual-weight-input matrix-input"
                                value={autoCalculatedActualWeightPerPcs || ""}
                                readOnly
                                title={`Auto-calculated: ${autoCalculatedNetWeight || 0} ÷ ${totalPcs} = ${autoCalculatedActualWeightPerPcs || 'N/A'}`}
                                aria-label={`Auto-calculated Actual weight per pcs for ${shade}: ${autoCalculatedActualWeightPerPcs || 'N/A'}`}
                              />
                            </td>

                            {/* Diff (Auto-calculated: Actual Weight Per Pcs - Plan Weight Per Pcs) */}

                            <td>
                              <input
                                className={`diff-input matrix-input ${(() => {
                                  const diffValue = autoCalculatedDiff(); // Call the function
                                  if (!diffValue) return 'diff-empty';
                                  const diffNum = parseFloat(diffValue);
                                  if (isNaN(diffNum)) return 'diff-empty';

                                  // Compare absolute difference with standard value
                                  const absDiff = Math.abs(diffNum);

                                  // If difference exceeds standard, show red
                                  if (absDiff > standardValue) return 'diff-exceeds-standard';

                                  // If difference is positive but within standard
                                  if (diffNum > 0) return 'diff-positive';

                                  // If difference is negative but within standard
                                  if (diffNum < 0) return 'diff-negative';

                                  // If difference is zero
                                  return 'diff-zero';
                                })()}`}
                                value={autoCalculatedDiff() || ""} // Call the function here too
                                readOnly
                                title={`Auto-calculated: ${autoCalculatedActualWeightPerPcs || 0} - ${autoCalculatedPlanWeight || 0} = ${autoCalculatedDiff() || 'N/A'} (Standard: ±${standardValue})`}
                                aria-label={`Auto-calculated Diff for ${shade}: ${autoCalculatedDiff() || 'N/A'}. Standard tolerance: ±${standardValue}`}
                              />
                            </td>
                          </tr>
                        );
                      })}

                      {useVirtual && endIdx < totalDataRows && (
                        <tr style={{ height: (totalDataRows - endIdx) * ROW_HEIGHT }} aria-hidden="true">
                          <td colSpan={sizes.length + 18} />
                        </tr>
                      )}

                      {(!useVirtual || endIdx >= totalDataRows) && (
                        <tr className="footer-row">
                          <td>📊 Total</td>
                          <td></td>
                          {sizes.map((sz) => (
                            <td key={`tot-${sz}`}>
                              {colTotal(sz)}
                            </td>
                          ))}
                          <td>{grandTotal()}</td>
                          <td>
                            {shades.reduce((a, sh) => a + parseDecimal(rolls[sh] || 0), 0).toFixed(3)}
                          </td>
                          <td>{totalKgsMtr.toFixed(3)}</td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td>
                            {shades.reduce((a, sh) => a + parseDecimal(kapdaWapsi[sh] || 0), 0).toFixed(3)}
                          </td>
                          <td></td>
                          <td>{totalNetWeight.toFixed(3)}</td>
                          <td></td>
                          <td></td>

                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Combined Remarks Section */}
              <div className="remarks-section">
                <div className="remarks-header">
                  <div className="remarks-title">
                    <span>📝 Remarks / Notes</span>
                  </div>
                </div>

                <textarea
                  className="remarks-textarea"
                  value={remarks}
                  onChange={handleRemarksChange}
                  placeholder="Add any general remarks, notes, or observations about this lot..."
                  aria-label="Combined remarks for the lot"
                  rows={4}
                  disabled={isAdmin || meta.checkedBySahilSir === "yes"}
                />

                <div className="remarks-char-count">
                  {remarks.length} characters
                </div>
              </div>

              {/* Kharcha Section */}
              <div className="kharcha-section">
                <div className="kharcha-header">
                  <div className="kharcha-title">
                    <span>💰 Kharcha Details</span>
                  </div>
                  <button
                    onClick={openAddKharcha}
                    className="btn"
                    disabled={isAdmin || saving || loading || exporting || meta.checkedBySahilSir === "yes"}
                    title={isAdmin ? "Disabled in Admin mode" : (meta.checkedBySahilSir === "yes" ? "Disabled because Parta is locked" : "Add kharcha entry")}
                  >
                    ➕ Add Kharcha
                  </button>
                </div>

                {kharchaEntries.length > 0 ? (
                  <>
                    <div className="kharcha-summary">
                      <div className="kharcha-summary-item">
                        Total Entries: <span className="kharcha-summary-value">{kharchaEntries.length}</span>
                      </div>
                      <div className="kharcha-summary-item">
                        Included: <span className="kharcha-included-count">
                          {kharchaEntries.filter(e => e.includeInTotal).length}
                        </span>
                      </div>
                      <div className="kharcha-summary-item">
                        Excluded: <span className="kharcha-excluded-count">
                          {kharchaEntries.filter(e => !e.includeInTotal).length}
                        </span>
                      </div>
                      <div className="kharcha-summary-item">
                        Total Kgs: <span className="kharcha-summary-value">{totalKharchaKgs.toFixed(3)}</span>
                      </div>
                      <div className="kharcha-summary-item">
                        Total Pcs: <span className="kharcha-summary-value">{totalKharchaPcs.toFixed(3)}</span>
                      </div>
                      <div className="kharcha-summary-item">
                        Per Pcs Sum: <span className="kharcha-summary-value">{totalPerPcsSum.toFixed(3)}</span>
                      </div>
                    </div>

                    <div className="table-scroll" style={{ marginTop: '16px', maxHeight: '400px' }}>
                      <table className="kharcha-table">
                        <thead>
                          <tr>
                            <th style={{ width: '20%' }}>Type</th>
                            <th style={{ width: '30%' }}>Description</th>
                            <th style={{ width: '15%', textAlign: 'center' }}>Kgs</th>
                            <th style={{ width: '15%', textAlign: 'center' }}>Pcs</th>
                            <th style={{ width: '15%', textAlign: 'center' }}>Per Pcs</th>
                            <th style={{ width: '15%', textAlign: 'center' }}>Include</th>
                            <th style={{ width: '15%', textAlign: 'center' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {kharchaEntries.map((entry) => (
                            <tr key={entry.id}>
                              <td style={{ fontWeight: '600' }}>{entry.type}</td>
                              <td>{entry.description || "—"}</td>
                              <td style={{ textAlign: "center" }}>{entry.kgs}</td>
                              <td style={{ textAlign: "center" }}>{entry.pcs}</td>
                              <td style={{ textAlign: "center" }}>{entry.perPcs || "—"}</td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  onClick={() => toggleKharchaInclusion(entry.id)}
                                  className={entry.includeInTotal ? "kharcha-toggle-btn active" : "kharcha-toggle-btn"}
                                  title={isAdmin ? "Disabled in Admin mode" : (entry.includeInTotal ? "Included in total" : "Excluded from total")}
                                  aria-label={entry.includeInTotal ? "Included in total calculations" : "Excluded from total calculations"}
                                  disabled={isAdmin || meta.checkedBySahilSir === "yes"}
                                >
                                  {entry.includeInTotal ? "✅" : "❌"}
                                </button>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  onClick={() => removeKharchaEntry(entry.id)}
                                  className="kharcha-remove-btn"
                                  title={isAdmin ? "Disabled in Admin mode" : (meta.checkedBySahilSir === "yes" ? "Disabled because Parta is locked" : "Remove entry")}
                                  disabled={isAdmin || meta.checkedBySahilSir === "yes"}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="kharcha-total-row">
                            <td colSpan="2" style={{ textAlign: "right", fontWeight: "800", paddingRight: '16px' }}>
                              Total (Included Only):
                            </td>
                            <td style={{ textAlign: "center", fontWeight: "800" }}>
                              {kharchaEntries
                                .filter(entry => entry.includeInTotal)
                                .reduce((total, entry) => total + parseDecimal(entry.kgs || 0), 0).toFixed(3)}
                            </td>
                            <td style={{ textAlign: "center", fontWeight: "800" }}>
                              {kharchaEntries
                                .filter(entry => entry.includeInTotal)
                                .reduce((total, entry) => total + parseDecimal(entry.pcs || 0), 0).toFixed(3)}
                            </td>
                            <td style={{ textAlign: "center", fontWeight: "800" }}>
                              {totalPerPcsSum.toFixed(3)}
                            </td>
                            <td colSpan="2" style={{ textAlign: "center", fontWeight: "800", color: '#16A34A' }}>
                              {kharchaEntries.filter(e => e.includeInTotal).length} included
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="kharcha-empty">
                    <div style={{ fontSize: '48px', marginBottom: '16px', opacity: '0.5' }}>💰</div>
                    <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '8px' }}>No kharcha entries</div>
                    <div style={{ color: '#64748B', marginBottom: '20px' }}>Click "Add Kharcha" to add expenses, wastage, or other costs</div>
                  </div>
                )}
              </div>

              {meta.checkedBySahilSir === "yes" && (
                <div style={{
                  marginTop: '24px',
                  background: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)',
                  border: '2px solid #10B981',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.1)',
                  animation: 'slideUp 0.3s ease-out',
                  marginBottom: '16px'
                }}>
                  <span style={{ fontSize: '24px', color: '#065F46', fontWeight: 'bold' }}>✔</span>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#065F46' }}>Checked By Sahil Sir</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#047857', marginTop: '2px' }}>
                      This Parta has been confirmed and locked.
                    </div>
                  </div>
                </div>
              )}

              {/* Sticky action bar */}
              <div className="action-bar" role="region" aria-label="Actions">
                <div className="totals">
                  <span className="pill">Total Pcs: {grandTotal()}</span>
                  <span className="pill">Colors: {shades.length}</span>
                  <span className="pill">Sizes: {sizes.length}</span>
                  <span className="pill">Total Kgs(MTR): {totalKgsMtr.toFixed(3)}</span>
                  <span className="pill">Total Net Weight: {totalNetWeight.toFixed(3)}</span>
                  <span className="pill">Total Cutting Weight: {totalCuttingWeight.toFixed(3)}</span>
                  <span className="pill">Kharcha Kgs: {totalKharchaKgs.toFixed(3)}</span>
                  <span className="pill">Total: {grandTotal() > 0 ? totalWithKharcha.toFixed(3) : "0.000"}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={openAddShade}
                    className="btn"
                    disabled={isAdmin || saving || loading || exporting || meta.checkedBySahilSir === "yes"}
                    title={isAdmin ? "Disabled in Admin mode" : (meta.checkedBySahilSir === "yes" ? "Disabled because Parta is locked" : "Add a manual shade row")}
                  >
                    ➕ Add Shade
                  </button>

                  <button
                    id="normalSaveBtn"
                    onClick={() => handleSave({ isNormalSave: true })}
                    className="btn"
                    style={{
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#FFFFFF',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
                      e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.35)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
                      e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.25)';
                    }}
                    disabled={isAdmin || saving || !meta.lotNumber || !sizes.length || !shades.length || (isInitiallyLocked && meta.checkedBySahilSir === "yes")}
                    title={isAdmin ? "Disabled in Admin mode" : ((isInitiallyLocked && meta.checkedBySahilSir === "yes") ? "Disabled because Parta is locked" : (!meta.lotNumber ? "Search a lot first" : ""))}
                  >
                    {saving ? <div className="ring" /> : "💾 Normal Save"}
                  </button>

                  <button
                    id="saveBtn"
                    onClick={() => handleSave()}
                    className="btn btn-primary"
                    disabled={isAdmin || saving || !meta.lotNumber || !sizes.length || !shades.length || (isInitiallyLocked && meta.checkedBySahilSir === "yes")}
                    title={isAdmin ? "Disabled in Admin mode" : ((isInitiallyLocked && meta.checkedBySahilSir === "yes") ? "Disabled because Parta is locked" : (!meta.lotNumber ? "Search a lot first" : ""))}
                    aria-busy={saving}
                  >
                    {saving ? <div className="ring" /> : "💾 Save"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-text" style={{ fontWeight: 800, fontSize: 18 }}>
                No data to display
              </div>
              <div className="empty-subtext" style={{ color: "#64748B" }}>
                Search a Lot Number to load the cutting matrix
              </div>
            </div>
          )}
        </div>
      </div>
      {loadingJobOrders && (
        <div style={{ textAlign: "center", padding: "8px", color: "#64748B", fontSize: "12px" }}>
          Loading dropdown values...
        </div>
      )}

      {showRangeDialog && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="rangeDialogTitle">
          <form
            className="dialog-card"
            onSubmit={handleSaveRange}
            style={{
              width: "min(95vw, 900px)",
              maxHeight: "85vh", // Add max height
              overflowY: "auto", // Enable vertical scrolling
              padding: "24px", // Slightly more padding
            }}
          >
            <div className="dialog-title" id="rangeDialogTitle" style={{ marginBottom: "20px" }}>
              Define Measurement Range
            </div>

            {/* Add a wrapper div for the content */}
            <div style={{
              display: "grid",
              gap: 16,
              minHeight: "min-content"
            }}>
              {/* All your existing content goes here */}
              {loadingJobOrders && (
                <div style={{ textAlign: "center", padding: "8px", color: "#64748B", fontSize: "12px" }}>
                  <div className="ring" style={{ margin: "0 auto 8px", width: "20px", height: "20px" }}></div>
                  Loading job order data...
                </div>
              )}

              <div style={{ display: "grid", gap: 12 }}>
                {/* Type Selection */}
                <div>
                  <label style={{ fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                    Type *
                  </label>
                  <div style={{ display: "flex", gap: 12 }}>
                    {["M", "W", "K"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setRangeData(prev => ({ ...prev, type }))}
                        style={{
                          flex: 1,
                          padding: "10px",
                          border: `2px solid ${rangeData.type === type ? "#2563EB" : "#E2E8F0"}`,
                          borderRadius: "8px",
                          background: rangeData.type === type ? "#EFF6FF" : "#FFFFFF",
                          color: rangeData.type === type ? "#2563EB" : "#64748B",
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.2s ease"
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add the rest of your form fields here exactly as they were */}
                {/* Item Dropdown */}
                <div>
                  <label htmlFor="itemDropdown" style={{ fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                    Garment Type / Item *
                  </label>
                  <select
                    id="itemDropdown"
                    className="search-input"
                    value={rangeData.item}
                    onChange={(e) => setRangeData(prev => ({ ...prev, item: e.target.value }))}
                    required
                    style={{ appearance: "auto", paddingRight: "32px", width: "100%" }}
                    disabled={loadingJobOrders}
                  >
                    <option value="">Select Garment Type</option>
                    {dropdownValues.items.map((item, index) => (
                      <option key={index} value={item}>{item}</option>
                    ))}
                  </select>
                </div>

                {/* Style Dropdown */}
                <div>
                  <label htmlFor="styleDropdown" style={{ fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                    Style *
                  </label>
                  <select
                    id="styleDropdown"
                    className="search-input"
                    value={rangeData.style}
                    onChange={(e) => setRangeData(prev => ({ ...prev, style: e.target.value }))}
                    required
                    style={{ appearance: "auto", paddingRight: "32px", width: "100%" }}
                    disabled={loadingJobOrders}
                  >
                    <option value="">Select Style</option>
                    {dropdownValues.styles.map((style, index) => (
                      <option key={index} value={style}>{style}</option>
                    ))}
                  </select>
                </div>

                {/* Fabric Dropdown */}
                <div>
                  <label htmlFor="fabricDropdown" style={{ fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                    Fabric *
                  </label>
                  <select
                    id="fabricDropdown"
                    className="search-input"
                    value={rangeData.fabric}
                    onChange={(e) => setRangeData(prev => ({ ...prev, fabric: e.target.value }))}
                    required
                    style={{ appearance: "auto", paddingRight: "32px", width: "100%" }}
                    disabled={loadingJobOrders}
                  >
                    <option value="">Select Fabric</option>
                    {dropdownValues.fabrics.map((fabric, index) => (
                      <option key={index} value={fabric}>{fabric}</option>
                    ))}
                  </select>
                </div>

                {/* Auto-generated Collar Display */}
                <div>
                  <label style={{ fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                    Auto-generated Collar
                  </label>
                  <div style={{
                    padding: "12px",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    background: "#F8FAFC",
                    color: "#334155",
                    fontWeight: 600,
                    minHeight: "44px",
                    width: "100%"
                  }}>
                    {rangeData.collar || "Select garment type, style, and fabric above"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748B", marginTop: "4px" }}>
                    Format: Type-GarmentType_STYLE_FABRIC
                  </div>
                </div>

                {/* Range Inputs */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label htmlFor="minRangeInput" style={{ fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                      Minimum Range *
                    </label>
                    <input
                      id="minRangeInput"
                      className="search-input"
                      type="number"
                      step="0.001"
                      min="0"
                      value={rangeData.minRange}
                      onChange={(e) => setRangeData(prev => ({ ...prev, minRange: e.target.value }))}
                      placeholder="0.000"
                      required
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <label htmlFor="maxRangeInput" style={{ fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                      Maximum Range *
                    </label>
                    <input
                      id="maxRangeInput"
                      className="search-input"
                      type="number"
                      step="0.001"
                      min="0"
                      value={rangeData.maxRange}
                      onChange={(e) => setRangeData(prev => ({ ...prev, maxRange: e.target.value }))}
                      placeholder="0.000"
                      required
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                {/* Existing Ranges Section */}
                <div style={{ marginTop: '16px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <div>
                      <label style={{ fontWeight: 700, color: "#334155" }}>
                        {showAllRangesMode ? 'All Ranges in Sheet' : 'Existing Ranges'}
                      </label>
                      {existingRanges.length > 0 && (
                        <span style={{ fontSize: "12px", color: "#64748B", marginLeft: "8px" }}>
                          ({existingRanges.length} found)
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={async () => {
                          if (showAllRangesMode) {
                            setShowAllRangesMode(false);
                            await fetchExistingRanges(false);
                          } else {
                            setShowAllRangesMode(true);
                            const allRanges = await fetchAllRanges();
                            setExistingRanges(allRanges);
                          }
                        }}
                        style={{
                          background: showAllRangesMode ? '#FEF3C7' : '#E0F2FE',
                          border: showAllRangesMode ? '1px solid #FBBF24' : '1px solid #38BDF8',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: showAllRangesMode ? '#92400E' : '#0369A1',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title={showAllRangesMode ? 'Show filtered ranges only' : 'Show all ranges'}
                      >
                        {showAllRangesMode ? '🔍 Filtered View' : '👁️ All Ranges'}
                      </button>

                      <button
                        type="button"
                        onClick={() => fetchExistingRanges(showAllRangesMode)}
                        style={{
                          background: '#ECFDF5',
                          border: '1px solid #A7F3D0',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#059669',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Refresh ranges list"
                      >
                        🔄 Refresh
                      </button>
                    </div>
                  </div>

                  {/* Ranges list container */}
                  <div style={{
                    maxHeight: "250px",
                    overflowY: "auto",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    padding: "8px",
                    background: "#F8FAFC",
                    minHeight: "100px"
                  }}>
                    {existingRanges.length > 0 ? (
                      existingRanges.map((range, index) => (
                        <div
                          key={range.id || index}
                          onClick={() => {
                            setSelectedExistingRange(range.id);
                            setRangeData(prev => ({
                              ...prev,
                              type: range.type || "M",
                              item: range.item || "",
                              style: range.style || "",
                              fabric: range.fabric || "",
                              collar: range.collar || "",
                              minRange: range.minRange || "",
                              maxRange: range.maxRange || ""
                            }));

                            if (showAllRangesMode) {
                              setShowAllRangesMode(false);
                            }
                          }}
                          style={{
                            padding: "10px",
                            borderBottom: index < existingRanges.length - 1 ? "1px solid #F1F5F9" : "none",
                            fontSize: "12px",
                            cursor: "pointer",
                            background: selectedExistingRange === range.id ? "#EFF6FF" :
                              (range.type === "M" ? "#F0F9FF" :
                                range.type === "W" ? "#FDF4FF" : "#F0FDF4"),
                            borderRadius: "6px",
                            marginBottom: index < existingRanges.length - 1 ? "6px" : "0",
                            border: selectedExistingRange === range.id ? "2px solid #2563EB" : "1px solid transparent",
                            transition: "all 0.2s ease"
                          }}
                          title={`Click to load: ${range.minRange} - ${range.maxRange}`}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                <span style={{
                                  fontWeight: 800,
                                  color: "#7C3AED",
                                  fontSize: "11px",
                                  background: "#F3E8FF",
                                  padding: "2px 6px",
                                  borderRadius: "4px"
                                }}>
                                  {range.type || "M"}
                                </span>
                                <span style={{ fontWeight: 700, color: "#334155" }}>{range.item || "—"}</span>
                              </div>
                              <div style={{ fontSize: "11px", color: "#64748B", marginBottom: "2px" }}>
                                Style: {range.style || "—"} • Fabric: {range.fabric || "—"}
                              </div>
                              <div style={{ fontSize: "10px", color: "#94A3B8", fontFamily: "monospace" }}>
                                {range.collar || "No collar"}
                              </div>
                            </div>

                            <div style={{ textAlign: "right" }}>
                              <div style={{
                                fontWeight: 900,
                                fontSize: "14px",
                                background: "linear-gradient(135deg, #059669, #10B981)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                backgroundClip: "text"
                              }}>
                                {parseFloat(range.minRange || 0).toFixed(3)}
                              </div>
                              <div style={{ fontSize: "10px", color: "#64748B", margin: "2px 0" }}>to</div>
                              <div style={{
                                fontWeight: 900,
                                fontSize: "14px",
                                background: "linear-gradient(135deg, #DC2626, #EF4444)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                backgroundClip: "text"
                              }}>
                                {parseFloat(range.maxRange || 0).toFixed(3)}
                              </div>
                            </div>
                          </div>

                          {range.timestamp && (
                            <div style={{
                              fontSize: "9px",
                              color: "#CBD5E1",
                              marginTop: "6px",
                              textAlign: "right"
                            }}>
                              {new Date(range.timestamp).toLocaleDateString()} •
                              {new Date(range.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div style={{
                        padding: "40px 20px",
                        textAlign: "center",
                        color: "#64748B",
                        fontSize: "14px"
                      }}>
                        <div style={{ fontSize: "32px", marginBottom: "12px", opacity: "0.5" }}>📊</div>
                        <div style={{ fontWeight: 700, marginBottom: "8px" }}>
                          {showAllRangesMode ? "No ranges found in sheet" : "No matching ranges found"}
                        </div>
                        <div style={{ fontSize: "12px" }}>
                          {showAllRangesMode
                            ? "Save your first range to get started"
                            : "Try changing filters or view all ranges"}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Add Create New Range button */}
              {selectedExistingRange && (
                <div style={{ marginTop: '12px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedExistingRange(null);
                      setRangeData(prev => ({
                        ...prev,
                        minRange: "",
                        maxRange: ""
                      }));
                      setNotice({ type: "info", text: "Creating new range - cleared selection" });
                      setTimeout(() => setNotice(null), 2000);
                    }}
                    style={{
                      background: '#FEF3C7',
                      border: '1px solid #FBBF24',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: '700',
                      color: '#92400E',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Clear selection to create new range"
                  >
                    ✨ Create New Range
                  </button>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                    Currently editing: <strong>{selectedExistingRange ? 'Existing Range' : 'New Range'}</strong>
                  </div>
                </div>
              )}

              {/* Dialog Actions */}
              <div className="dialog-actions" style={{ marginTop: "20px", position: "sticky", bottom: 0, background: "white", paddingTop: "12px" }}>
                <button type="button" className="btn" onClick={handleCloseRangeDialog} disabled={savingRange}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingRange || loadingJobOrders}>
                  {savingRange ? (
                    <>
                      <div className="ring" style={{ width: '16px', height: '16px', marginRight: '8px' }}></div>
                      Saving...
                    </>
                  ) : selectedExistingRange ? (
                    <>
                      ✏️ Update Range
                    </>
                  ) : (
                    '💾 Save New Range'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      {/* Add Shade Dialog */}
      {showShadeDialog && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="addShadeTitle">
          <form className="dialog-card" onSubmit={confirmAddShade}>
            <div className="dialog-title" id="addShadeTitle">Add Shade</div>
            <div style={{ display: "grid", gap: 8 }}>
              <label htmlFor="shadeNameInput" style={{ fontWeight: 700, color: "#334155" }}>Shade name</label>
              <input
                id="shadeNameInput"
                className="search-input"
                type="text"
                value={newShade}
                onChange={(e) => setNewShade(e.target.value)}
                placeholder="e.g., NAVY, RED 32, 011"
                aria-required="true"
              />
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={closeAddShade}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add</button>
            </div>
          </form>
        </div>
      )}

      {showKharchaDialog && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="addKharchaTitle">
          <form className="dialog-card" onSubmit={confirmAddKharcha}>
            <div className="dialog-title" id="addKharchaTitle">Add Kharcha Entry</div>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label htmlFor="kharchaTypeInput" style={{ fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                  Kharcha Type *
                </label>
                <input
                  id="kharchaTypeInput"
                  className="search-input"
                  type="text"
                  value={newKharchaEntry.type}
                  onChange={(e) => setNewKharchaEntry(prev => ({ ...prev, type: e.target.value }))}
                  placeholder="e.g., Wastage, Sample, Rejection"
                  aria-required="true"
                />
              </div>

              <div>
                <label htmlFor="kharchaDescriptionInput" style={{ fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                  Description
                </label>
                <input
                  id="kharchaDescriptionInput"
                  className="search-input"
                  type="text"
                  value={newKharchaEntry.description}
                  onChange={(e) => setNewKharchaEntry(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label htmlFor="kharchaKgsInput" style={{ fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                    Kgs *
                  </label>
                  <input
                    id="kharchaKgsInput"
                    className="search-input"
                    type="number"
                    step="0.001"
                    value={newKharchaEntry.kgs}
                    onChange={(e) => setNewKharchaEntry(prev => ({ ...prev, kgs: e.target.value }))}
                    placeholder="0.000"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="kharchaPcsInput" style={{ fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>
                    Pcs *
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="kharchaPcsInput"
                      className="search-input"
                      type="number"
                      step="1"
                      value={newKharchaEntry.pcs}
                      onChange={(e) => setNewKharchaEntry(prev => ({ ...prev, pcs: e.target.value }))}
                      placeholder="0"
                      required
                      style={{ paddingRight: "100px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setNewKharchaEntry(prev => ({ ...prev, pcs: grandTotal().toString() }))}
                      style={{
                        position: "absolute",
                        right: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "#F1F5F9",
                        border: "1px solid #CBD5E1",
                        borderRadius: "6px",
                        padding: "4px 8px",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#334155",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                      }}
                      title="Use total pieces from cutting matrix"
                    >
                      Use Total ({grandTotal()})
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 8 }}>
                <div style={{ fontWeight: 700, color: "#334155", marginBottom: 4 }}>Per Pcs (Auto-calculated)</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#7C3AED" }}>
                  {newKharchaEntry.pcs && parseDecimal(newKharchaEntry.pcs) > 0
                    ? (parseDecimal(newKharchaEntry.kgs) / parseDecimal(newKharchaEntry.pcs)).toFixed(3)
                    : "Enter Kgs & Pcs to calculate"}
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
                  Formula: Kgs ÷ Pcs = Per Pcs
                </div>
              </div>

              <div style={{ fontSize: 12, color: "#64748B", padding: "8px 12px", background: "#FEF3C7", borderRadius: "8px" }}>
                <strong>Note:</strong>
                <ul style={{ margin: "4px 0 0 0", paddingLeft: "16px" }}>
                  <li>Pcs field is auto-filled with total pieces from cutting matrix</li>
                  <li>Click "Use Total" to reset to cutting matrix total</li>
                  <li>You can edit the Pcs value if different</li>
                  <li>New entries are excluded from totals by default</li>
                </ul>
              </div>
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={closeAddKharcha}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add Entry</button>
            </div>
          </form>
        </div>
      )}

      {/* Floating toast */}
      {notice && (
        <div
          className={`notice ${notice.type === "error" ? "error" : ""}`}
          style={{ position: "fixed", top: 16, right: 16, zIndex: 70 }}
          role="status"
          aria-live="polite"
        >
          <span>{notice.type === "success" ? "✅" : "⚠️"}</span>
          <span>{notice.text}</span>
        </div>
      )}

      {/* Loading overlays */}
      {(loading || saving || exporting) && (
        <div className="loading-overlay" role="alert" aria-live="polite" aria-busy="true">
          <div className="loading-card">
            <div className="ring"></div>
            <div style={{ fontWeight: 900 }}>
              {saving ? "Saving matrix..." : exporting ? "Preparing Excel..." : "Searching lot..."}
            </div>
            <div style={{ color: "#475569", fontWeight: 700 }}>
              {saving ? "Uploading to Google Sheets" : exporting ? "Finalizing workbook" : "Fetching from Google Sheets"}
            </div>
            <div className="progress"></div>
          </div>
        </div>
      )}
    </div>
  );
}