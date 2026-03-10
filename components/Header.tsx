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
    organizationName: 'NXTMinutes'
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
            organizationName: data.data.system?.organizationName || 'NXTMinutes',
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
              organizationName: adminData.data.systemSettings?.organizationName || 'NXTMinutes',
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
      <div className="w-10 h-10 brand-gradient-bg rounded-xl flex items-center justify-center shadow-lg">
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
          <Image
            src="/logo-mark.svg"
            alt="NXTMinutes"
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
            priority
          />
        )}
      </div>
      <h1 className="text-2xl font-bold brand-gradient-text">
        {settings.organizationName}
      </h1>
      {/* Admin link removed by request */}
    </div>
  );
}
