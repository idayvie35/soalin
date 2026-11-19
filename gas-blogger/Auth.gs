/**
 * Auth.gs — Autentikasi Google Identity Services (Server-Side ID Token Verification),
 * HMAC-SHA256 Session Token, RBAC (Administrator / Pengguna), dan Rate Limiting.
 */

var Auth = (function () {
  var SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 jam

  function base64UrlEncode_(bytes) {
    return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
  }

  function signPayload_(payloadObj, secret) {
    var json = JSON.stringify(payloadObj);
    var payloadB64 = base64UrlEncode_(Utilities.newBlob(json).getBytes());
    var sigBytes = Utilities.computeHmacSha256Signature(payloadB64, secret);
    var sigB64 = base64UrlEncode_(sigBytes);
    return payloadB64 + '.' + sigB64;
  }

  function verifySignedToken_(token, secret) {
    if (!token || typeof token !== 'string' || token.indexOf('.') === -1) {
      return null;
    }
    var parts = token.split('.');
    if (parts.length !== 2) return null;

    var payloadB64 = parts[0];
    var providedSig = parts[1];
    var expectedSig = base64UrlEncode_(
      Utilities.computeHmacSha256Signature(payloadB64, secret)
    );
    if (providedSig !== expectedSig) return null;

    try {
      var decodedBytes = Utilities.base64DecodeWebSafe(payloadB64);
      var payloadJson = Utilities.newBlob(decodedBytes).getDataAsString();
      var payload = JSON.parse(payloadJson);
      if (!payload.exp || Date.now() > Number(payload.exp)) {
        return null;
      }
      return payload;
    } catch (e) {
      return null;
    }
  }

  function ensureAdminUser(adminEmail) {
    if (!adminEmail) return null;
    var existing = Database.findOne('Users', 'email', adminEmail.toLowerCase());
    var now = Utils.nowIso();
    if (!existing) {
      var cfg = Config.getConfig();
      var adminUser = {
        user_id: Utils.generateUUID(),
        email: adminEmail.toLowerCase(),
        name: 'Ustdz Mulyadi, S.T. (Admin SIT PLUS CORDOVA)',
        role: 'Administrator',
        status: 'active',
        daily_quota: cfg.DAILY_LIMIT || 100,
        used_today: 0,
        last_quota_date: Utils.todayDateKey(),
        institution: '',
        nip: '',
        created_at: now,
        updated_at: now,
        last_login_at: now,
      };
      Database.insertOne('Users', adminUser);
      return adminUser;
    }
    return existing;
  }

  function verifyGoogleIdToken_(idToken) {
    if (!idToken) throw new Error('Google ID Token tidak ditemukan.');
    var url =
      'https://oauth2.googleapis.com/tokeninfo?id_token=' +
      encodeURIComponent(idToken);
    var resp = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
    });
    if (resp.getResponseCode() !== 200) {
      throw new Error('Verifikasi Google ID Token gagal. Silakan login ulang.');
    }
    var info = JSON.parse(resp.getContentText());
    if (info.email_verified !== 'true' && info.email_verified !== true) {
      throw new Error('Email akun Google belum terverifikasi.');
    }

    var cfg = Config.getConfig();
    if (cfg.GOOGLE_CLIENT_ID && info.aud !== cfg.GOOGLE_CLIENT_ID) {
      throw new Error('Token Google bukan berasal dari Google Client ID aplikasi ini.');
    }

    return {
      email: String(info.email || '').trim().toLowerCase(),
      name: Utils.sanitizeText(info.name || info.email, 120),
    };
  }

  function loginWithGoogleToken(idToken) {
    var cfg = Config.getConfig();
    if (!cfg.AUTH_SECRET) {
      throw new Error('AUTH_SECRET belum dikonfigurasi pada Script Properties.');
    }

    var googleUser = verifyGoogleIdToken_(idToken);
    var user = Database.findOne('Users', 'email', googleUser.email);
    var now = Utils.nowIso();
    var today = Utils.todayDateKey();
    var isAdminEmail =
      cfg.ADMIN_EMAIL && googleUser.email === cfg.ADMIN_EMAIL.toLowerCase();

    if (!user) {
      user = {
        user_id: Utils.generateUUID(),
        email: googleUser.email,
        name: googleUser.name,
        role: isAdminEmail ? 'Administrator' : 'Pengguna',
        status: 'active',
        daily_quota: cfg.DAILY_LIMIT || 100,
        used_today: 0,
        last_quota_date: today,
        institution: '',
        nip: '',
        created_at: now,
        updated_at: now,
        last_login_at: now,
      };
      Database.insertOne('Users', user);
    } else {
      if (String(user.status) !== 'active') {
        throw new Error('Akun Anda sedang dinonaktifkan oleh Administrator.');
      }
      var patch = { last_login_at: now, updated_at: now };
      if (isAdminEmail && user.role !== 'Administrator') {
        patch.role = 'Administrator';
        user.role = 'Administrator';
      }
      if (String(user.last_quota_date) !== today) {
        patch.used_today = 0;
        patch.last_quota_date = today;
        user.used_today = 0;
        user.last_quota_date = today;
      }
      Database.updateById('Users', 'user_id', user.user_id, patch);
    }

    var sessionPayload = {
      sid: Utils.generateUUID(),
      user_id: user.user_id,
      email: user.email,
      role: user.role,
      exp: Date.now() + SESSION_TTL_SECONDS * 1000,
    };

    var token = signPayload_(sessionPayload, cfg.AUTH_SECRET);
    CacheService.getScriptCache().put(
      'sess_' + sessionPayload.sid,
      '1',
      SESSION_TTL_SECONDS
    );

    Database.insertOne('History', {
      history_id: Utils.generateUUID(),
      user_id: user.user_id,
      action: 'LOGIN',
      entity_type: 'User',
      entity_id: user.user_id,
      summary: 'Login berhasil melalui Google Identity Services.',
      created_at: now,
    });

    return {
      sessionToken: token,
      expiresAt: new Date(sessionPayload.exp).toISOString(),
      user: sanitizeUserForClient_(user),
    };
  }

  function sanitizeUserForClient_(user) {
    return {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      daily_quota: Number(user.daily_quota || 0),
      used_today: Number(user.used_today || 0),
      institution: user.institution || '',
      nip: user.nip || '',
      created_at: user.created_at,
      last_login_at: user.last_login_at,
    };
  }

  function requireSession(token) {
    var cfg = Config.getConfig();
    if (!token) {
      throw new Error('UNAUTHORIZED: Token sesi tidak ditemukan. Silakan login.');
    }
    var payload = verifySignedToken_(token, cfg.AUTH_SECRET);
    if (!payload) {
      throw new Error('UNAUTHORIZED: Sesi tidak valid atau telah kedaluwarsa.');
    }

    var cacheActive = CacheService.getScriptCache().get('sess_' + payload.sid);
    if (!cacheActive) {
      // Tetap cek user di DB bila cache evicted, pastikan belum revoked
      var userCheck = Database.findOne('Users', 'user_id', payload.user_id);
      if (!userCheck || String(userCheck.status) !== 'active') {
        throw new Error('UNAUTHORIZED: Sesi berakhir atau akun dinonaktifkan.');
      }
    }

    var user = Database.findOne('Users', 'user_id', payload.user_id);
    if (!user) throw new Error('UNAUTHORIZED: Pengguna tidak ditemukan.');
    if (String(user.status) !== 'active') {
      throw new Error('FORBIDDEN: Akun dinonaktifkan oleh Administrator.');
    }

    return {
      sid: payload.sid,
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role,
      user: user,
    };
  }

  function requireAdmin(token) {
    var session = requireSession(token);
    if (session.role !== 'Administrator') {
      throw new Error('FORBIDDEN: Akses khusus Administrator.');
    }
    return session;
  }

  function logout(token) {
    var cfg = Config.getConfig();
    var payload = verifySignedToken_(token, cfg.AUTH_SECRET);
    if (payload && payload.sid) {
      CacheService.getScriptCache().remove('sess_' + payload.sid);
    }
    return { ok: true };
  }

  function checkRateLimit(userId, actionName, maxPerMinute) {
    var limit = maxPerMinute || 30;
    var key = 'rl_' + userId + '_' + (actionName || 'all');
    var cache = CacheService.getScriptCache();
    var current = Number(cache.get(key) || '0');
    if (current >= limit) {
      throw new Error('RATE_LIMITED: Terlalu banyak permintaan. Tunggu 1 menit lalu coba kembali.');
    }
    cache.put(key, String(current + 1), 60);
  }

  function updateMyProfile(session, payload) {
    var patch = {
      name: Utils.sanitizeText(payload.name || session.user.name, 120),
      institution: Utils.sanitizeText(payload.institution || '', 200),
      nip: Utils.sanitizeText(payload.nip || '', 60),
      updated_at: Utils.nowIso(),
    };
    var updated = Database.updateById('Users', 'user_id', session.user_id, patch);
    return sanitizeUserForClient_(updated);
  }

  return {
    ensureAdminUser: ensureAdminUser,
    loginWithGoogleToken: loginWithGoogleToken,
    requireSession: requireSession,
    requireAdmin: requireAdmin,
    logout: logout,
    checkRateLimit: checkRateLimit,
    updateMyProfile: updateMyProfile,
    sanitizeUserForClient: sanitizeUserForClient_,
  };
})();
