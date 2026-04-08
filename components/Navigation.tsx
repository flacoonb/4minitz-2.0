'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';
import {
  User,
  LogOut,
  Shield,
  ChevronDown,
  Users as UsersIcon,
  CalendarDays,
  Menu,
  X
} from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();
  const { user: currentUser, loading, logout, hasPermission } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [assignedFunctionNames, setAssignedFunctionNames] = useState<string[]>([]);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('nav');
  const tRoles = useTranslations('admin.users.roles');

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    if (showUserMenu || mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu, mobileMenuOpen]);

  useEffect(() => {
    const loadAssignedFunctions = async () => {
      if (!currentUser?._id) {
        setAssignedFunctionNames([]);
        return;
      }

      try {
        const response = await fetch('/api/club-functions?includeInactive=true', {
          credentials: 'include',
        });
        if (!response.ok) {
          setAssignedFunctionNames([]);
          return;
        }

        const payload = await response.json().catch(() => ({}));
        const entries = Array.isArray(payload?.data) ? payload.data : [];
        const matches = entries.filter((entry: any) => String(entry?.assignedUserId || '') === currentUser._id);
        const activeNames = matches
          .filter((entry: any) => entry?.isActive)
          .map((entry: any) => String(entry?.name || '').trim())
          .filter(Boolean);
        const fallbackNames = matches
          .map((entry: any) => String(entry?.name || '').trim())
          .filter(Boolean);
        const names = activeNames.length > 0 ? activeNames : fallbackNames;
        setAssignedFunctionNames(Array.from(new Set(names)));
      } catch {
        setAssignedFunctionNames([]);
      }
    };

    loadAssignedFunctions();
  }, [currentUser?._id]);

  const canAccessPlanning = Boolean(
    currentUser &&
      (currentUser.role === 'admin' ||
        currentUser.role === 'moderator' ||
        hasPermission('canCreateMeetings'))
  );

  const functionDisplay = assignedFunctionNames.length > 0
    ? assignedFunctionNames.join(', ')
    : t('noFunctionAssigned');

  const navItems = [
    { href: '/dashboard', label: t('dashboard'), icon: 'dashboard' },
    { href: '/meeting-series', label: t('meetingSeries'), icon: 'series' },
    { href: '/tasks', label: t('tasks'), icon: 'tasks' },
    { href: '/documents', label: t('documents'), icon: 'documents' },
    ...(canAccessPlanning ? [{ href: '/planning', label: t('planning'), icon: 'planning' }] : []),
  ];

  const adminItems = [
    { href: '/admin', label: t('adminDashboard'), icon: 'admin-dashboard' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/meeting-series') return pathname.startsWith('/meeting-series') || pathname.startsWith('/minutes');
    return pathname.startsWith(href);
  };

  const canAccessRoute = (requiredRole: string) => {
    if (!currentUser) return false;

    const roleHierarchy = { admin: 3, moderator: 2, user: 1 };
    const userLevel = roleHierarchy[currentUser.role];
    const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy];

    return userLevel >= requiredLevel;
  };

  return (
    <nav className="flex justify-between items-center">
      {/* Mobile Hamburger Button */}
      {currentUser && !loading && (
        <div className="md:hidden" ref={mobileMenuRef}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            style={{ color: 'var(--brand-text)', backgroundColor: 'transparent' }}
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* Mobile Dropdown Menu */}
          {mobileMenuOpen && (
            <div
              className="absolute left-0 right-0 top-full mt-1 mx-4 rounded-xl shadow-xl py-2 z-50 max-h-[70vh] overflow-y-auto app-card"
              style={{ backgroundColor: 'var(--brand-card)', backdropFilter: 'none' }}
            >
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 text-base font-medium transition-colors ${isActive(item.href)
                    ? 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] border-l-4 border-[var(--brand-primary)]'
                    : 'hover:bg-[var(--brand-surface-soft)]'
                    }`}
                  style={!isActive(item.href) ? { color: 'var(--brand-text)' } : undefined}
                >
                  {item.label}
                </Link>
              ))}

              {canAccessRoute('admin') && (
                <>
                  <div className="border-t my-1" style={{ borderColor: 'var(--brand-card-border)' }} />
                  {adminItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-4 py-3 text-base font-medium transition-colors ${isActive(item.href)
                        ? 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] border-l-4 border-[var(--brand-primary)]'
                        : 'text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)]'
                        }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Desktop Navigation - Hidden on mobile */}
      {currentUser && !loading ? (
        <div className="hidden md:flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative px-4 py-2.5 rounded-xl font-medium transition-all duration-200 min-h-[44px] flex items-center min-w-0 ${isActive(item.href)
                ? 'brand-button-primary text-white shadow-lg'
                : 'hover:bg-[var(--brand-surface-soft)] hover:shadow-md'
                }`}
              style={!isActive(item.href) ? { color: 'var(--brand-text)' } : undefined}
            >
              <div className="flex items-center gap-2">
                <span className="truncate">{item.label}</span>
              </div>

              {/* Active indicator */}
              {isActive(item.href) && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-white rounded-t-full" />
              )}
            </Link>
          ))}

          {/* Admin Navigation */}
          {canAccessRoute('admin') && (
            <>
              {adminItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative px-4 py-2.5 rounded-xl font-medium transition-all duration-200 min-h-[44px] flex items-center min-w-0 ${isActive(item.href)
                    ? 'brand-button-primary text-white shadow-lg'
                    : 'text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)] hover:shadow-md border border-[var(--brand-primary-border)]'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate">{item.label}</span>
                  </div>

                  {/* Active indicator */}
                  {isActive(item.href) && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-white rounded-t-full" />
                  )}
                </Link>
              ))}
            </>
          )}
        </div>
      ) : (
        <div></div>
      )}

      {/* User Menu */}
      <div className="flex items-center gap-3">
        {loading ? (
          <div className="w-8 h-8 border-2 border-[var(--brand-card-border)] border-t-[var(--brand-primary)] rounded-full animate-spin"></div>
        ) : currentUser ? (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all shadow-md hover:shadow-lg min-h-[44px]"
              style={{ backgroundColor: 'var(--brand-card-soft)' }}
            >
              <div className="w-8 h-8 brand-gradient-bg rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {(currentUser.firstName && currentUser.firstName[0] ? currentUser.firstName[0].toUpperCase() : '') ||
                 (currentUser.email && currentUser.email[0] ? currentUser.email[0].toUpperCase() : '?')}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-semibold" style={{ color: 'var(--brand-text)' }}>
                  {currentUser.firstName || ''} {currentUser.lastName || ''}
                </div>
                <div className="text-xs" style={{ color: 'var(--brand-text-muted)' }}>
                  {t('functionLabel')}: {functionDisplay}
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} style={{ color: 'var(--brand-text-muted)' }} />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div
                className="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-xl py-2 z-50 app-card"
                style={{ backgroundColor: 'var(--brand-card)', backdropFilter: 'none' }}
              >
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--brand-card-border)' }}>
                  <div className="font-semibold" style={{ color: 'var(--brand-text)' }}>
                    {currentUser.firstName} {currentUser.lastName}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--brand-text-muted)' }}>
                    {t('functionLabel')}: {functionDisplay}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--brand-text-muted)' }}>
                    {tRoles(currentUser.role)}
                  </div>
                </div>

                <Link
                  href="/profile"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--brand-surface-soft)] transition-colors min-h-[44px]"
                  onClick={() => setShowUserMenu(false)}
                >
                  <User className="w-4 h-4" style={{ color: 'var(--brand-text-muted)' }} />
                  <span className="text-sm" style={{ color: 'var(--brand-text)' }}>{t('myProfile')}</span>
                </Link>

                {canAccessPlanning && (
                  <Link
                    href="/planning"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--brand-surface-soft)] transition-colors min-h-[44px]"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <CalendarDays className="w-4 h-4" style={{ color: 'var(--brand-text-muted)' }} />
                    <span className="text-sm" style={{ color: 'var(--brand-text)' }}>{t('planning')}</span>
                  </Link>
                )}

                {currentUser.role === 'admin' && (
                  <>
                    <Link
                      href="/admin/users"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--brand-surface-soft)] transition-colors min-h-[44px]"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <UsersIcon className="w-4 h-4 text-[var(--brand-primary)] dark:text-[var(--brand-primary)]" />
                      <span className="text-sm" style={{ color: 'var(--brand-text)' }}>{t('userManagement')}</span>
                    </Link>

                    <Link
                      href="/admin/settings"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--brand-surface-soft)] transition-colors min-h-[44px]"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Shield className="w-4 h-4 text-[var(--brand-primary)] dark:text-[var(--brand-primary)]" />
                      <span className="text-sm" style={{ color: 'var(--brand-text)' }}>{t('systemSettings')}</span>
                    </Link>

                  </>
                )}

                <div className="border-t mt-2" style={{ borderColor: 'var(--brand-card-border)' }}>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors w-full text-left min-h-[44px]"
                  >
                    <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <span className="text-sm text-red-700 dark:text-red-400">{t('logout')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="px-4 py-2.5 hover:bg-[var(--brand-surface-soft)] rounded-lg transition-colors min-h-[44px] flex items-center" style={{ color: 'var(--brand-text)' }}>
              {t('login')}
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-2.5 brand-button-primary rounded-lg transition-all shadow-lg min-h-[44px] flex items-center"
            >
              {t('register')}
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
