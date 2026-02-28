'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Lock, AlertCircle, CheckCircle2, Check } from 'lucide-react';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams?.get('token') || '', [searchParams]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({
    length: false, uppercase: false, lowercase: false, number: false, special: false,
  });

  const updatePasswordStrength = (pw: string) => {
    setPasswordStrength({
      length: pw.length >= 8,
      uppercase: /[A-Z]/.test(pw),
      lowercase: /[a-z]/.test(pw),
      number: /[0-9]/.test(pw),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pw),
    });
  };

  const strengthScore = Object.values(passwordStrength).filter(Boolean).length;
  const strengthColor = strengthScore <= 1 ? 'bg-red-500' : strengthScore <= 2 ? 'bg-orange-500' : strengthScore <= 3 ? 'bg-yellow-500' : strengthScore <= 4 ? 'bg-lime-500' : 'bg-green-500';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Token fehlt oder ist ungültig.');
      return;
    }

    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || 'Ein Fehler ist aufgetreten');
        return;
      }

      setSuccess('Passwort wurde aktualisiert. Sie können sich jetzt anmelden.');
      setPassword('');
      setConfirmPassword('');
    } catch {
      setError('Netzwerkfehler. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Passwort zurücksetzen</h1>
          <p className="text-slate-600">Setzen Sie ein neues Passwort.</p>
        </div>

        <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl shadow-xl p-8">
          {!token && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 text-sm">Token fehlt oder ist ungültig.</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-green-700 text-sm">{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
                Neues Passwort
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); updatePasswordStrength(e.target.value); }}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white/50"
                placeholder="Mindestens 8 Zeichen"
                required
                disabled={!token}
              />
              {password && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 bg-slate-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${strengthColor}`}
                        style={{ width: `${(strengthScore / 5) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-slate-600">{strengthScore}/5</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`flex items-center gap-1 ${passwordStrength.length ? 'text-green-600' : 'text-slate-400'}`}>
                      <Check className="w-3 h-3" /> 8+ Zeichen
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.uppercase ? 'text-green-600' : 'text-slate-400'}`}>
                      <Check className="w-3 h-3" /> Grossbuchstabe
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.lowercase ? 'text-green-600' : 'text-slate-400'}`}>
                      <Check className="w-3 h-3" /> Kleinbuchstabe
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.number ? 'text-green-600' : 'text-slate-400'}`}>
                      <Check className="w-3 h-3" /> Zahl
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.special ? 'text-green-600' : 'text-slate-400'} col-span-2`}>
                      <Check className="w-3 h-3" /> Sonderzeichen (!@#$%^&*)
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-700 mb-2">
                Passwort bestätigen
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white/50 ${confirmPassword && confirmPassword !== password ? 'border-red-300' : 'border-slate-200'}`}
                placeholder="Nochmals eingeben"
                required
                disabled={!token}
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="text-xs text-red-500 mt-1">Passwörter stimmen nicht überein</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-3 px-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {loading ? 'Speichern…' : 'Passwort setzen'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200 text-center">
            <Link
              href="/auth/login"
              className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors text-sm"
            >
              Zum Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
