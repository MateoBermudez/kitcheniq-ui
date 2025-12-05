import React, { useEffect, useState, useCallback } from 'react';
import { InfoCircle } from 'react-bootstrap-icons';
import type { Employee } from './StaffTable';

type RoleKey = 'Chef' | 'Waiter' | 'Administrator' | 'Other';

const classifyPosition = (posRaw: string): RoleKey => {
  const pos = posRaw?.trim().toLowerCase();
  if (pos === 'chef') return 'Chef';
  if (pos === 'waiter') return 'Waiter';
  // Treat both 'admin' and 'administrator' as Administrator (exactly from position)
  if (pos === 'admin' || pos === 'administrator') return 'Administrator';
  return 'Other';
};

interface ActiveStats {
  total: number;
  chef: number;
  waiter: number;
  administrator: number;
}

const StaffNotifications: React.FC = () => {
  const [stats, setStats] = useState<ActiveStats>({ total: 0, chef: 0, waiter: 0, administrator: 0 });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const recompute = useCallback((employees: Employee[]) => {
    // Only count employees with status strictly equal to 'On Shift'
    const active = employees.filter(e => e.status === 'On Shift');
    let chef = 0, waiter = 0, administrator = 0;
    active.forEach(e => {
      const role = classifyPosition(e.position);
      if (role === 'Chef') chef++;
      else if (role === 'Waiter') waiter++;
      else if (role === 'Administrator') administrator++;
    });
    setStats({ total: active.length, chef, waiter, administrator });
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    // Listen for the snapshot broadcast from StaffTable
    const listener = (e: Event) => {
      const detail = (e as CustomEvent).detail as { employees?: Employee[] } | undefined;
      if (detail?.employees) recompute(detail.employees);
    };
    window.addEventListener('staff-updated', listener as EventListener);
    return () => window.removeEventListener('staff-updated', listener as EventListener);
  }, [recompute]);

  const formatDate = (d: Date): string => d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const plural = (count: number, singular: string, pluralWord: string): string => `${count} ${count === 1 ? singular : pluralWord}`;

  return (
    <div className="staff-active-indicator" style={{ background: '#D5F9D1', border: '1px solid #b5e6ad', borderRadius: '10px', padding: '10px 14px', fontSize: '0.9rem', lineHeight: 1.25 }}>
      <div className="d-flex align-items-center justify-content-between mb-1">
        <div className="d-flex align-items-center gap-2 fw-semibold" style={{ fontSize: '0.95rem' }}>
          <InfoCircle size={16} /> ACTIVE EMPLOYEES ({formatDate(lastUpdated)})
        </div>
      </div>
      <div className="text-dark" style={{ fontSize: '0.85rem' }}>
        {plural(stats.chef, 'Chef', 'Chefs')} - {plural(stats.waiter, 'Waiter', 'Waiters')} - {plural(stats.administrator, 'Administrator', 'Administrators')}
      </div>
    </div>
  );
};

export default StaffNotifications;
