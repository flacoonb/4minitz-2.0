'use client';

import { useState, useEffect } from 'react';
// useRouter removed
import Link from 'next/link';
import { useTranslations } from 'next-intl';

// Demo fallbacks removed; use cookie/JWT-based auth (credentials included)

interface EmailConfig {
  host: string;
  port: string;
  secure: boolean;
  hasAuth: boolean;
  user: string | null;
  fromEmail: string;
}

export default function EmailConfigPage() {
  const t = useTranslations('admin.email');
  // router removed
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<EmailConfig>({
    host: 'localhost',
    port: '25',
    secure: false,
    hasAuth: false,
    user: null,
    fromEmail: 'noreply@4minitz.local',
  });
  const [isValid, setIsValid] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/email-config', { credentials: 'include' });
        const data = await response.json();

        if (data.success) {
          setConfig(data.config);
          setIsValid(data.isValid);
        } else {
          setResult({ success: false, message: data.error || t('messages.loadError') });
        }
      } catch (_error) {
        setResult({ success: false, message: t('messages.networkError') });
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, [t]);

  const testConnection = async () => {
    try {
      setTesting(true);
      setResult(null);

      const response = await fetch('/api/email/test', { credentials: 'include' });
      const data = await response.json();

      setResult({
        success: data.success,
        message: data.success ? t('messages.testSuccess') : data.error || t('messages.testError'),
      });
      setIsValid(data.success);
    } catch (_error) {
      setResult({ success: false, message: t('messages.testNetworkError') });
      setIsValid(false);
    } finally {
      setTesting(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail) {
      setResult({ success: false, message: t('messages.enterEmail') });
      return;
    }

    try {
      setSendingTest(true);
      setResult(null);

      const response = await fetch('/api/email/send-test', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to: testEmail }),
      });

      const data = await response.json();

      setResult({
        success: data.success,
        message: data.success
          ? t('messages.sendSuccess', { email: testEmail })
          : data.error || t('messages.sendError'),
      });

      if (data.success) {
        setTestEmail('');
      }
    } catch (_error) {
      setResult({ success: false, message: t('messages.sendNetworkError') });
    } finally {
      setSendingTest(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      setResult(null);

      const payload = {
        host: config.host,
        port: parseInt(config.port),
        secure: config.secure,
        user: config.user || undefined,
        password: password || undefined,
        fromEmail: config.fromEmail,
      };

      const response = await fetch('/api/admin/email-config', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: data.message || t('messages.saveSuccess'),
        });
      } else {
        setResult({
          success: false,
          message: data.error || t('messages.saveError'),
        });
      }
    } catch (_error) {
      setResult({ success: false, message: t('messages.saveNetworkError') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            {t('backToAdmin')}
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-600 mt-2">
            {t('subtitle')}
          </p>
        </div>

        {/* Security Warning */}
        <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">{t('security.title')}</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>{t('security.message')}</p>
                <p className="mt-1"><strong>{t('security.measures')}</strong></p>
                <ul className="list-disc list-inside ml-2 mt-1">
                  <li>{t('security.measure1')}</li>
                  <li>{t.rich('security.measure2', { strong: (chunks) => <strong>{chunks}</strong> })}</li>
                  <li>{t.rich('security.measure3', { code: (chunks) => <code className="bg-yellow-100 px-1 rounded">{chunks}</code> })}</li>
                  <li>{t('security.measure4')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Current Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{t('status.title')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-600">{t('status.connection')}</span>
              <span className={`ml-2 px-2 py-1 rounded text-sm ${
                isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {isValid ? t('status.working') : t('status.notTested')}
              </span>
            </div>
            <div>
              <span className="text-gray-600">{t('status.auth')}</span>
              <span className="ml-2 text-gray-900">
                {config.hasAuth ? t('status.enabled') : t('status.disabled')}
              </span>
            </div>
            <div>
              <span className="text-gray-600">{t('status.host')}</span>
              <span className="ml-2 text-gray-900 font-mono">{config.host}:{config.port}</span>
            </div>
            <div>
              <span className="text-gray-600">{t('status.encryption')}</span>
              <span className="ml-2 text-gray-900">{config.secure ? t('status.ssl') : t('status.none')}</span>
            </div>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{t('settings.title')}</h2>
          
          <div className="space-y-4">
            {/* Provider Quick Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('settings.quickSelect')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setConfig({
                      ...config,
                      host: 'smtp.gmail.com',
                      port: '587',
                      secure: false,
                      hasAuth: true,
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  {t('settings.providers.gmail')}
                </button>
                <button
                  onClick={() => {
                    setConfig({
                      ...config,
                      host: 'smtp-mail.outlook.com',
                      port: '587',
                      secure: false,
                      hasAuth: true,
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  {t('settings.providers.outlook')}
                </button>
                <button
                  onClick={() => {
                    setConfig({
                      ...config,
                      host: 'localhost',
                      port: '25',
                      secure: false,
                      hasAuth: false,
                      user: null,
                    });
                    setPassword('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  {t('settings.providers.local')}
                </button>
                <button
                  onClick={() => {
                    setConfig({
                      ...config,
                      host: 'localhost',
                      port: '1025',
                      secure: false,
                      hasAuth: false,
                      user: null,
                    });
                    setPassword('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  {t('settings.providers.mailhog')}
                </button>
              </div>
            </div>

            {/* Host */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('settings.host')}
              </label>
              <input
                type="text"
                value={config.host}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                placeholder="smtp.gmail.com"
              />
            </div>

            {/* Port */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('settings.port')}
              </label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                placeholder="587"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('settings.portHelp')}
              </p>
            </div>

            {/* Secure */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="secure"
                checked={config.secure}
                onChange={(e) => setConfig({ ...config, secure: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="secure" className="ml-2 block text-sm text-gray-700">
                {t('settings.secure')}
              </label>
            </div>

            {/* From Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('settings.fromEmail')}
              </label>
              <input
                type="email"
                value={config.fromEmail}
                onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                placeholder="noreply@protokoll-app.local"
              />
            </div>

            {/* Auth Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="hasAuth"
                checked={config.hasAuth}
                onChange={(e) => {
                  setConfig({ ...config, hasAuth: e.target.checked });
                  if (!e.target.checked) {
                    setConfig({ ...config, hasAuth: false, user: null });
                    setPassword('');
                  }
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="hasAuth" className="ml-2 block text-sm text-gray-700">
                {t('settings.auth')}
              </label>
            </div>

            {/* Username */}
            {config.hasAuth && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('settings.username')}
                </label>
                <input
                  type="text"
                  value={config.user || ''}
                  onChange={(e) => setConfig({ ...config, user: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="deine-email@example.com"
                />
              </div>
            )}

            {/* Password */}
            {config.hasAuth && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('settings.password')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder={t('settings.passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t.rich('settings.gmailHelp', {
                    link: (chunks) => (
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {chunks}
                      </a>
                    )
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex gap-4">
            <button
              onClick={saveConfig}
              disabled={saving}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? t('actions.validating') : t('actions.validate')}
            </button>
            <button
              onClick={testConnection}
              disabled={testing}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {testing ? t('actions.testing') : t('actions.test')}
            </button>
          </div>
        </div>

        {/* Test Email Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{t('testEmail.title')}</h2>
          <p className="text-gray-600 mb-4">
            {t('testEmail.description')}
          </p>
          <div className="flex gap-4">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={sendTestEmail}
              disabled={sendingTest || !testEmail}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {sendingTest ? t('actions.sending') : t('actions.send')}
            </button>
          </div>
        </div>

        {/* Result Message */}
        {result && (
          <div
            className={`p-4 rounded-lg ${
              result.success ? 'bg-green-50 text-green-800 border-l-4 border-green-400' : 'bg-red-50 text-red-800 border-l-4 border-red-400'
            }`}
          >
            {result.message}
          </div>
        )}

        {/* Debug: Raw loaded config (visible for admins to troubleshoot) */}
        <div className="mt-4 bg-gray-50 border border-gray-200 p-4 rounded">
          <h3 className="text-sm font-medium text-gray-700 mb-2">{t('debug.title')}</h3>
          <pre className="text-xs text-gray-800 overflow-auto bg-white p-2 rounded" style={{ maxHeight: 200 }}>
            {JSON.stringify({ config, isValid, result: result || null }, null, 2)}
          </pre>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded mt-6">
          <h3 className="text-sm font-medium text-blue-800 mb-2">{t('manual.title')}</h3>
          <p className="text-sm text-blue-700 mb-2">
            {t('manual.description')}
          </p>
          <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1 ml-2">
            <li>{t.rich('manual.step1', { code: (chunks) => <code className="bg-blue-100 px-1 rounded">{chunks}</code> })}</li>
            <li>{t.rich('manual.step2', { code: (chunks) => <code className="bg-blue-100 px-1 rounded">{chunks}</code> })}</li>
            <li>{t.rich('manual.step3', { code: (chunks) => <code className="bg-blue-100 px-1 rounded">{chunks}</code> })}</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
