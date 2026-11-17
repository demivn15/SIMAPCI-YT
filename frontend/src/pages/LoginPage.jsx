/**
 * Inicio de sesión institucional (HU01, HU02). Se muestra como un cuadro sobre la pantalla
 * de acceso, igual que en el prototipo. El backend recibe el usuario institucional (uid del
 * directorio), no el correo.
 */
import { useEffect, useId, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AccessScreen from '../components/portal/AccessScreen';
import { api } from '../services/api';
import { getLoginErrorMessage } from '../utils/loginMessages';

export default function LoginPage() {
  const id = useId();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  // Escape cierra el cuadro y vuelve a la vista pública
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') navigate('/');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

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

  const dialog = (
    <div
      className="login-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) navigate('/');
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="login-dialog">
        <button type="button" className="login-close" aria-label="Cerrar inicio de sesión" onClick={() => navigate('/')}>
          <X size={22} aria-hidden="true" />
        </button>
        <p className="eyebrow">SIMAPC</p>
        <h2 id={`${id}-title`} className="display">
          Iniciar sesión
        </h2>
        <p className="login-intro">Ingrese con su cuenta institucional.</p>

        <form onSubmit={handleLogin} aria-busy={isLoading}>
          <label htmlFor={`${id}-username`}>Usuario institucional</label>
          <input
            id={`${id}-username`}
            type="text"
            autoComplete="username"
            placeholder="p. ej., jperez"
            required
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <label htmlFor={`${id}-password`}>Contraseña</label>
          <div className="password-field">
            <input
              id={`${id}-password`}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={22} aria-hidden="true" /> : <Eye size={22} aria-hidden="true" />}
            </button>
          </div>

          <button type="button" className="forgot-link" onClick={() => setShowHelp(!showHelp)}>
            ¿Olvidó su contraseña?
          </button>
          {showHelp && (
            <p role="status" className="login-message">
              Para recuperar su acceso, contacte con el administrador de la plataforma.
            </p>
          )}
          {error && (
            <p role="alert" className="login-message">
              {error}
            </p>
          )}

          <button type="submit" disabled={isLoading} className="btn btn-primary login-submit">
            {isLoading ? 'Verificando credenciales...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );

  return <AccessScreen dialog={dialog} />;
}
