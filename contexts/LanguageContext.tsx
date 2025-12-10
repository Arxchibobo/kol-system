import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Language, translations } from '../translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en'); // 默认使用英文

  const t = (path: string, params?: Record<string, string | number>): string => {
    const keys = path.split('.');
    let value: any = translations[language];
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key as keyof typeof value];
      } else {
        return path; // Fallback to key if not found
      }
    }

    if (typeof value !== 'string') return path;

    // Replace params like ${rate} or {count}
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        // Handle ${key} format
        value = value.replace(`\${${k}}`, String(v));
        // Handle {key} format
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }

    return value;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};