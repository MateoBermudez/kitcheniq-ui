import React, { useEffect, useState, useCallback } from 'react';
import { Badge } from 'react-bootstrap';
import { InfoCircle } from 'react-bootstrap-icons';
import type { Employee } from './StaffTable';

// Normalización de roles para agrupar
const ROLE_MAP: Record<string, 'Chef' | 'Waiter' | 'Manager' | 'Other'> = {
  chef: 'Chef',
  cook: 'Chef',
  'sous chef': 'Chef',
  waiter: 'Waiter',
  waitress: 'Waiter',
  server: 'Waiter',
  bartender: 'Waiter', // podemos considerarlo dentro de Waiter para el indicador
  host: 'Waiter',
  hostess: 'Waiter',
  manager: 'Manager',
  admin: 'Manager',
  administrator: 'Manager'
};

interface ActiveStats {
  total: number;
  chef: number;
  waiter: number;
  manager: number;
}

const getRoleGroup = (raw: string): 'Chef' | 'Waiter' | 'Manager' | 'Other' => {
  const key = raw.trim().toLowerCase();
  return ROLE_MAP[key] ?? 'Other';
};

const StaffNotifications: React.FC = () => {
  const [stats, setStats] = useState<ActiveStats>({ total: 0, chef: 0, waiter: 0, manager: 0 });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const recompute = useCallback((employees: Employee[]) => {
    const active = employees.filter(e => e.status === 'On Shift');
    let chef = 0, waiter = 0, manager = 0;
    active.forEach(e => {
      const group = getRoleGroup(e.position);
      if (group === 'Chef') chef++; else if (group === 'Waiter') waiter++; else if (group === 'Manager') manager++;
    });
    setStats({ total: active.length, chef, waiter, manager });
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    // Intentar obtener snapshot inicial si StaffTable ya cargó
    const initialListener = (e: Event) => {
      const detail = (e as CustomEvent).detail as { employees?: Employee[] } | undefined;
      if (detail?.employees) recompute(detail.employees);
    };
    window.addEventListener('staff-updated', initialListener as EventListener);
    return () => window.removeEventListener('staff-updated', initialListener as EventListener);
  }, [recompute]);

  useEffect(() => {
    // Escuchar cambios de turno directamente
    const shiftListener = (e: Event) => {
      // El evento shift-change solo trae IDs, esperamos que StaffTable despache luego staff-updated
      // No hacemos nada aquí; la actualización llega por staff-updated.
    };
    window.addEventListener('shift-change', shiftListener as EventListener);
    return () => window.removeEventListener('shift-change', shiftListener as EventListener);
  }, []);

  const formatDate = (d: Date): string => {
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const plural = (count: number, singular: string, pluralWord: string): string => {
    return `${count} ${count === 1 ? singular : pluralWord}`;
  };

  return (
    <div className="staff-active-indicator" style={{ background: '#D5F9D1', border: '1px solid #b5e6ad', borderRadius: '10px', padding: '10px 14px', fontSize: '0.9rem', lineHeight: 1.25 }}>
      <div className="d-flex align-items-center justify-content-between mb-1">
        <div className="d-flex align-items-center gap-2 fw-semibold" style={{ fontSize: '0.95rem' }}>
          <InfoCircle size={16} /> EMPLEADOS ACTIVOS ({formatDate(lastUpdated)})
        </div>
      </div>
      <div className="text-dark" style={{ fontSize: '0.85rem' }}>
        {plural(stats.chef, 'Cocinero', 'Cocineros')} - {plural(stats.waiter, 'Mesero', 'Meseros')} - {plural(stats.manager, 'Administrador', 'Administradores')}
      </div>
    </div>
  );
};

export default StaffNotifications;
