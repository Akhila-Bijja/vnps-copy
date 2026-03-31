import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

// Guard — redirect to dashboard if already logged in
const PublicRoute = ({ children }) => {
  const user = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  
  // Check both token (email login) and user (google login)
  if (token || (user && user !== '{}')) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Guard — redirect to login if not logged in
const PrivateRoute = ({ children }) => {
  const user = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  const params = new URLSearchParams(window.location.search);
  const googleUser = params.get('googleUser');
  
  if (!token && (!user || user === '{}') && !googleUser) {
    return <Navigate to="/login" replace />;
  }
  return children;
};


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <PublicRoute><Landing /></PublicRoute>
        } />
        <Route path="/login" element={
          <PublicRoute><Login /></PublicRoute>
        } />
        <Route path="/dashboard" element={
          <PrivateRoute><Dashboard /></PrivateRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;