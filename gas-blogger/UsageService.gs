/**
 * UsageService.gs — Pemantauan Kuota Harian, Penggunaan Token AI, Log Sistem & Statistik Dashboard
 */

var UsageService = (function () {
  function assertWithinDailyQuota(user, requestedQuestions) {
    var today = Utils.todayDateKey();
    var usedToday =
      String(user.last_quota_date) === today ? Number(user.used_today || 0) : 0;
    var limit = Number(user.daily_quota || Config.getConfig().DAILY_LIMIT || 100);
    var addCount = Number(requestedQuestions || 1);

    if (usedToday + addCount > limit) {
      throw new Error(
        'QUOTA_EXCEEDED: Kuota harian Anda (' +
          usedToday +
          '/' +
          limit +
          ') tidak mencukupi untuk ' +
          addCount +
          ' soal tambahan.'
      );
    }
    return { usedToday: usedToday, limit: limit };
  }

  function incrementUserQuota(userId, count) {
    var user = Database.findOne('Users', 'user_id', userId);
    if (!user) return;
    var today = Utils.todayDateKey();
    var currentUsed =
      String(user.last_quota_date) === today ? Number(user.used_today || 0) : 0;
    Database.updateById('Users', 'user_id', userId, {
      used_today: currentUsed + Number(count || 1),
      last_quota_date: today,
      updated_at: Utils.nowIso(),
    });
  }

  function logUsage(entry) {
    try {
      Database.insertOne('UsageLogs', {
        log_id: Utils.generateUUID(),
        request_id: entry.request_id || Utils.generateUUID(),
        user_id: entry.user_id || '',
        action: entry.action || 'ai_call',
        model: entry.model || '',
        prompt_tokens: Number(entry.prompt_tokens || 0),
        completion_tokens: Number(entry.completion_tokens || 0),
        total_tokens: Number(entry.total_tokens || 0),
        status: entry.status || 'success',
        latency_ms: Number(entry.latency_ms || 0),
        error_message: Utils.sanitizeText(entry.error_message || '', 300),
        created_at: Utils.nowIso(),
      });
    } catch (e) {}
  }

  function logHistory(userId, action, entityType, entityId, summary) {
    try {
      Database.insertOne('History', {
        history_id: Utils.generateUUID(),
        user_id: userId,
        action: action,
        entity_type: entityType,
        entity_id: entityId || '',
        summary: Utils.sanitizeText(summary, 280),
        created_at: Utils.nowIso(),
      });
    } catch (e) {}
  }

  function getDashboardData(session) {
    var isAdmin = session.role === 'Administrator';
    var projects = Database.findMany('Projects', function (p) {
      return isAdmin || String(p.user_id) === String(session.user_id);
    });
    var questions = Database.findMany('Questions', function (q) {
      return isAdmin || String(q.user_id) === String(session.user_id);
    });
    var bankItems = Database.findMany('QuestionBank', function (b) {
      return String(b.user_id) === String(session.user_id);
    });
    var history = Database.findMany('History', function (h) {
      return String(h.user_id) === String(session.user_id);
    });
    var logs = Database.findMany('UsageLogs', function (l) {
      return String(l.user_id) === String(session.user_id);
    });

    projects.sort(function (a, b) {
      return String(b.updated_at).localeCompare(String(a.updated_at));
    });
    history.sort(function (a, b) {
      return String(b.created_at).localeCompare(String(a.created_at));
    });

    var totalTokens = logs.reduce(function (sum, l) {
      return sum + Number(l.total_tokens || 0);
    }, 0);

    var arabicQuestionsCount = questions.filter(function (q) {
      return q.is_arabic === true || q.is_arabic === 'true' || q.is_arabic === 'TRUE';
    }).length;

    var bySubject = {};
    projects.forEach(function (p) {
      var s = p.subject || 'Lainnya';
      bySubject[s] = (bySubject[s] || 0) + Number(p.question_count || 0);
    });

    var today = Utils.todayDateKey();
    var usedToday =
      String(session.user.last_quota_date) === today
        ? Number(session.user.used_today || 0)
        : 0;

    return {
      stats: {
        totalProjects: projects.length,
        totalQuestionsGenerated: questions.length,
        totalBankSaved: bankItems.length,
        arabicQuestionsCount: arabicQuestionsCount,
        aiCallsCount: logs.length,
        totalTokensUsed: totalTokens,
        quotaUsedToday: usedToday,
        dailyQuotaLimit: Number(session.user.daily_quota || 100),
      },
      subjectBreakdown: bySubject,
      recentProjects: projects.slice(0, 6).map(function (p) {
        return {
          project_id: p.project_id,
          title: p.title,
          subject: p.subject,
          level: p.level,
          grade: p.grade,
          language: p.language,
          question_count: Number(p.question_count || 0),
          status: p.status,
          updated_at: p.updated_at,
        };
      }),
      recentActivity: history.slice(0, 10),
    };
  }

  function getUserHistory(session, page, pageSize) {
    var items = Database.findMany('History', function (h) {
      return String(h.user_id) === String(session.user_id);
    });
    items.sort(function (a, b) {
      return String(b.created_at).localeCompare(String(a.created_at));
    });
    return Database.paginate(items, page, pageSize);
  }

  return {
    assertWithinDailyQuota: assertWithinDailyQuota,
    incrementUserQuota: incrementUserQuota,
    logUsage: logUsage,
    logHistory: logHistory,
    getDashboardData: getDashboardData,
    getUserHistory: getUserHistory,
  };
})();
