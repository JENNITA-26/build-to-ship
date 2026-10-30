import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { FleetProvider, useFleet } from './context/FleetContext.jsx';
import Navbar from './components/Navbar.tsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import RoutesPage from './pages/RoutesPage.jsx';
import DisruptionsPage from './pages/DisruptionsPage.jsx';
import ApprovalsPage from './pages/ApprovalsPage.jsx';
import TracePage from './pages/TracePage.jsx';

function AppLayout() {
  const { user } = useFleet();
  const location = useLocation();

  if (!user && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  const isLoginPage = location.pathname === '/login';
  const isDispatcher = user?.role === 'dispatcher';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {!isLoginPage && <Navbar />}
      <main
        className={
          isLoginPage
            ? 'flex-1'
            : 'flex-1 mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6'
        }
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/routes" element={<RoutesPage />} />
          <Route path="/disruptions" element={<DisruptionsPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route
            path="/trace"
            element={isDispatcher ? <TracePage /> : <Navigate to="/dashboard" replace />}
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <FleetProvider>
      <AppLayout />
    </FleetProvider>
  );
}
