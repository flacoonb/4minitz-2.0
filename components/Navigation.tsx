'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';
import {
  User,
  LogOut,
  Shield,
  ChevronDown,
  Users as UsersIcon
} from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user: currentUser, loading, logout, hasPermission } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('nav');
  const tRoles = useTranslations('admin.users.roles');

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const navItems = [
    { href: '/dashboard', label: t('dashboard'), icon: 'dashboard' },
    ...(hasPermission('canCreateMeetings') ? [{ href: '/meeting-series', label: t('meetingSeries'), icon: 'series' }] : []),
    { href: '/minutes', label: t('minutes'), icon: 'minutes' },
  ];

  const adminItems = [
    { href: '/admin', label: t('adminDashboard'), icon: 'admin-dashboard' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
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
      {/* Main Navigation - Only show when user is logged in */}
      {currentUser && !loading ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ${isActive(item.href)
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/50'
                : 'text-gray-700 hover:bg-white/80 hover:shadow-md'
                }`}
            >
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap">{item.label}</span>
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
                  className={`group relative px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ${isActive(item.href)
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50'
                    : 'text-purple-700 hover:bg-purple-50 hover:shadow-md border border-purple-200'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap">{item.label}</span>
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
              className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/80 hover:bg-white transition-all shadow-md hover:shadow-lg"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {(currentUser.firstName && currentUser.firstName[0] ? currentUser.firstName[0].toUpperCase() : '') || 
                 (currentUser.username && currentUser.username[0] ? currentUser.username[0].toUpperCase() : '?')}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-semibold text-slate-800">
                  {currentUser.firstName || ''} {currentUser.lastName || ''}
                </div>
                <div className="text-xs text-slate-500">
                  {tRoles(currentUser.role)}
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                <div className="px-4 py-3 border-b border-slate-200">
                  <div className="font-semibold text-slate-800">
                    {currentUser.firstName} {currentUser.lastName}
                  </div>
                  <div className="text-sm text-slate-500">@{currentUser.username}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {tRoles(currentUser.role)}
                  </div>
                </div>

                <Link
                  href="/profile"
                  className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 transition-colors"
                  onClick={() => setShowUserMenu(false)}
                >
                  <User className="w-4 h-4 text-slate-600" />
                  <span className="text-sm text-slate-700">{t('myProfile')}</span>
                </Link>

                {currentUser.role === 'admin' && (
                  <>
                    <Link
                      href="/admin/users"
                      className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <UsersIcon className="w-4 h-4 text-purple-600" />
                      <span className="text-sm text-slate-700">{t('userManagement')}</span>
                    </Link>

                    <Link
                      href="/admin/settings"
                      className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Shield className="w-4 h-4 text-purple-600" />
                      <span className="text-sm text-slate-700">{t('systemSettings')}</span>
                    </Link>
                  </>
                )}

                <div className="border-t border-slate-200 mt-2">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-red-50 transition-colors w-full text-left"
                  >
                    <LogOut className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-700">{t('logout')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-slate-700 hover:bg-white/80 rounded-lg transition-colors"
            >
              {t('login')}
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
            >
              {t('register')}
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
