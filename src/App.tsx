import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './components/auth/AuthContext';
import { ConfigProvider, useConfig } from './components/ConfigContext';
import { useAuth } from './components/auth/AuthContext';
import Home from './pages/Home';
import BoxDetail from './pages/BoxDetail';
import Warehouse from './pages/Warehouse';
import Topup from './pages/Topup';
import Login from './pages/Login';
import BannedPage from './pages/Banned';
import Navbar from './components/layout/Navbar';
import Admin from './pages/Admin';
import CelebratoryModal from './components/CelebratoryModal';
import NotificationManager from './components/NotificationManager';
import { Toaster } from 'sonner';
import AdminNotificationManager from './components/AdminNotificationManager';

function AppContent() {
  const { config } = useConfig();
  const { profile, user } = useAuth();

  if (profile?.isBanned) {
    return <BannedPage />;
  }

  if (config?.maintenanceMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F9FF] p-8 text-center">
        <div className="space-y-6">
          <div className="text-8xl font-serif-italic italic">CRE</div>
          <h1 className="text-2xl font-bold uppercase tracking-widest">Maintenance Mode</h1>
          <p className="text-zinc-500">We're upgrading the experience. Please check back soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Toaster position="top-right" richColors />
      <Navbar />
      <CelebratoryModal />
      <NotificationManager />
      <AdminNotificationManager />
      <main className="flex-grow pt-32 pb-12 container mx-auto px-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/box/:id" element={<BoxDetail />} />
          <Route path="/warehouse" element={<Warehouse />} />
          <Route path="/topup" element={<Topup />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
      
      {/* Footer */}
      <footer className="py-12 border-t border-brand-border bg-white/40">
        <div className="container mx-auto px-4 text-center">
          <p className="font-display font-bold text-2xl tracking-tighter mb-4">CRE</p>
          <p className="text-zinc-500 text-sm">© 2026 CRE High-End Mystery Box Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ConfigProvider>
          <AppContent />
        </ConfigProvider>
      </AuthProvider>
    </Router>
  );
}
