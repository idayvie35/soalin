/**
 * AdminService.gs — Panel Kontrol Administrator: Manajemen Pengguna, Kuota, Model Google AI Studio (Gemini), Konfigurasi & Log Sistem
 */

var AdminService = (function () {
  function getAdminOverview(session) {
    var users = Database.readAll('Users', true).map(Auth.sanitizeUserForClient);
    var logs = Database.readAll('UsageLogs', true);
    var jobs = Database.readAll('Jobs', true);
    var settings = Database.readAll('Settings', true);

    logs.sort(function (a, b) {
      return String(b.created_at).localeCompare(String(a.created_at));
    });
    jobs.sort(function (a, b) {
      return String(b.created_at).localeCompare(String(a.created_at));
    });

    var errorLogs = logs.filter(function (l) {
      return l.status === 'error';
    });

    var totalTokens = logs.reduce(function (acc, l) {
      return acc + Number(l.total_tokens || 0);
    }, 0);

    return {
      publicConfig: Config.getPublicConfig(),
      configValidation: Config.validateConfig(),
      users: users,
      recentUsageLogs: logs.slice(0, 40),
      errorLogs: errorLogs.slice(0, 30),
      recentJobs: jobs.slice(0, 25),
      settings: settings,
      summary: {
        totalUsers: users.length,
        activeUsers: users.filter(function (u) {
          return u.status === 'active';
        }).length,
        totalRequests: logs.length,
        totalErrors: errorLogs.length,
        totalTokens: totalTokens,
      },
    };
  }

  function updateUserByAdmin(session, payload) {
    if (!payload || !payload.user_id) {
      throw new Error('user_id wajib diisi.');
    }
    var target = Database.findOne('Users', 'user_id', payload.user_id);
    if (!target) throw new Error('Pengguna tidak ditemukan.');

    var patch = { updated_at: Utils.nowIso() };
    if (payload.role && (payload.role === 'Administrator' || payload.role === 'Pengguna')) {
      patch.role = payload.role;
    }
    if (payload.status && (payload.status === 'active' || payload.status === 'disabled')) {
      if (
        String(target.user_id) === String(session.user_id) &&
        payload.status === 'disabled'
      ) {
        throw new Error('Administrator tidak dapat menonaktifkan akunnya sendiri.');
      }
      patch.status = payload.status;
    }
    if (payload.daily_quota !== undefined) {
      patch.daily_quota = Math.max(0, Math.min(10000, Number(payload.daily_quota)));
    }

    var updated = Database.updateById('Users', 'user_id', payload.user_id, patch);
    UsageService.logHistory(
      session.user_id,
      'ADMIN_UPDATE_USER',
      'User',
      payload.user_id,
      'Admin memperbarui akun ' + target.email
    );
    return Auth.sanitizeUserForClient(updated);
  }

  function updateConfigProperties(session, payload) {
    var updatable = [
      'AI_PROVIDER',
      'GEMINI_MODEL',
      'GEMINI_MAX_TOKENS',
      'DAILY_LIMIT',
      'MAX_QUESTIONS',
      'GOOGLE_DRIVE_FOLDER_ID',
    ];

    var changed = [];
    updatable.forEach(function (key) {
      if (payload[key] !== undefined) {
        Config.setScriptProperty(key, payload[key]);
        changed.push(key);
      }
    });

    UsageService.logHistory(
      session.user_id,
      'ADMIN_UPDATE_CONFIG',
      'Settings',
      'ScriptProperties',
      'Admin memperbarui konfigurasi: ' + changed.join(', ')
    );

    return {
      updatedKeys: changed,
      publicConfig: Config.getPublicConfig(),
      validation: Config.validateConfig(),
    };
  }

  function listGeminiModels() {
    return {
      models: GeminiService.fetchAvailableModels(),
      activeModel: Config.getConfig().GEMINI_MODEL,
    };
  }

  return {
    getAdminOverview: getAdminOverview,
    updateUserByAdmin: updateUserByAdmin,
    updateConfigProperties: updateConfigProperties,
    listGeminiModels: listGeminiModels,
    listOpenKeyModels: listGeminiModels,
  };
})();
