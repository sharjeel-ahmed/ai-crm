import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PipelinePage from './pages/PipelinePage';
import DealsPage from './pages/DealsPage';
import ContactsPage from './pages/ContactsPage';
import CompaniesPage from './pages/CompaniesPage';
import ActivitiesPage from './pages/ActivitiesPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import AIInboxPage from './pages/AIInboxPage';
import AILogsPage from './pages/AILogsPage';
import CompanyDetailPage from './pages/CompanyDetailPage';
import DealDetailPage from './pages/DealDetailPage';
import PartnersPage from './pages/PartnersPage';
import PartnerDetailPage from './pages/PartnerDetailPage';
import ProfilePage from './pages/ProfilePage';
import ClosedDealsPage from './pages/ClosedDealsPage';
import FunnelDashboardPage from './pages/FunnelDashboardPage';
import MarketingPage from './pages/MarketingPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<MarketingPage />} />
          <Route path="/marketing" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="pipeline" element={<PipelinePage />} />
            <Route path="deals" element={<DealsPage />} />
            <Route path="deals/closed" element={<ClosedDealsPage />} />
            <Route path="deals/:id" element={<DealDetailPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="companies" element={<CompaniesPage />} />
            <Route path="companies/:id" element={<CompanyDetailPage />} />
            <Route path="partners" element={<PartnersPage />} />
            <Route path="partners/:id" element={<PartnerDetailPage />} />
            <Route path="activities" element={<ActivitiesPage />} />
            <Route path="funnel" element={<FunnelDashboardPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="ai-inbox" element={<ProtectedRoute roles={['admin']}><AIInboxPage /></ProtectedRoute>} />
            <Route path="ai-logs" element={<ProtectedRoute roles={['admin']}><AILogsPage /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute roles={['admin']}><SettingsPage /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}
