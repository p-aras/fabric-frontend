import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout.jsx';
import Materials from './pages/Materials.jsx';
import WarehousePage from './pages/WarehousePage.jsx';
import GRNPage from './pages/GRNPage.jsx';
import IssuePage from './pages/IssuePage.jsx';
import TransferPage from './pages/TransferPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import FabricStickerForm from './pages/FabricStickerForm.jsx';
import Recommandation from './pages/Recommandation.jsx';
import DyeingMaterialForm from './pages/DyeingMaterialForm.jsx';
import Parta from './pages/Parta.jsx';
import FabricReceivingHistoryPage from './pages/FabricReceivingHistoryPage.jsx';
import PartaPendingPage from './pages/PartaPendingPage.jsx';


export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('twms_dark') === 'true';
  });

  const [user, setUser] = useState(() => {
    try {
      const u = localStorage.getItem('twms_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem('twms_dark', darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDark = () => setDarkMode(d => !d);

  const handleLogout = () => {
    localStorage.removeItem('twms_token');
    localStorage.removeItem('twms_user');
    setUser(null);
  };

  return (
    <BrowserRouter>
      {user ? (
        <Layout darkMode={darkMode} toggleDark={toggleDark} currentUser={user} handleLogout={handleLogout}>
          <Routes>
            <Route path="/materials" element={<Materials />} />
            <Route path="/fabric-sticker" element={<FabricStickerForm />} />
            <Route path="/dyeing-material" element={<DyeingMaterialForm />} />
            <Route path="/warehouse" element={<WarehousePage />} />
            <Route path="/grn" element={<GRNPage />} />
            <Route path="/issue" element={<IssuePage />} />
            <Route path="/transfer" element={<TransferPage />} />
            <Route path="/parta" element={<Parta />} />
            <Route path="/fabric-receiving-history" element={<FabricReceivingHistoryPage />} />
            <Route path="/recommendation" element={<Recommandation />} />
            {user?.role !== 'Admin' && (
              <Route path="/parta-pending" element={<PartaPendingPage />} />
            )}
            {user?.role === 'Admin' && (
              <>
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/reports/stock" element={<ReportsPage />} />
                <Route path="/reports/warehouse" element={<ReportsPage />} />
                <Route path="/reports/movement" element={<ReportsPage />} />
                <Route path="/reports/supplier" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage darkMode={darkMode} toggleDark={toggleDark} />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/materials" replace />} />
          </Routes>
        </Layout>
      ) : (
        <Routes>
          <Route path="/login" element={<LoginPage setUser={setUser} />} />
          <Route path="/register" element={<RegisterPage setUser={setUser} />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

