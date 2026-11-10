import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, X } from 'lucide-react';

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => { success: boolean; error?: string };
}

export function LoginDialog({ isOpen, onClose, onLogin }: LoginDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    setPassword('');
    setVisible(false);
    setError('');
    setForgot(false);
    if (isOpen && !element.open) element.showModal();
    else if (!isOpen && element.open) element.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialog}
      className="welcome-login-dialog"
      aria-labelledby={`${id}-title`}
      onCancel={onClose}
      onClose={onClose}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    >
      <button type="button" className="welcome-login-close" aria-label="Cerrar inicio de sesión" onClick={onClose}>
        <X size={22} aria-hidden="true" />
      </button>
      <div className="login-form">
        <p className="eyebrow">SIMAPC</p>
        <h2 id={`${id}-title`}>Iniciar sesión</h2>
        <p>Ingrese con su cuenta institucional.</p>
        <form onSubmit={event => {
          event.preventDefault();
          const result = onLogin(email, password);
          if (result.success) onClose();
          else setError(result.error || 'No se pudo iniciar sesión.');
        }}>
          <label htmlFor={`${id}-email`}>Correo institucional</label>
          <input id={`${id}-email`} type="email" autoComplete="username" placeholder="nombre@yachaytech.edu.ec" required value={email} onChange={event => setEmail(event.target.value)} />
          <label htmlFor={`${id}-password`}>Contraseña</label>
          <div className="password-field">
            <input id={`${id}-password`} type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
            <button type="button" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setVisible(!visible)}>
              {visible ? <EyeOff size={22} aria-hidden="true" /> : <Eye size={22} aria-hidden="true" />}
            </button>
          </div>
          <button type="button" className="forgot-link" onClick={() => setForgot(!forgot)}>¿Olvidó su contraseña?</button>
          {forgot && <p role="status" className="login-note">Para recuperar su acceso, contacte con el administrador de la plataforma.</p>}
          {error && <p role="alert" className="login-error">{error}</p>}
          <button type="submit" className="primary-button login-submit">Iniciar sesión<ArrowRight size={20} aria-hidden="true" /></button>
        </form>
      </div>
    </dialog>
  );
}
