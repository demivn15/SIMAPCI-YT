import React, { useState, useEffect } from 'react';
import { RegisterFormData, RegisterValidationErrors } from '../../services/authService';
import { TeacherUser } from '../../types';
import { X, UserPlus, CheckCircle2 } from 'lucide-react';
import { SCHOOLS } from '../../constants/schools';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (data: RegisterFormData) => { success: boolean; user?: TeacherUser; errors?: RegisterValidationErrors };
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose, onRegister }) => {
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    school: '',
    orcid: '',
    bio: '',
  });

  const [errors, setErrors] = useState<RegisterValidationErrors>({});
  const [successNotice, setSuccessNotice] = useState(false);

  useEffect(()=>{
    if(!isOpen)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return ()=>{document.body.style.overflow=previous;};
  },[isOpen]);
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = onRegister(formData);
    if (result.success) {
      setSuccessNotice(true);
      setTimeout(() => {
        setSuccessNotice(false);
        onClose();
      }, 1500);
    } else if (result.errors) {
      setErrors(result.errors);
    }
  };

  return (
    <div className="account-register-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-xs">
      <div role="dialog" aria-modal="true" aria-labelledby="account-register-title" className="account-register-dialog bg-white shadow-2xl border border-neutral-200">
        {/* Encabezado */}
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-50 text-[var(--school-ink)]">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="account-register-title" className="text-base font-bold text-neutral-900">Registro de docente</h2>
              <p className="text-xs text-neutral-500">
                Complete sus datos para crear su cuenta.
              </p>
            </div>
          </div>
          <button
            aria-label="Cerrar registro"
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de éxito */}
        {successNotice ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto animate-bounce" />
            <h3 className="text-lg font-bold text-neutral-900">¡Cuenta Creada Exitosamente!</h3>
            <p className="text-xs text-neutral-600">
              Bienvenido a SIMAPC. Tu sesión ha sido iniciada automáticamente.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="account-register-form">
            {/* 1. Nombre completo */}
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Nombre y Apellidos Completos *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej. Dr. Andrés Villacís"
                required
                className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-hidden focus:ring-1 ${
                  errors.name
                    ? 'border-red-500 focus:ring-red-500 bg-red-50/20'
                    : 'border-neutral-300 focus:ring-[var(--school-accent)]'
                }`}
              />
              {errors.name && <p className="text-[11px] text-red-600 mt-1">{errors.name}</p>}
            </div>

            {/* 2. Correo institucional */}
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Correo institucional *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="ejemplo@yachaytech.edu.ec"
                required
                className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-hidden focus:ring-1 ${
                  errors.email
                    ? 'border-red-500 focus:ring-red-500 bg-red-50/20'
                    : 'border-neutral-300 focus:ring-[var(--school-accent)]'
                }`}
              />
              {errors.email && <p className="text-[11px] text-red-600 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="register-school" className="block font-semibold text-neutral-700 mb-1">
                Escuela *
              </label>
              <select
                id="register-school"
                value={formData.school}
                onChange={(e) => setFormData({ ...formData, school: e.target.value as RegisterFormData['school'] })}
                required
                aria-invalid={!!errors.school}
                aria-describedby={errors.school ? 'register-school-error' : undefined}
                className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-hidden focus:ring-1 ${
                  errors.school
                    ? 'border-red-500 focus:ring-red-500 bg-red-50/20'
                    : 'border-neutral-300 focus:ring-[var(--school-accent)]'
                }`}
              >
                <option value="" disabled>Seleccione una escuela</option>
                {SCHOOLS.map((school) => <option key={school.code} value={school.code}>{school.name}</option>)}
              </select>
              {errors.school && <p id="register-school-error" className="text-[11px] text-red-600 mt-1">{errors.school}</p>}
            </div>

            {/* 3. Contraseña */}
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Contraseña de Acceso (mínimo 6 caracteres) *
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                required
                className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-hidden focus:ring-1 ${
                  errors.password
                    ? 'border-red-500 focus:ring-red-500 bg-red-50/20'
                    : 'border-neutral-300 focus:ring-[var(--school-accent)]'
                }`}
              />
              {errors.password && <p className="text-[11px] text-red-600 mt-1">{errors.password}</p>}
            </div>

            {/* ORCID opcional */}
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Identificador ORCID (Opcional)
              </label>
              <input
                type="text"
                value={formData.orcid}
                onChange={(e) => setFormData({ ...formData, orcid: e.target.value })}
                placeholder="0000-0002-1825-0097"
                className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-hidden focus:ring-1 ${
                  errors.orcid
                    ? 'border-red-500 focus:ring-red-500 bg-red-50/20'
                    : 'border-neutral-300 focus:ring-[var(--school-accent)]'
                }`}
              />
              {errors.orcid && <p className="text-[11px] text-red-600 mt-1">{errors.orcid}</p>}
            </div>

            {/* 6. Biografía / Especialidad */}
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Línea de Interés / Biografía Breve
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={2}
                placeholder="Especialidad o área de investigación..."
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs focus:ring-1 focus:ring-[var(--school-accent)] resize-none"
              />
            </div>

            <div className="account-register-actions flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[var(--school-ink)] hover:bg-[var(--school-ink)] text-white font-bold transition-colors"
              >
                Confirmar Registro
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
