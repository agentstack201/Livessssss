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
import PdfPreview from './pages/PdfPreview'
import UserManagement from './pages/UserManagement'
import MediaManager from './pages/MediaManager'
import CountryManagement from './pages/CountryManagement'
import DoctorManagement from './pages/DoctorManagement'
import HospitalManagement from './pages/HospitalManagement'
import Settings from './pages/Settings'
// CV Routes
import CVList from './features/cv/pages/CVList'
import CreateCV from './features/cv/pages/CreateCV'
import EditCV from './features/cv/pages/EditCV'
import CVAIExtract from './features/cv/pages/CVAIExtract'
import './App.css'

function App() {
  const location = useLocation()
  const isDashboard = location.pathname === '/dashboard'

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

          {/* CV Routes */}
          <Route
            path="/cv/list"
            element={
              <ProtectedRoute>
                <CVList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cv/ai-extract"
            element={
              <ProtectedRoute>
                <CVAIExtract />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cv/create"
            element={
              <ProtectedRoute>
                <CreateCV />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cv/edit/:id"
            element={
              <ProtectedRoute>
                <EditCV />
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
