'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { withAdminAuth } from '@/contexts/AuthContext';
import { 
  Users, 
  UserPlus, 
  Edit3, 
  Trash2, 
  Search,
  X,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  UserX,
  Crown,
  User,
  UserCog,
  KeyRound
} from 'lucide-react';

// Demo fallback removed; use cookie/JWT auth via credentials

interface User {
  _id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'moderator' | 'user';
  isActive: boolean;
  isEmailVerified: boolean;
  avatar?: string;
  createdAt: string;
  lastLogin?: string;
}

interface ClubFunctionEntry {
  _id: string;
  name: string;
  isActive: boolean;
  assignedUserId?: string;
}

const PAGE_LIMIT = 10;

const UserManagement = () => {
  const t = useTranslations('admin.users');
  // tCommon removed
  const [users, setUsers] = useState<User[]>([]);
  const [functionNamesByUserId, setFunctionNamesByUserId] = useState<Record<string, string[]>>({});
  // users removed — server-side search handles filtering
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);
  const router = useRouter();

  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0
  });

  const [newUser, setNewUser] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    role: 'user' as 'admin' | 'moderator' | 'user'
  });

  const [editUser, setEditUser] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'user' as 'admin' | 'moderator' | 'user',
    isActive: true,
    isEmailVerified: false
  });

  // Fetch users
  const fetchUsers = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: PAGE_LIMIT.toString(),
        ...(roleFilter !== 'all' && { role: roleFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`/api/users?${params}`, { credentials: 'include' });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push('/auth/login');
          return;
        }
        throw new Error('Fehler beim Laden der Benutzer');
      }

      const data = await response.json();
      setUsers(data.data);
      try {
        const fnResponse = await fetch('/api/club-functions?includeInactive=true', { credentials: 'include' });
        if (fnResponse.ok) {
          const fnPayload = await fnResponse.json();
          const entries: ClubFunctionEntry[] = Array.isArray(fnPayload?.data) ? fnPayload.data : [];
          const map: Record<string, string[]> = {};
          for (const entry of entries) {
            const userId = String(entry.assignedUserId || '').trim();
            const name = String(entry.name || '').trim();
            if (!userId || !name) continue;
            map[userId] = map[userId] || [];
            map[userId].push(name);
          }
          Object.keys(map).forEach((userId) => {
            map[userId] = Array.from(new Set(map[userId])).sort((a, b) => a.localeCompare(b));
          });
          setFunctionNamesByUserId(map);
        }
      } catch {
        setFunctionNamesByUserId({});
      }
      setPagination({
        page: data.pagination.page,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages
      });
      setError('');
    } catch (err: any) {
      setError(err.message || 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter, searchTerm, router]);

  // Debounced server-side search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, roleFilter, statusFilter, fetchUsers]);

  // Initial load
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Create user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newUser)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler beim Erstellen des Benutzers');
      }

      setSuccess('Benutzer erfolgreich erstellt');
      setShowCreateModal(false);
      setNewUser({ email: '', firstName: '', lastName: '', password: '', role: 'user' });
      fetchUsers(pagination.page);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Update user
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setError('');
    setSaving(true);

    try {
      const response = await fetch(`/api/users/${selectedUser._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(editUser)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('messages.updateError'));
      }

      setSuccess(t('messages.updateSuccess'));
      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers(pagination.page);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setError('');
    setSaving(true);

    try {
      const response = await fetch(`/api/users/${selectedUser._id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('messages.deleteError'));
      }

      setSuccess(t('messages.deleteSuccess'));
      setShowDeleteModal(false);
      setSelectedUser(null);
      fetchUsers(pagination.page);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Approve (activate) a pending user
  const handleApproveUser = async (userToApprove: User) => {
    setError('');
    setSaving(true);
    try {
      const response = await fetch(`/api/users/${userToApprove._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: true, isEmailVerified: true })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler beim Freischalten');
      }

      setSuccess(`${userToApprove.firstName} ${userToApprove.lastName} wurde freigeschaltet`);
      fetchUsers(pagination.page);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openPasswordResetModal = (userToReset: User) => {
    setPasswordResetUser(userToReset);
    setShowPasswordResetModal(true);
  };

  const closePasswordResetModal = () => {
    if (saving) return;
    setShowPasswordResetModal(false);
    setPasswordResetUser(null);
  };

  const handleSendPasswordResetEmail = async () => {
    if (!passwordResetUser) return;
    const displayName = getPasswordResetDisplayName(passwordResetUser);

    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const response = await fetch(`/api/users/${passwordResetUser._id}/password-reset`, {
        method: 'POST',
        credentials: 'include',
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || t('messages.passwordResetSendError'));
      }

      setSuccess(payload.message || t('messages.passwordResetSent', { name: displayName }));
      setShowPasswordResetModal(false);
      setPasswordResetUser(null);
    } catch (err: any) {
      setError(err.message || t('messages.passwordResetSendError'));
    } finally {
      setSaving(false);
    }
  };

  // Role icon and color
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'moderator':
        return <UserCog className="w-4 h-4 text-[var(--brand-primary)]" />;
      default:
        return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-yellow-100 text-yellow-800';
      case 'moderator':
        return 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)]';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getFunctionLabel = (userId: string): string => {
    const names = functionNamesByUserId[userId] || [];
    if (names.length === 0) return '';
    return names.join(', ');
  };

  const getUserFullName = (entry: User): string => {
    const fullName = `${entry.firstName || ''} ${entry.lastName || ''}`.trim();
    return fullName || entry.email;
  };

  const getPasswordResetDisplayName = (entry: User): string => {
    return getUserFullName(entry);
  };

  const getUserInitials = (entry: User): string => {
    const first = (entry.firstName || '').trim();
    const last = (entry.lastName || '').trim();

    if (first || last) {
      const initials = `${first.charAt(0)}${last.charAt(0)}`.replace(/\s+/g, '').toUpperCase();
      if (initials.length >= 2) return initials.slice(0, 2);
      if (first.length >= 2) return first.slice(0, 2).toUpperCase();
      if (last.length >= 2) return last.slice(0, 2).toUpperCase();
      return initials || entry.email.slice(0, 1).toUpperCase();
    }

    const emailLocalPart = (entry.email || '').split('@')[0] || '';
    const parts = emailLocalPart
      .split(/[\s._-]+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    const fallback = (parts[0] || emailLocalPart || entry.username || 'U').replace(/[^a-zA-Z0-9]/g, '');
    return fallback.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen brand-page-gradient brandize-admin">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-5">
          <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-start gap-3 mb-2 min-w-0">
            <div className="p-2.5 brand-gradient-bg rounded-xl text-white shadow-lg w-fit shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 leading-tight">{t('title')}</h1>
              <p className="text-slate-600 text-sm break-words mt-1">{t('subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex flex-wrap items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700 min-w-0 flex-1 break-words">{error}</span>
            <button onClick={() => setError('')} className="ml-auto shrink-0 text-red-500 hover:text-red-700 min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg" aria-label="Fehlermeldung schliessen">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex flex-wrap items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span className="text-green-700 min-w-0 flex-1 break-words">{success}</span>
            <button onClick={() => setSuccess('')} className="ml-auto shrink-0 text-green-500 hover:text-green-700 min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg" aria-label="Erfolgsmeldung schliessen">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="mb-4 bg-white/70 backdrop-blur-sm border border-white/50 rounded-xl p-4 shadow-lg">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 min-h-10 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
              />
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2 min-h-10 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
              >
                <option value="all">{t('filters.allRoles')}</option>
                <option value="admin">{t('roles.admin')}</option>
                <option value="moderator">{t('roles.moderator')}</option>
                <option value="user">{t('roles.user')}</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 min-h-10 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
              >
                <option value="all">{t('filters.allStatus')}</option>
                <option value="active">{t('status.active')}</option>
                <option value="inactive">{t('status.inactive')}</option>
                <option value="pending">{t('status.pending')}</option>
              </select>
            </div>

            {/* Create User Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full lg:w-auto px-3.5 py-2 min-h-10 text-sm brand-button-primary rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <UserPlus className="w-4 h-4" />
              {t('actions.create')}
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-xl shadow-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-primary)]"></div>
              <p className="mt-4 text-slate-600">{t('loading')}</p>
            </div>
          ) : (
            <>
              <div className="md:hidden p-3 space-y-2">
                {users.map((user) => (
                  <div key={`mobile-${user._id}`} className="border border-slate-200 rounded-xl p-2.5 bg-white">
                    <div className="flex items-start gap-3">
                      {user.avatar ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={user.avatar}
                          alt={getUserFullName(user)}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 brand-gradient-bg rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0">
                          {getUserInitials(user)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-slate-800 break-words">{getUserFullName(user)}</div>
                        {getFunctionLabel(user._id) && (
                          <div
                            className="text-xs text-slate-500 mt-0.5 truncate"
                            title={getFunctionLabel(user._id)}
                          >
                            {getFunctionLabel(user._id)}
                          </div>
                        )}
                        <div className="text-sm text-slate-800 break-all mt-0.5">{user.email}</div>
                        <div className={`mt-0.5 flex items-center gap-1 text-xs ${user.isEmailVerified ? 'text-green-600' : 'text-orange-600'}`}>
                          {user.isEmailVerified ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {user.isEmailVerified ? t('status.verified') : t('status.unverified')}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-end gap-1.5">
                      {!user.isActive && !user.lastLogin && (
                        <button
                          onClick={() => handleApproveUser(user)}
                          className="p-2 min-h-10 min-w-10 inline-flex items-center justify-center text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
                          title={t('actions.approve')}
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => openPasswordResetModal(user)}
                        disabled={saving || !user.isActive}
                        className="p-2 min-h-10 min-w-10 inline-flex items-center justify-center text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t('actions.sendPasswordReset')}
                        aria-label={t('actions.sendPasswordReset')}
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setEditUser({
                            email: user.email,
                            firstName: user.firstName,
                            lastName: user.lastName,
                            role: user.role,
                            isActive: user.isActive,
                            isEmailVerified: user.isEmailVerified
                          });
                          setShowEditModal(true);
                        }}
                        className="p-2 min-h-10 min-w-10 inline-flex items-center justify-center text-slate-600 hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)] rounded-lg transition-colors"
                        title={t('actions.edit')}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowDeleteModal(true);
                        }}
                        className="p-2 min-h-10 min-w-10 inline-flex items-center justify-center text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={t('actions.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 sm:px-4 py-2.5 text-left text-xs font-semibold text-slate-700">{t('table.user')}</th>
                      <th className="px-3 sm:px-4 py-2.5 text-left text-xs font-semibold text-slate-700">{t('table.email')}</th>
                      <th className="hidden lg:table-cell px-4 py-2.5 text-left text-xs font-semibold text-slate-700">{t('table.role')}</th>
                      <th className="hidden lg:table-cell px-4 py-2.5 text-left text-xs font-semibold text-slate-700">{t('table.status')}</th>
                      <th className="hidden lg:table-cell px-4 py-2.5 text-left text-xs font-semibold text-slate-700">{t('table.created')}</th>
                      <th className="px-3 sm:px-4 py-2.5 text-right text-xs font-semibold text-slate-700">{t('table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {users.map((user) => (
                      <tr key={user._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 sm:px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            {user.avatar ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img 
                                src={user.avatar} 
                                alt={getUserFullName(user)}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 brand-gradient-bg rounded-full flex items-center justify-center text-white font-semibold text-xs">
                                {getUserInitials(user)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-slate-800 break-words">
                                {getUserFullName(user)}
                              </div>
                              {getFunctionLabel(user._id) && (
                                <div
                                  className="text-xs text-slate-500 truncate max-w-[240px]"
                                  title={getFunctionLabel(user._id)}
                                >
                                  {getFunctionLabel(user._id)}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5">
                          <div className="text-slate-800 text-sm break-all">{user.email}</div>
                          {user.isEmailVerified ? (
                            <div className="flex items-center gap-1 text-xs text-green-600 mt-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              {t('status.verified')}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-orange-600 mt-0.5">
                              <AlertCircle className="w-3 h-3" />
                              {t('status.unverified')}
                            </div>
                          )}
                        </td>
                        <td className="hidden lg:table-cell px-4 py-2.5">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${getRoleBadgeColor(user.role)}`}>
                            {getRoleIcon(user.role)}
                            {user.role === 'admin' ? t('roles.admin') : 
                             user.role === 'moderator' ? t('roles.moderator') : t('roles.user')}
                          </div>
                        </td>
                        <td className="hidden lg:table-cell px-4 py-2.5">
                          {user.isActive ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                              <UserCheck className="w-3 h-3" />
                              {t('status.active')}
                            </div>
                          ) : !user.lastLogin ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                              <AlertCircle className="w-3 h-3" />
                              {t('status.pending')}
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                              <UserX className="w-3 h-3" />
                              {t('status.inactive')}
                            </div>
                          )}
                        </td>
                        <td className="hidden lg:table-cell px-4 py-2.5 text-sm text-slate-600">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-right">
                          <div className="flex items-center gap-1.5 justify-end flex-wrap">
                            {!user.isActive && !user.lastLogin && (
                              <>
                                <button
                                  onClick={() => handleApproveUser(user)}
                                  className="sm:hidden p-2 min-h-10 min-w-10 inline-flex items-center justify-center text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
                                  title={t('actions.approve')}
                                >
                                  <UserCheck className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleApproveUser(user)}
                                  className="hidden sm:inline-flex px-2.5 py-1.5 text-xs font-semibold bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors items-center gap-1"
                                  title={t('actions.approve')}
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  {t('actions.approve')}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => openPasswordResetModal(user)}
                              disabled={saving || !user.isActive}
                              className="p-2 min-h-10 min-w-10 md:min-h-9 md:min-w-9 inline-flex items-center justify-center text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={t('actions.sendPasswordReset')}
                              aria-label={t('actions.sendPasswordReset')}
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setEditUser({
                                  email: user.email,
                                  firstName: user.firstName,
                                  lastName: user.lastName,
                                  role: user.role,
                                  isActive: user.isActive,
                                  isEmailVerified: user.isEmailVerified
                                });
                                setShowEditModal(true);
                              }}
                              className="p-2 min-h-10 min-w-10 md:min-h-9 md:min-w-9 inline-flex items-center justify-center text-slate-600 hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)] rounded-lg transition-colors"
                              title={t('actions.edit')}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowDeleteModal(true);
                              }}
                              className="p-2 min-h-10 min-w-10 md:min-h-9 md:min-w-9 inline-flex items-center justify-center text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title={t('actions.delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="text-sm text-slate-600 text-center sm:text-left">
                    {t('pagination.found', { count: pagination.total })}
                  </div>
                  <div className="flex items-center justify-center sm:justify-end flex-wrap gap-2">
                    <button
                      onClick={() => fetchUsers(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="px-3 py-1.5 min-h-10 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('pagination.prev')}
                    </button>
                    <span className="px-3 py-1 text-sm">
                      {t('pagination.pageInfo', { page: pagination.page, total: pagination.totalPages })}
                    </span>
                    <button
                      onClick={() => fetchUsers(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-3 py-1.5 min-h-10 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('pagination.next')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-semibold text-slate-800">{t('modals.create.title')}</h2>
              </div>
              <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                <p className="text-xs text-slate-500 mb-2">Alle Felder sind Pflichtfelder.</p>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{t('fields.email')}</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="w-full px-4 py-2.5 min-h-11 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('fields.firstName')}</label>
                    <input
                      type="text"
                      value={newUser.firstName}
                      onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                      className="w-full px-4 py-2.5 min-h-11 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('fields.lastName')}</label>
                    <input
                      type="text"
                      value={newUser.lastName}
                      onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                      className="w-full px-4 py-2.5 min-h-11 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{t('fields.password')}</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="w-full px-4 py-2.5 min-h-11 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{t('fields.role')}</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value as 'admin' | 'moderator' | 'user'})}
                    className="w-full px-4 py-2.5 min-h-11 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                  >
                    <option value="user">{t('roles.user')}</option>
                    <option value="moderator">{t('roles.moderator')}</option>
                    <option value="admin">{t('roles.admin')}</option>
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="w-full sm:flex-1 px-4 py-2 min-h-11 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                  >
                    {t('actions.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:flex-1 px-4 py-2 min-h-11 brand-button-primary rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Erstelle…' : t('actions.create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditModal && selectedUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-semibold text-slate-800">{t('modals.edit.title')}</h2>
              </div>
              <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{t('fields.email')}</label>
                  <input
                    type="email"
                    value={editUser.email}
                    onChange={(e) => setEditUser({...editUser, email: e.target.value})}
                    className="w-full px-4 py-2.5 min-h-11 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('fields.firstName')}</label>
                    <input
                      type="text"
                      value={editUser.firstName}
                      onChange={(e) => setEditUser({...editUser, firstName: e.target.value})}
                      className="w-full px-4 py-2.5 min-h-11 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('fields.lastName')}</label>
                    <input
                      type="text"
                      value={editUser.lastName}
                      onChange={(e) => setEditUser({...editUser, lastName: e.target.value})}
                      className="w-full px-4 py-2.5 min-h-11 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{t('fields.role')}</label>
                  <select
                    value={editUser.role}
                    onChange={(e) => setEditUser({...editUser, role: e.target.value as 'admin' | 'moderator' | 'user'})}
                    className="w-full px-4 py-2.5 min-h-11 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                  >
                    <option value="user">{t('roles.user')}</option>
                    <option value="moderator">{t('roles.moderator')}</option>
                    <option value="admin">{t('roles.admin')}</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editUser.isActive}
                      onChange={(e) => setEditUser({...editUser, isActive: e.target.checked})}
                      className="w-4 h-4 text-[var(--brand-primary)] border-slate-300 rounded focus:ring-[var(--brand-primary)]"
                    />
                    <span className="text-sm text-slate-700">{t('status.active')}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editUser.isEmailVerified}
                      onChange={(e) => setEditUser({...editUser, isEmailVerified: e.target.checked})}
                      className="w-4 h-4 text-[var(--brand-primary)] border-slate-300 rounded focus:ring-[var(--brand-primary)]"
                    />
                    <span className="text-sm text-slate-700">{t('status.verified')}</span>
                  </label>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="w-full sm:flex-1 px-4 py-2 min-h-11 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                  >
                    {t('actions.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:flex-1 px-4 py-2 min-h-11 brand-button-primary rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Speichere…' : t('actions.update')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete User Modal */}
        {showDeleteModal && selectedUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-semibold text-slate-800">{t('modals.delete.title')}</h2>
              </div>
              <div className="p-6">
                <p className="text-slate-600 mb-6">
                  {t.rich('modals.delete.message', {
                    name: `${selectedUser.firstName} ${selectedUser.lastName}`,
                    strong: (chunks) => <strong>{chunks}</strong>
                  })}
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="w-full sm:flex-1 px-4 py-2 min-h-11 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                  >
                    {t('actions.cancel')}
                  </button>
                  <button
                    onClick={handleDeleteUser}
                    disabled={saving}
                    className="w-full sm:flex-1 px-4 py-2 min-h-11 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? t('actions.deleting') : t('actions.delete')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Password Reset Modal */}
        {showPasswordResetModal && passwordResetUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-slate-800">{t('modals.passwordReset.title')}</h2>
                  <p className="text-sm text-slate-500 mt-1">{t('modals.passwordReset.subtitle')}</p>
                </div>
                <div className="shrink-0 w-10 h-10 rounded-lg bg-sky-100 text-sky-700 inline-flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
              </div>
              <div className="p-6">
                <p className="text-slate-600 mb-4">
                  {t.rich('modals.passwordReset.message', {
                    name: getPasswordResetDisplayName(passwordResetUser),
                    strong: (chunks) => <strong>{chunks}</strong>
                  })}
                </p>
                <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('modals.passwordReset.targetLabel')}</p>
                  <p className="text-sm font-semibold text-slate-800 break-words mt-1">{getPasswordResetDisplayName(passwordResetUser)}</p>
                  <p className="text-sm text-slate-600 break-all">{passwordResetUser.email}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={closePasswordResetModal}
                    disabled={saving}
                    className="w-full sm:flex-1 px-4 py-2 min-h-11 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('actions.cancel')}
                  </button>
                  <button
                    onClick={handleSendPasswordResetEmail}
                    disabled={saving}
                    className="w-full sm:flex-1 px-4 py-2 min-h-11 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    <KeyRound className="w-4 h-4" />
                    {saving ? t('actions.sendingPasswordReset') : t('actions.sendPasswordReset')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default withAdminAuth(UserManagement);
