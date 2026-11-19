/**
 * Config.gs — Manajemen Konfigurasi & Script Properties untuk SIT PLUS CORDOVA (SD–SMA)
 * Seluruh kredensial & pengaturan sensitif dibaca eksklusif dari PropertiesService.
 */

var Config = (function () {
  var DEFAULTS = {
    APP_NAME: 'SIT PLUS CORDOVA',
    APP_VERSION: '1.1.0',
    AI_PROVIDER: 'Google AI Studio (Gemini)',
    GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
    GEMINI_MODEL: 'gemini-4-hydrogen',
    GEMINI_MAX_TOKENS: '8192',
    DAILY_LIMIT: '100',
    MAX_QUESTIONS: '50',
    MAX_REQUEST_SIZE: '250000',
    ALLOWED_ORIGINS: '*',
  };

  function getProps_() {
    return PropertiesService.getScriptProperties();
  }

  function getConfig() {
    var props = getProps_().getProperties();
    return {
      APP_NAME: props.APP_NAME || DEFAULTS.APP_NAME,
      APP_VERSION: props.APP_VERSION || DEFAULTS.APP_VERSION,
      APP_SECRET: props.APP_SECRET || '',
      AUTH_SECRET: props.AUTH_SECRET || '',
      ADMIN_EMAIL: (props.ADMIN_EMAIL || '').trim().toLowerCase(),
      SPREADSHEET_ID: (props.SPREADSHEET_ID || '').trim(),
      GOOGLE_CLIENT_ID: (props.GOOGLE_CLIENT_ID || '').trim(),

      AI_PROVIDER: props.AI_PROVIDER || DEFAULTS.AI_PROVIDER,
      GEMINI_API_KEY: (props.GEMINI_API_KEY || '').trim(),
      GEMINI_BASE_URL: (props.GEMINI_BASE_URL || DEFAULTS.GEMINI_BASE_URL).trim().replace(/\/+$/, ''),
      GEMINI_MODEL: (props.GEMINI_MODEL || DEFAULTS.GEMINI_MODEL).trim(),
      GEMINI_MAX_TOKENS: Number(props.GEMINI_MAX_TOKENS || DEFAULTS.GEMINI_MAX_TOKENS),

      DAILY_LIMIT: Number(props.DAILY_LIMIT || DEFAULTS.DAILY_LIMIT),
      MAX_QUESTIONS: Number(props.MAX_QUESTIONS || DEFAULTS.MAX_QUESTIONS),
      MAX_REQUEST_SIZE: Number(props.MAX_REQUEST_SIZE || DEFAULTS.MAX_REQUEST_SIZE),

      GOOGLE_DRIVE_FOLDER_ID: (props.GOOGLE_DRIVE_FOLDER_ID || '').trim(),
      ALLOWED_ORIGINS: (props.ALLOWED_ORIGINS || DEFAULTS.ALLOWED_ORIGINS).trim(),
    };
  }

  function setScriptProperty(key, value) {
    var allowedKeys = [
      'APP_NAME',
      'APP_VERSION',
      'AI_PROVIDER',
      'GEMINI_MODEL',
      'GEMINI_MAX_TOKENS',
      'DAILY_LIMIT',
      'MAX_QUESTIONS',
      'MAX_REQUEST_SIZE',
      'GOOGLE_DRIVE_FOLDER_ID',
      'ALLOWED_ORIGINS',
      'GOOGLE_CLIENT_ID',
    ];
    if (allowedKeys.indexOf(key) === -1) {
      throw new Error('Properti tidak diizinkan untuk diubah melalui panel admin: ' + key);
    }
    getProps_().setProperty(key, String(value));
    return true;
  }

  function getPublicConfig() {
    var cfg = getConfig();
    return {
      appName: cfg.APP_NAME,
      appVersion: cfg.APP_VERSION,
      aiProvider: cfg.AI_PROVIDER,
      activeModel: cfg.GEMINI_MODEL || DEFAULTS.GEMINI_MODEL,
      maxQuestions: cfg.MAX_QUESTIONS,
      dailyLimit: cfg.DAILY_LIMIT,
      googleClientId: cfg.GOOGLE_CLIENT_ID,
      hasGeminiApiKey: Boolean(cfg.GEMINI_API_KEY),
      hasSpreadsheet: Boolean(cfg.SPREADSHEET_ID),
      hasDriveFolder: Boolean(cfg.GOOGLE_DRIVE_FOLDER_ID),
    };
  }

  function validateConfig() {
    var cfg = getConfig();
    var errors = [];
    var warnings = [];

    if (!cfg.GEMINI_API_KEY) {
      errors.push('GEMINI_API_KEY (Google AI Studio) belum diisi di Script Properties.');
    }
    if (!cfg.SPREADSHEET_ID) {
      warnings.push('SPREADSHEET_ID belum diisi (opsional untuk mode Standalone, wajib untuk mode Dashboard Blogger).');
    }
    if (!cfg.AUTH_SECRET || cfg.AUTH_SECRET.length < 16) {
      warnings.push('AUTH_SECRET belum diisi >= 16 karakter (wajib jika menggunakan login Blogger).');
    }
    if (!cfg.ADMIN_EMAIL) {
      warnings.push('ADMIN_EMAIL belum diisi (opsional untuk mode Standalone).');
    }
    if (!cfg.GOOGLE_DRIVE_FOLDER_ID) {
      warnings.push('GOOGLE_DRIVE_FOLDER_ID belum diisi. File ekspor akan disimpan di folder SIT_PLUS_CORDOVA_ASSETS.');
    }

    var fullDbValid =
      Boolean(cfg.GEMINI_API_KEY) &&
      Boolean(cfg.SPREADSHEET_ID) &&
      Boolean(cfg.AUTH_SECRET && cfg.AUTH_SECRET.length >= 16) &&
      Boolean(cfg.ADMIN_EMAIL);

    return {
      valid: fullDbValid,
      standaloneReady: Boolean(cfg.GEMINI_API_KEY),
      errors: errors,
      warnings: warnings,
    };
  }

  function initializeApp() {
    var validation = validateConfig();
    if (!validation.valid) {
      return {
        ok: false,
        validation: validation,
        message: 'Untuk mode lengkap Blogger + Google Sheets, lengkapi GEMINI_API_KEY, SPREADSHEET_ID, AUTH_SECRET, dan ADMIN_EMAIL di Script Properties.',
      };
    }

    var dbStatus = Database.initDatabase();
    var cfg = getConfig();

    Auth.ensureAdminUser(cfg.ADMIN_EMAIL);
    Database.seedDefaultTemplatesIfEmpty();

    return {
      ok: true,
      validation: validation,
      database: dbStatus,
      message: 'Inisialisasi SIT PLUS CORDOVA berhasil.',
    };
  }

  function checkDatabase() {
    return Database.healthCheck();
  }

  function checkAIConnection() {
    return GeminiService.testConnection();
  }

  return {
    getConfig: getConfig,
    getPublicConfig: getPublicConfig,
    setScriptProperty: setScriptProperty,
    validateConfig: validateConfig,
    initializeApp: initializeApp,
    checkDatabase: checkDatabase,
    checkAIConnection: checkAIConnection,
  };
})();
