import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Printer, RotateCcw, Package, Calendar, User, Info, ArrowLeft } from 'lucide-react';

export default function FabricReceivingHistoryPage() {
  const navigate = useNavigate();
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const API_URL = 'http://localhost:5001/api/fabric-receiving/receiving-history';

  // Load history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setHistoryData(data.data || []);
      } else {
        throw new Error(data.message || 'Failed to retrieve history');
      }
    } catch (err) {
      console.error('Error fetching receiving history:', err);
      setError(err.message || 'Failed to load receiving history. Make sure server is running.');
    } finally {
      setLoading(false);
    }
  };

  // Filter logic
  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return historyData;
    return historyData.filter(item => {
      return (
        String(item.lotNumber || '').toLowerCase().includes(q) ||
        String(item.barcodeId || '').toLowerCase().includes(q) ||
        String(item.originalBarcodeId || '').toLowerCase().includes(q) ||
        String(item.shade || '').toLowerCase().includes(q) ||
        String(item.receivedBy || '').toLowerCase().includes(q) ||
        String(item.reason || '').toLowerCase().includes(q)
      );
    });
  }, [searchQuery, historyData]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalWeight = 0;
    const uniqueLots = new Set();
    filteredData.forEach(item => {
      totalWeight += parseFloat(item.returnedWeight || 0);
      if (item.lotNumber) {
        uniqueLots.add(String(item.lotNumber).trim());
      }
    });

    return {
      totalWeight,
      transactionCount: filteredData.length,
      lotCount: uniqueLots.size
    };
  }, [filteredData]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="receiving-history-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

        .receiving-history-app {
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: #1E293B;
          padding: 24px;
          min-height: calc(100vh - 70px);
          background-color: #F3F4F6;
        }

        .history-container {
          max-width: 1600px;
          margin: 0 auto;
        }

        /* Header block */
        .history-header {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(99, 102, 241, 0.08);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 10px 30px rgba(99, 102, 241, 0.03);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        .title-area h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 800;
          background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .title-area p {
          margin: 4px 0 0 0;
          color: #64748B;
          font-size: 14px;
          font-weight: 500;
        }

        /* Controls */
        .controls-area {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .search-wrapper {
          position: relative;
          min-width: 300px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748B;
          width: 18px;
          height: 18px;
        }

        .search-input {
          width: 100%;
          padding: 10px 16px 10px 40px;
          border-radius: 12px;
          border: 1px solid rgba(99, 102, 241, 0.15);
          background: #FFFFFF;
          font-size: 14px;
          font-weight: 600;
          outline: none;
          transition: all 0.2s ease;
        }

        .search-input:focus {
          border-color: #6366F1;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          border: 1px solid rgba(99, 102, 241, 0.15);
          background: #FFFFFF;
          color: #4F46E5;
          transition: all 0.2s ease;
        }

        .btn:hover {
          background: #EEF2FF;
          border-color: #6366F1;
          transform: translateY(-1px);
        }

        .btn-primary {
          background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
          color: #FFFFFF;
          border: none;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
        }

        .btn-primary:hover {
          background: linear-gradient(135deg, #4F46E5 0%, #3730A3 100%);
          box-shadow: 0 6px 16px rgba(99, 102, 241, 0.25);
        }

        /* Metrics grid */
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }

        .metric-card {
          background: #FFFFFF;
          border: 1px solid rgba(99, 102, 241, 0.08);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.01);
          transition: all 0.3s ease;
        }

        .metric-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(99, 102, 241, 0.06);
          border-color: rgba(99, 102, 241, 0.2);
        }

        .metric-icon-box {
          width: 50px;
          height: 50px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .metric-details {
          display: flex;
          flex-direction: column;
        }

        .metric-label {
          font-size: 11px;
          text-transform: uppercase;
          color: #64748B;
          font-weight: 800;
          letter-spacing: 0.06em;
        }

        .metric-value {
          font-size: 24px;
          font-weight: 800;
          margin-top: 4px;
          color: #1E293B;
        }

        .metric-purple { border-left: 4px solid #6366F1; }
        .metric-purple .metric-icon-box { background: #EEF2FF; color: #6366F1; }
        
        .metric-emerald { border-left: 4px solid #10B981; }
        .metric-emerald .metric-icon-box { background: #ECFDF5; color: #10B981; }
        
        .metric-amber { border-left: 4px solid #F59E0B; }
        .metric-amber .metric-icon-box { background: #FFFBEB; color: #F59E0B; }

        /* Content block */
        .history-content {
          background: #FFFFFF;
          border: 1px solid rgba(99, 102, 241, 0.08);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 10px 30px rgba(99, 102, 241, 0.02);
        }

        .table-wrapper {
          overflow-x: auto;
          border-radius: 12px;
          border: 1px solid rgba(99, 102, 241, 0.06);
        }

        .history-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 14px;
        }

        .history-table th {
          background: linear-gradient(180deg, #EEF2FF, #E0E7FF);
          color: #3730A3;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.06em;
          padding: 14px 16px;
          border-bottom: 2px solid rgba(99, 102, 241, 0.1);
          text-align: left;
        }

        .history-table td {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(99, 102, 241, 0.04);
          color: #334155;
          font-weight: 500;
        }

        .history-table tr:last-child td {
          border-bottom: none;
        }

        .history-table tr:hover td {
          background-color: rgba(99, 102, 241, 0.02);
        }

        .barcode-cell {
          font-family: monospace;
          font-weight: 700;
          color: #4F46E5;
          background: #EEF2FF;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 12px;
          border: 1px solid rgba(99, 102, 241, 0.1);
        }

        .lot-cell {
          font-weight: 700;
          color: #1E293B;
        }

        .shade-badge {
          display: inline-block;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          background-color: #F1F5F9;
          font-size: 12px;
        }

        .weight-pill {
          display: inline-block;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 6px;
          background: #ECFDF5;
          color: #065F46;
          border: 1px solid #A7F3D0;
        }

        /* States */
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          gap: 16px;
        }

        .spinner {
          width: 44px;
          height: 44px;
          border: 4px solid #E2E8F0;
          border-top-color: #6366F1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .error-state {
          background: #FEF2F2;
          color: #991B1B;
          border: 1px solid #FCA5A5;
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          font-weight: 600;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #64748B;
        }

        .empty-icon {
          font-size: 54px;
          margin-bottom: 12px;
          opacity: 0.6;
        }

        .empty-state h3 {
          margin: 0 0 6px 0;
          font-weight: 700;
          color: #334155;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Print styles */
        @media print {
          body {
            background: #FFFFFF !important;
          }
          .receiving-history-app {
            padding: 0 !important;
            background: #FFFFFF !important;
          }
          .history-header, .metrics-grid, .search-wrapper, .btn:not(.print-only) {
            display: none !important;
          }
          .history-content {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
          .table-wrapper {
            border: none !important;
            border-radius: 0 !important;
          }
          .history-table th {
            background: #F1F5F9 !important;
            color: #000000 !important;
            border-bottom: 2px solid #000000 !important;
          }
          .history-table td {
            border-bottom: 1px solid #E2E8F0 !important;
          }
        }
      `}</style>

      <div className="history-container">
        {/* Header Block */}
        <header className="history-header">
          <div className="title-area">
            <h1>📥 Fabric Returns Log</h1>
            <p>Complete record of received fabric returns and transactions from MySQL database</p>
          </div>

          <div className="controls-area">
            <button className="btn" onClick={() => navigate(-1)}>
              <ArrowLeft size={16} /> Back
            </button>
            <div className="search-wrapper">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search Lot, Barcode, Color..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn" onClick={fetchHistory} title="Refresh Data">
              <RotateCcw size={16} /> Refresh
            </button>
            <button className="btn btn-primary" onClick={handlePrint}>
              <Printer size={16} /> Print Report
            </button>
          </div>
        </header>

        {/* Error message */}
        {error && (
          <div className="error-state">
            <span>⚠️</span>
            <div style={{ flex: 1 }}>{error}</div>
            <button className="btn" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={fetchHistory}>
              Retry
            </button>
          </div>
        )}

        {/* Metrics Grid */}
        {!loading && !error && (
          <div className="metrics-grid">
            <div className="metric-card metric-purple">
              <div className="metric-icon-box">⚖️</div>
              <div className="metric-details">
                <span className="metric-label">Total Weight Returned</span>
                <span className="metric-value">{metrics.totalWeight.toFixed(2)} KG</span>
              </div>
            </div>

            <div className="metric-card metric-emerald">
              <div className="metric-icon-box">📦</div>
              <div className="metric-details">
                <span className="metric-label">Return Transactions</span>
                <span className="metric-value">{metrics.transactionCount} Records</span>
              </div>
            </div>

            <div className="metric-card metric-amber">
              <div className="metric-icon-box">🏷️</div>
              <div className="metric-details">
                <span className="metric-label">Unique Lots Affected</span>
                <span className="metric-value">{metrics.lotCount} Lots</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Block */}
        <main className="history-content">
          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              <div style={{ fontWeight: 700, color: '#64748B' }}>Loading receiving history from MySQL database...</div>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📂</div>
              <h3>No receiving history found</h3>
              <p>{searchQuery ? 'No records match your search query.' : 'No return transactions have been recorded in the database.'}</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Lot Number</th>
                    <th>Original Barcode ID</th>
                    <th>Shade (Color)</th>
                    <th>Returned Wt (KG)</th>
                    <th>Original Issued (KG)</th>
                    <th>Received By</th>
                    <th>Reason / Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item) => {
                    const formattedDate = item.createdAt 
                      ? new Date(item.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })
                      : item.returnDate || 'N/A';

                    return (
                      <tr key={item.id}>
                        <td>{formattedDate}</td>
                        <td className="lot-cell">{item.lotNumber}</td>
                        <td>
                          <span className="barcode-cell">{item.originalBarcodeId}</span>
                        </td>
                        <td>
                          <span className="shade-badge">{item.shade || 'N/A'}</span>
                        </td>
                        <td>
                          <span className="weight-pill">{parseFloat(item.returnedWeight || 0).toFixed(2)} KG</span>
                        </td>
                        <td>{parseFloat(item.originalIssuedWeight || item.weight || 0).toFixed(2)} KG</td>
                        <td>{item.receivedBy || 'System'}</td>
                        <td>{item.reason || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
