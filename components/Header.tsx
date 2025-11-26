"use client";

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
// import Link from 'next/link';

interface SystemSettings {
  organizationName?: string;
  organizationLogo?: string;
}

export default function Header() {
  const [settings, setSettings] = useState<SystemSettings>({
    organizationName: '4Minitz'
  });

  // Fetch system settings
  const fetchSettings = useCallback(async () => {
    try {
      // Try to fetch settings, but don't require admin permissions for public settings
      const response = await fetch('/api/settings/public', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setSettings({
            organizationName: data.data.system?.organizationName || '4Minitz',
            organizationLogo: data.data.system?.organizationLogo
          });
        }
      } else {
        // Fallback: Try admin settings if user is admin
        const adminResponse = await fetch('/api/admin/settings', {
          credentials: 'include'
        });
        
        if (adminResponse.ok) {
          const adminData = await adminResponse.json();
          if (adminData.success && adminData.data) {
            setSettings({
              organizationName: adminData.data.systemSettings?.organizationName || '4Minitz',
              organizationLogo: adminData.data.systemSettings?.organizationLogo
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSettings();

    // Listen for settings updates
    const handleSettingsUpdate = () => {
      fetchSettings();
    };

    // Custom event for settings updates
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    
    // Periodic refresh every 30 seconds for settings updates
    const interval = setInterval(fetchSettings, 30000);

    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
      clearInterval(interval);
    };
  }, [fetchSettings]);

  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
        {settings.organizationLogo ? (
          <Image 
            src={settings.organizationLogo} 
            alt="Logo" 
            width={32}
            height={32}
            className="w-8 h-8 object-contain rounded-lg"
            unoptimized
          />
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </div>
      <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
        {settings.organizationName}
      </h1>
      {/* Admin link removed by request */}
    </div>
  );
}