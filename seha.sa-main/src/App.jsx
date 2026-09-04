import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import ToastContainer from './components/ToastContainer'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SickLeaveInquiry from './pages/SickLeaveInquiry'
import SickLeaveForm from './pages/SickLeaveForm'
import PdfGenerator from './pages/PdfGenerator'
import Templates from './pages/Templates'
import PdfPreview from './pages/PdfPreview'
import UserManagement from './pages/UserManagement'
import MediaManager from './pages/MediaManager'
import CountryManagement from './pages/CountryManagement'
import DoctorManagement from './pages/DoctorManagement'
import HospitalManagement from './pages/HospitalManagement'
import Settings from './pages/Settings'
import KeysManagement from './pages/KeysManagement'
import BatchSickLeave from './pages/BatchSickLeave'
import GrowthConsole from './growth/GrowthConsole'
import './App.css'

function App() {
  const location = useLocation()
  // كونسول النمو يحمل هيكله الخاص (شريط جانبي وشريط علوي)، فلا يُغلَّف
  // بترويسة المنصة وتذييلها كما لا تُغلَّف لوحة التحكّم.
  const isDashboard = location.pathname === '/dashboard'
    || location.pathname.startsWith('/growth')

  return (
    <div className="app">
      {!isDashboard && <Header />}
      <main className="main-content">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/inquiries/slenquiry" element={<SickLeaveInquiry />} />
          <Route path="/inquiries/sick-leave-inquiry" element={<SickLeaveInquiry />} />

          {/* Protected Routes - تحتاج تسجيل دخول */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sl-form"
            element={
              <ProtectedRoute>
                <SickLeaveForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/batch"
            element={
              <ProtectedRoute>
                <BatchSickLeave />
              </ProtectedRoute>
            }
          />
          <Route
            path="/templates"
            element={
              <ProtectedRoute>
                <Templates />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pdf-generator"
            element={
              <ProtectedRoute>
                <PdfGenerator />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pdf-preview"
            element={
              <ProtectedRoute>
                <PdfPreview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/media"
            element={
              <ProtectedRoute>
                <MediaManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/countries"
            element={
              <ProtectedRoute>
                <CountryManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctors"
            element={
              <ProtectedRoute>
                <DoctorManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hospitals"
            element={
              <ProtectedRoute>
                <HospitalManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/keys"
            element={
              <ProtectedRoute>
                <KeysManagement />
              </ProtectedRoute>
            }
          />

          {/* كونسول النمو — يدير مساراته الفرعية داخلياً */}
          <Route
            path="/growth/*"
            element={
              <ProtectedRoute>
                <GrowthConsole />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      {!isDashboard && <Footer />}
      <ToastContainer />
    </div>
  )
}

export default App
