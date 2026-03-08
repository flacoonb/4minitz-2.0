'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  UserPlus,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Check
} from 'lucide-react';

const RegisterPage = () => {
  const t = useTranslations('auth.register');
  const tErrors = useTranslations('errors');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (error) setError('');

    // Check password strength
    if (name === 'password') {
      setPasswordStrength({
        length: value.length >= 8,
        uppercase: /[A-Z]/.test(value),
        lowercase: /[a-z]/.test(value),
        number: /\d/.test(value),
        special: /[!@#$%^&*(),.?":\{\}|<>]/.test(value)
      });
    }
  };

  const validateForm = () => {
    if (!formData.username.trim()) {
      setError(tErrors('required'));
      return false;
    }

    if (!formData.email.trim()) {
      setError(tErrors('required'));
      return false;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError(tErrors('invalidEmail'));
      return false;
    }

    if (!formData.firstName.trim()) {
      setError(tErrors('required'));
      return false;
    }

    if (!formData.lastName.trim()) {
      setError(tErrors('required'));
      return false;
    }

    if (formData.password.length < 8) {
      setError(t('requirements.minLength'));
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t('requirements.minLength'));
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      const { confirmPassword: _confirmPassword, ...submitData } = formData;

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || tErrors('registrationError'));
      }

      // Show server-provided message (includes info about verification/approval)
      setSuccess(data.message || tErrors('registrationSuccess'));

      // Only auto-redirect if no approval is needed
      if (!data.requiresApproval) {
        setTimeout(() => {
          router.push('/auth/login');
        }, 3000);
      }

    } catch (err: any) {
      setError(err.message || tErrors('generic'));
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrengthScore = () => {
    return Object.values(passwordStrength).filter(Boolean).length;
  };

  const getPasswordStrengthColor = () => {
    const score = getPasswordStrengthScore();
    if (score < 2) return 'bg-red-500';
    if (score < 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">{t('title')}</h1>
          <p className="text-slate-600">{t('subtitle')}</p>
        </div>

        {/* Registration Form */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl shadow-xl p-8">
          {/* Alerts */}
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

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-slate-700 mb-2">
                {t('usernameLabel')}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white/50"
                  placeholder={t('usernamePlaceholder')}
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                {t('emailLabel')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white/50"
                  placeholder={t('emailPlaceholder')}
                  required
                />
              </div>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-semibold text-slate-700 mb-2">
                  {t('firstNameLabel')}
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white/50"
                  placeholder={t('firstNamePlaceholder')}
                  required
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-semibold text-slate-700 mb-2">
                  {t('lastNameLabel')}
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white/50"
                  placeholder={t('lastNamePlaceholder')}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
                {t('passwordLabel')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-12 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white/50"
                  placeholder={t('passwordPlaceholder')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 bg-slate-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getPasswordStrengthColor()}`}
                        style={{ width: `${(getPasswordStrengthScore() / 5) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-slate-600">
                      {getPasswordStrengthScore()}/5
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`flex items-center gap-1 ${passwordStrength.length ? 'text-green-600' : 'text-slate-400'}`}>
                      <Check className="w-3 h-3" />
                      {t('requirements.minLength')}
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.uppercase ? 'text-green-600' : 'text-slate-400'}`}>
                      <Check className="w-3 h-3" />
                      {t('requirements.uppercase')}
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.lowercase ? 'text-green-600' : 'text-slate-400'}`}>
                      <Check className="w-3 h-3" />
                      {t('requirements.lowercase')}
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.number ? 'text-green-600' : 'text-slate-400'}`}>
                      <Check className="w-3 h-3" />
                      {t('requirements.number')}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-700 mb-2">
                {t('confirmPasswordLabel')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full pl-12 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white/50"
                  placeholder={t('confirmPasswordPlaceholder')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="mt-2 text-xs text-red-600">{tErrors('validationError')}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {t('registering')}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  {t('registerButton')}
                </div>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-8 pt-6 border-t border-slate-200 text-center">
            <p className="text-slate-600 text-sm">
              {t('alreadyHaveAccount')}{' '}
              <Link
                href="/auth/login"
                className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                {t('loginNow')}
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            © Copyright by Bph
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;