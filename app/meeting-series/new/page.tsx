"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface Member {
  userId: string;
}

interface User {
  _id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'moderator' | 'user';
}

export default function NewMeetingSeriesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    project: '',
    name: '',
    description: '',
    participants: [] as string[],
    informedUsers: [] as string[],
    members: [] as Member[],
  });
  
  // Users list
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  
  // Input states for adding participants/informed users (kept for backward compatibility)
  const [newParticipant, setNewParticipant] = useState('');
  const [newInformedUser, setNewInformedUser] = useState('');

  // Check permissions
  useEffect(() => {
    if (!authLoading && (!user || user.role === 'user')) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && user.role !== 'user') {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users?limit=1000', {
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        setAllUsers(result.data || []);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Benutzer:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getUserById = (userId: string): User | undefined => {
    return allUsers.find(u => u._id === userId);
  };

  const _getUserDisplayName = (userId: string): string => {
    const user = getUserById(userId);
    return user ? `${user.firstName} ${user.lastName}` : userId;
  };

  const addMember = () => {
    if (selectedUserId && !formData.members.some(m => m.userId === selectedUserId)) {
      setFormData(prev => ({
        ...prev,
        members: [...prev.members, { userId: selectedUserId }]
      }));
      setSelectedUserId('');
    }
  };

  const removeMember = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.filter(m => m.userId !== userId)
    }));
  };

  const addParticipant = () => {
    if (newParticipant.trim() && !formData.participants.includes(newParticipant.trim())) {
      setFormData(prev => ({
        ...prev,
        participants: [...prev.participants, newParticipant.trim()]
      }));
      setNewParticipant('');
    }
  };

  const removeParticipant = (participant: string) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p !== participant)
    }));
  };

  const addInformedUser = () => {
    if (newInformedUser.trim() && !formData.informedUsers.includes(newInformedUser.trim())) {
      setFormData(prev => ({
        ...prev,
        informedUsers: [...prev.informedUsers, newInformedUser.trim()]
      }));
      setNewInformedUser('');
    }
  };

  const removeInformedUser = (user: string) => {
    setFormData(prev => ({
      ...prev,
      informedUsers: prev.informedUsers.filter(u => u !== user)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/meeting-series', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Use cookies for authentication
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create meeting series');
      }

      const result = await response.json();
      
      // Redirect to the new meeting series
      router.push(`/meeting-series/${result.data._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect will happen in useEffect if user is not authorized
  if (!user || user.role === 'user') {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/meeting-series"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium mb-6 hover:scale-105 transition-all"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Zurück zu Sitzungsserien
        </Link>

        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-8 border border-blue-100">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Neue Sitzungsserie
              </h1>
              <p className="text-lg text-blue-700 font-medium mt-1">
                Erstelle eine neue Serie für regelmäßige Meetings
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Fehler beim Erstellen</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Form */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-100 shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-2">
                Projekt *
              </label>
              <input
                type="text"
                id="project"
                name="project"
                value={formData.project}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="z.B. IT-Projekt Alpha"
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Serie Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="z.B. Wöchentliches Standup"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Beschreibung
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              placeholder="Kurze Beschreibung der Sitzungsserie..."
            />
          </div>

          {/* Members - New Selection from Registered Users */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mitglieder
            </label>
            <div className="space-y-3">
              <div className="flex gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">-- Benutzer auswählen --</option>
                  {allUsers
                    .filter(user => !formData.members.some(m => m.userId === user._id))
                    .map(user => (
                      <option key={user._id} value={user._id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </option>
                    ))
                  }
                </select>
                <button
                  type="button"
                  onClick={addMember}
                  disabled={!selectedUserId}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>
              
              {formData.members.length > 0 && (
                <div className="space-y-2">
                  {formData.members.map((member) => {
                    const user = getUserById(member.userId);
                    return (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold">
                            {user ? user.firstName.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {user ? `${user.firstName} ${user.lastName}` : member.userId}
                            </p>
                            {user && (
                              <p className="text-sm text-gray-600">{user.email}</p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMember(member.userId)}
                          className="text-red-600 hover:bg-red-100 rounded-full p-2 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Participants */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Teilnehmer
            </label>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addParticipant())}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="E-Mail oder Name des Teilnehmers"
                />
                <button
                  type="button"
                  onClick={addParticipant}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>
              
              {formData.participants.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.participants.map((participant, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                    >
                      <span>{participant}</span>
                      <button
                        type="button"
                        onClick={() => removeParticipant(participant)}
                        className="hover:bg-blue-200 rounded-full p-1 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Informed Users */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Informierte Benutzer
              <span className="text-gray-500 text-xs ml-2">(erhalten Benachrichtigungen)</span>
            </label>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newInformedUser}
                  onChange={(e) => setNewInformedUser(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInformedUser())}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="E-Mail oder Name"
                />
                <button
                  type="button"
                  onClick={addInformedUser}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>
              
              {formData.informedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.informedUsers.map((user, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm"
                    >
                      <span>{user}</span>
                      <button
                        type="button"
                        onClick={() => removeInformedUser(user)}
                        className="hover:bg-green-200 rounded-full p-1 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-4 pt-6 border-t">
            <button
              type="submit"
              disabled={loading || !formData.project || !formData.name}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Erstelle Serie...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Serie erstellen</span>
                </div>
              )}
            </button>

            <Link
              href="/meeting-series"
              className="px-8 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Abbrechen
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
