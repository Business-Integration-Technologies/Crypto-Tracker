import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// English translations
const en = {
  translation: {
    // Dashboard
    'CryptoAlert Dashboard': 'CryptoAlert Dashboard',
    'Live Data': 'Live Data',
    'Disconnected': 'Disconnected',
    'Connected to real-time data': 'Connected to real-time data',
    'Disconnected from real-time data': 'Disconnected from real-time data',
    'Light mode enabled': 'Light mode enabled',
    'Dark mode enabled': 'Dark mode enabled',
    'Language changed': 'Language changed',
    'Sound disabled': 'Sound disabled',
    'Sound enabled': 'Sound enabled',
    'Tutorial completed': 'Tutorial completed',
    
    // Controls
    'Select Cryptocurrency': 'Select Cryptocurrency',
    'Time Range': 'Time Range',
    'Export Chart': 'Export Chart',
    '1 Day': '1 Day',
    '7 Days': '7 Days',
    '30 Days': '30 Days',
    '90 Days': '90 Days',
    '1 Year': '1 Year',
    
    // Tooltips
    'Disable Sound': 'Disable Sound',
    'Enable Sound': 'Enable Sound',
    'Toggle Theme': 'Toggle Theme',
    'Toggle Language': 'Toggle Language',
    'Tutorial': 'Tutorial',
    
    // Charts
    'Price History': 'Price History',
    'Volume Analysis': 'Volume Analysis',
    'Market Dominance': 'Market Dominance',
    'Candlestick Chart': 'Candlestick Chart',
    'Price': 'Price',
    'Date': 'Date',
    
    // Features
    'Alert History': 'Alert History',
    'Portfolio Summary': 'Portfolio Summary',
    'Total Value': 'Total Value',
    '24h Change': '24h Change',
    'P&L': 'P&L',
    
    // Tutorial
    'Welcome to CryptoAlert Dashboard': 'Welcome to CryptoAlert Dashboard',
    'This tutorial will guide you through the main features of your crypto dashboard.': 'This tutorial will guide you through the main features of your crypto dashboard.',
    'Real-time Data & Charts': 'Real-time Data & Charts',
    'Monitor live cryptocurrency prices with interactive charts and multiple visualization options.': 'Monitor live cryptocurrency prices with interactive charts and multiple visualization options.',
    'Alerts & Portfolio': 'Alerts & Portfolio',
    'Set up price alerts and track your portfolio performance with detailed analytics.': 'Set up price alerts and track your portfolio performance with detailed analytics.',
    'Next': 'Next',
    'Finish': 'Finish',
    
    // Messages
    'Failed to load crypto data': 'Failed to load crypto data',
    'Chart exported successfully': 'Chart exported successfully',
    'Export failed': 'Export failed',
    
    // Alert types
    'price_above': 'Price Above',
    'price_below': 'Price Below'
  }
};

// Urdu translations
const ur = {
  translation: {
    // Dashboard
    'CryptoAlert Dashboard': 'کرپٹو الرٹ ڈیش بورڈ',
    'Live Data': 'لائیو ڈیٹا',
    'Disconnected': 'منقطع',
    'Connected to real-time data': 'ڈیٹا سے جڑ گئے',
    'Disconnected from real-time data': 'ڈیٹا سے رابطہ منقطع',
    'Light mode enabled': 'روشن موڈ فعال',
    'Dark mode enabled': 'تاریک موڈ فعال',
    'Language changed': 'زبان تبدیل کر دی گئی',
    'Sound disabled': 'آواز بند کر دی گئی',
    'Sound enabled': 'آواز آن کر دی گئی',
    'Tutorial completed': 'ٹیوٹوریل مکمل',
    
    // Controls
    'Select Cryptocurrency': 'کرپٹو کرنسی منتخب کریں',
    'Time Range': 'وقت کی حد',
    'Export Chart': 'چارٹ ایکسپورٹ کریں',
    '1 Day': '۱ دن',
    '7 Days': '۷ دن',
    '30 Days': '۳۰ دن',
    '90 Days': '۹۰ دن',
    '1 Year': '۱ سال',
    
    // Tooltips
    'Disable Sound': 'آواز بند کریں',
    'Enable Sound': 'آواز آن کریں',
    'Toggle Theme': 'تھیم تبدیل کریں',
    'Toggle Language': 'زبان تبدیل کریں',
    'Tutorial': 'ٹیوٹوریل',
    
    // Charts
    'Price History': 'قیمت کی تاریخ',
    'Volume Analysis': 'والیوم کا تجزیہ',
    'Market Dominance': 'مارکیٹ کا غلبہ',
    'Candlestick Chart': 'کینڈل سٹک چارٹ',
    'Price': 'قیمت',
    'Date': 'تاریخ',
    
    // Features
    'Alert History': 'الرٹ کی تاریخ',
    'Portfolio Summary': 'پورٹ فولیو کا خلاصہ',
    'Total Value': 'کل قیمت',
    '24h Change': '۲۴ گھنٹے کی تبدیلی',
    'P&L': 'منافع/نقصان',
    
    // Tutorial
    'Welcome to CryptoAlert Dashboard': 'کرپٹو الرٹ ڈیش بورڈ میں خوش آمدید',
    'This tutorial will guide you through the main features of your crypto dashboard.': 'یہ ٹیوٹوریل آپ کو آپ کے کرپٹو ڈیش بورڈ کی اہم خصوصیات سے آگاہ کرے گا۔',
    'Real-time Data & Charts': 'حقیقی وقت کا ڈیٹا اور چارٹس',
    'Monitor live cryptocurrency prices with interactive charts and multiple visualization options.': 'انٹرایکٹو چارٹس اور متعدد ویژولائزیشن آپشنز کے ساتھ لائیو کرپٹو کرنسی کی قیمتوں کو مانیٹر کریں۔',
    'Alerts & Portfolio': 'الرٹس اور پورٹ فولیو',
    'Set up price alerts and track your portfolio performance with detailed analytics.': 'قیمت کے الرٹس سیٹ اپ کریں اور تفصیلی تجزیات کے ساتھ اپنے پورٹ فولیو کی کارکردگی کو ٹریک کریں۔',
    'Next': 'اگلا',
    'Finish': 'مکمل',
    
    // Messages
    'Failed to load crypto data': 'کرپٹو ڈیٹا لوڈ کرنے میں ناکامی',
    'Chart exported successfully': 'چارٹ کامیابی سے ایکسپورٹ ہوا',
    'Export failed': 'ایکسپورٹ ناکام',
    
    // Alert types
    'price_above': 'قیمت سے اوپر',
    'price_below': 'قیمت سے نیچے'
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en,
      ur
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

export default i18n; 