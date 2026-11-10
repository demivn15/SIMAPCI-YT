import React from 'react';
import { UserNotification, PRODUCT_STATUS_LABELS } from '../../types';
import { Bell, Check, CheckCheck, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface NotificationsPopoverProps {
  notifications: UserNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
}

export const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose,
}) => {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="notifications-popover absolute right-0 mt-2 w-96 max-w-[90vw] bg-white z-50 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[var(--school-ink)]" />
          <span className="font-semibold text-sm text-neutral-900">Notificaciones</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-bold bg-[var(--school-ink)] text-white">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllAsRead}
            className="text-xs text-neutral-600 hover:text-[var(--school-ink)] flex items-center gap-1 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Marcar leídas
          </button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto divide-y divide-neutral-100">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No tienes notificaciones pendientes.</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const isCargado = notif.status === 'cargado';
            const isVerificado = notif.status === 'verificado';
            const isRechazado = notif.status === 'rechazado';

            return (
              <div
                key={notif.id}
                className={`p-3.5 transition-colors ${
                  notif.read ? 'bg-white hover:bg-neutral-50' : 'bg-red-50/40 hover:bg-red-50/70'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    {isCargado && (
                      <span className="p-1 bg-amber-100 text-amber-700 flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {isVerificado && (
                      <span className="p-1 bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {isRechazado && (
                      <span className="p-1 bg-red-100 text-red-700 flex items-center justify-center">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold text-neutral-900 truncate">
                        {PRODUCT_STATUS_LABELS[notif.status]}
                      </span>
                      <span className="text-[10px] text-neutral-400 shrink-0">
                        {new Date(notif.createdAt).toLocaleDateString('es-EC', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-600 leading-relaxed mb-1.5">{notif.message.replace(/Comité Revisor Institucional/gi,'Comité Científico').replace(/dictamen de rechazo/gi,'producto en observación').replace(/rechazad[oa]s?/gi,'en observación')}</p>

                    {notif.reason && (
                      <div className="p-2 bg-red-50 text-xs text-red-800 mb-1.5">
                        <strong>Observación del Comité Científico:</strong> {notif.reason}
                      </div>
                    )}

                    {!notif.read && (
                      <button
                        onClick={() => onMarkAsRead(notif.id)}
                        className="text-[11px] font-medium text-[var(--school-ink)] hover:underline flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        Marcar como leída
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-2 text-center">
        <button
          onClick={onClose}
          className="text-xs font-medium text-neutral-600 hover:text-neutral-900 py-1 px-3"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
