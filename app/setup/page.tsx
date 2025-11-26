"use client";
import React, { useEffect, useState } from 'react';
import {
  Database,
  User,
  Building,
  Mail,
  Shield,
  Check,
  Loader2,
  Server,
  Lock,
  AtSign,
  UserCircle
} from 'lucide-react';

export default function SetupPage() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    // Admin
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    username: '',
    // Organization
    organizationName: '',
    // Database
    mongoUri: 'mongodb://localhost:27017/4minitz',
    // SMTP
    smtpHost: 'localhost',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    smtpFrom: 'noreply@4minitz.local'
  });
  const [setupToken, setSetupToken] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/setup')
      .then((r) => r.json())
      .then((j) => setNeedsSetup(j.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  if (needsSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-slate-600">Lade Systemstatus...</p>
        </div>
      </div>
    );
  }

  if (!needsSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Einrichtung abgeschlossen</h1>
          <p className="text-slate-600 mb-8">
            Das System wurde bereits erfolgreich eingerichtet.
          </p>
          <a
            href="/auth/login"
            className="inline-flex items-center justify-center w-full px-6 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Zum Login
          </a>
        </div>
      </div>
    );
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(setupToken ? { 'x-setup-token': setupToken } : {}) },
        body: JSON.stringify({
          admin: {
            email: form.email,
            password: form.password,
            firstName: form.firstName,
            lastName: form.lastName,
            username: form.username
          },
          systemSettings: {
            organizationName: form.organizationName
          },
          mongoUri: form.mongoUri,
          smtpSettings: {
            host: form.smtpHost,
            port: Number(form.smtpPort),
            secure: form.smtpSecure,
            auth: {
              user: form.smtpUser,
              pass: form.smtpPass
            },
            from: form.smtpFrom
          },
          token: setupToken
        })
      });
      const json = await res.json();
      if (!json.success) {
        setMessage(json.error || 'Fehler beim Einrichten');
      } else {
        setMessage('Ersteinrichtung erfolgreich. Bitte anmelden.');
        setNeedsSetup(false);
      }
    } catch (err) {
      setMessage('Serverfehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">
            Willkommen bei 4Minitz 2.0
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Bitte konfigurieren Sie die grundlegenden Systemeinstellungen und erstellen Sie den ersten Administrator-Account.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-8">
          {/* Database Section */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Database className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Datenbank Verbindung</h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  MongoDB URI
                </label>
                <div className="relative">
                  <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    name="mongoUri"
                    value={form.mongoUri}
                    onChange={onChange}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    placeholder="mongodb://localhost:27017/4minitz"
                  />
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Standard: mongodb://localhost:27017/4minitz
                </p>
              </div>
            </div>
          </div>

          {/* Admin Section */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <User className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Administrator Account</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Vorname</label>
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={onChange}
                    required
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nachname</label>
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={onChange}
                    required
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">E-Mail Adresse</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    name="email"
                    value={form.email}
                    onChange={onChange}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Passwort</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={onChange}
                    required
                    minLength={8}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    placeholder="Mindestens 8 Zeichen"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Benutzername <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    name="username"
                    value={form.username}
                    onChange={onChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Organization Section */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Building className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Organisation</h2>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Name der Organisation <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                name="organizationName"
                value={form.organizationName}
                onChange={onChange}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="z.B. Meine Firma GmbH"
              />
            </div>
          </div>

          {/* SMTP Section */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Mail className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">E-Mail Konfiguration (SMTP)</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Host</label>
                  <input
                    name="smtpHost"
                    value={form.smtpHost}
                    onChange={onChange}
                    required
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Port</label>
                  <input
                    name="smtpPort"
                    type="number"
                    value={form.smtpPort}
                    onChange={onChange}
                    required
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="smtpSecure"
                  name="smtpSecure"
                  checked={form.smtpSecure}
                  onChange={onChange}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="smtpSecure" className="text-sm text-slate-700 font-medium select-none cursor-pointer">
                  Sichere Verbindung verwenden (SSL/TLS)
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Benutzer <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      name="smtpUser"
                      value={form.smtpUser}
                      onChange={onChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Passwort <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      name="smtpPass"
                      type="password"
                      value={form.smtpPass}
                      onChange={onChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Absender-Adresse</label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    name="smtpFrom"
                    value={form.smtpFrom}
                    onChange={onChange}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Shield className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Sicherheit</h2>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Setup Token
              </label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  name="setupToken"
                  value={setupToken}
                  onChange={(e) => setSetupToken(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-mono text-sm"
                  placeholder="Token aus .setup_token Datei"
                />
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Dieses Token finden Sie in der Datei <code>.setup_token</code> im Projektverzeichnis.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="sticky bottom-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-lg shadow-xl shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 focus:ring-4 focus:ring-blue-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  System wird eingerichtet...
                </>
              ) : (
                <>
                  <Check className="w-6 h-6" />
                  System einrichten
                </>
              )}
            </button>
          </div>
        </form>

        {message && (
          <div className={`mt-8 p-4 rounded-xl flex items-center gap-3 ${message.includes('erfolgreich')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
            {message.includes('erfolgreich') ? (
              <Check className="w-5 h-5 shrink-0" />
            ) : (
              <Shield className="w-5 h-5 shrink-0" />
            )}
            <p className="font-medium">{message}</p>
          </div>
        )}

        <div className="mt-12 text-center text-sm text-slate-500">
          <p>Diese Seite ist nur für die erste Einrichtung gedacht und kann danach entfernt werden.</p>
        </div>
      </div>
    </div>
  );
}
