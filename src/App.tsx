import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { EjecutivoDashboard } from './pages/EjecutivoDashboard';
import { ClienteDashboard } from './pages/ClienteDashboard';

function AppContent() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '1rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid #e2e8f0',
            borderTopColor: '#667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
          <p style={{ marginTop: '1rem', color: '#718096' }}>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Login />;
  }

  return (
    <Routes>
      {profile.role === 'admin' && (
        <Route path="/admin/*" element={<AdminDashboard />} />
      )}
      {profile.role === 'ejecutivo' && (
        <Route path="/ejecutivo/*" element={<EjecutivoDashboard />} />
      )}
      {profile.role === 'cliente' && (
        <Route path="/cliente/*" element={<ClienteDashboard />} />
      )}
      <Route
        path="*"
        element={
          <Navigate
            to={
              profile.role === 'admin' ? '/admin/dashboard' :
              profile.role === 'ejecutivo' ? '/ejecutivo/crm' :
              '/cliente'
            }
            replace
          />
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
