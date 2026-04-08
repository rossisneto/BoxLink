import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Wod from './pages/Wod';
import Challenges from './pages/Challenges';
import Leaderboard from './pages/Leaderboard';
import Duels from './pages/Duels';
import MyBox from './pages/MyBox';
import Profile from './pages/Profile';
import Progress from './pages/Progress';
import AvatarCustomization from './pages/AvatarCustomization';
import Admin from './pages/Admin';
import Coach from './pages/Coach';
import TV from './pages/TV';
import Login from './pages/Login';
import Signup from './pages/Signup';

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode; roles?: string[] }) => {
  const { user, loading, logout } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-primary font-headline font-black text-2xl italic animate-pulse">CARREGANDO...</div>;
  if (!user) return <Navigate to="/login" />;
  
  if (user.status !== 'approved') {
    // If not approved, sign out and go to login
    logout();
    return <Navigate to="/login" />;
  }

  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/tv" element={<TV />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="wod" element={<Wod />} />
            <Route path="challenges" element={<Challenges />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="duels" element={<Duels />} />
            <Route path="mybox" element={<MyBox />} />
            <Route path="profile" element={<Profile />} />
            <Route path="progress" element={<Progress />} />
            <Route path="avatar" element={<AvatarCustomization />} />
            <Route path="admin" element={<ProtectedRoute roles={['admin']}><Admin /></ProtectedRoute>} />
            <Route path="coach" element={<ProtectedRoute roles={['coach', 'admin']}><Coach /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
