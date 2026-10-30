import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout(null, {
      onSuccess: () => navigate('/login'),
    });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">Professor Portal</h1>
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-slate-600">
            {user?.name} ({user?.username})
          </span>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto mt-10 px-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            Welcome back, Professor {user?.name}!
          </h2>
          <p className="text-slate-600 mb-6">
            You are authenticated via institutional LDAP. Your session is active.
          </p>

          <div className="bg-slate-50 rounded-md p-4 border border-slate-200 text-sm font-mono text-slate-700">
            <div><span className="font-semibold text-slate-900">Email:</span> {user?.email || 'N/A'}</div>
            <div><span className="font-semibold text-slate-900">Role:</span> {user?.role}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
