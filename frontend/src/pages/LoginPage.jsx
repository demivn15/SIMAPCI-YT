import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getLoginErrorMessage } from '../utils/loginMessages';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Send credentials to FastAPI backend
      const { data } = await api.post('/auth/login', { username, password });

      // Vuelve a consultar /auth/me para que AuthContext tenga al usuario antes de
      // navegar; sin esto, ProtectedRoute aún ve "sin sesión" y regresa al login
      await queryClient.invalidateQueries({ queryKey: ['authUser'] });

      // T-HU01-06 (PGPCECMC-23), CA01: en el primer acceso el backend crea la cuenta
      // (account_created = true) y el panel muestra la confirmación del registro
      navigate('/dashboard', { replace: true, state: { accountCreated: data?.account_created === true } });
    } catch (err) {
      // Mensaje propio según el código HTTP; no se muestra el texto del backend (CA05)
      setError(getLoginErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Si ya hay una sesión activa, no tiene sentido mostrar el formulario
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Portal institucional de profesores
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Inicia sesión con tus credenciales institucionales
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-200">
          
          {/* Error Alert */}
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700" role="alert">
              <p>{error}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Usuario institucional
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="p. ej., jperez"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Contraseña
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Verificando credenciales...' : 'Iniciar sesión'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
