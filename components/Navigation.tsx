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

  const canAccessPlanning = Boolean(
    currentUser &&
      (currentUser.role === 'admin' ||
        currentUser.role === 'moderator' ||
        hasPermission('canCreateMeetings'))
  );

  const navItems = [
    { href: '/dashboard', label: t('dashboard'), icon: 'dashboard' },
    { href: '/meeting-series', label: t('meetingSeries'), icon: 'series' },
    { href: '/tasks', label: t('tasks'), icon: 'tasks' },
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
            className="p-2.5 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-white/80 dark:hover:bg-slate-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* Mobile Dropdown Menu */}
          {mobileMenuOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 mx-4 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50 max-h-[70vh] overflow-y-auto">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 text-base font-medium transition-colors ${isActive(item.href)
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-l-4 border-blue-600'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                >
                  {item.label}
                </Link>
              ))}

              {canAccessRoute('admin') && (
                <>
                  <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                  {adminItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-4 py-3 text-base font-medium transition-colors ${isActive(item.href)
                        ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-l-4 border-purple-600'
                        : 'text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-700'
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
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/50'
                : 'text-gray-700 dark:text-gray-200 hover:bg-white/80 dark:hover:bg-slate-700 hover:shadow-md'
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

          {/* Admin Navigation */}
          {canAccessRoute('admin') && (
            <>
              {adminItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative px-4 py-2.5 rounded-xl font-medium transition-all duration-200 min-h-[44px] flex items-center min-w-0 ${isActive(item.href)
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50'
                    : 'text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-700 hover:shadow-md border border-purple-200 dark:border-purple-700'
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
          <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
        ) : currentUser ? (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-md hover:shadow-lg min-h-[44px]"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {(currentUser.firstName && currentUser.firstName[0] ? currentUser.firstName[0].toUpperCase() : '') ||
                 (currentUser.username && currentUser.username[0] ? currentUser.username[0].toUpperCase() : '?')}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {currentUser.firstName || ''} {currentUser.lastName || ''}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {tRoles(currentUser.role)}
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-600 dark:text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {currentUser.firstName} {currentUser.lastName}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">@{currentUser.username}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {tRoles(currentUser.role)}
                  </div>
                </div>

                <Link
                  href="/profile"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors min-h-[44px]"
                  onClick={() => setShowUserMenu(false)}
                >
                  <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{t('myProfile')}</span>
                </Link>

                {canAccessPlanning && (
                  <Link
                    href="/planning"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors min-h-[44px]"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <CalendarDays className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{t('planning')}</span>
                  </Link>
                )}

                {currentUser.role === 'admin' && (
                  <>
                    <Link
                      href="/admin/users"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors min-h-[44px]"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <UsersIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{t('userManagement')}</span>
                    </Link>

                    <Link
                      href="/admin/settings"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors min-h-[44px]"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{t('systemSettings')}</span>
                    </Link>

                  </>
                )}

                <div className="border-t border-slate-200 dark:border-slate-700 mt-2">
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
            <Link
              href="/auth/login"
              className="px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-700 rounded-lg transition-colors min-h-[44px] flex items-center"
            >
              {t('login')}
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg min-h-[44px] flex items-center"
            >
              {t('register')}
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
