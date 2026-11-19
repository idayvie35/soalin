/**
 * QuestionBankService.gs — Bank Soal Pribadi Permanen di Google Sheets
 */

var QuestionBankService = (function () {
  function hydrateBank_(row) {
    return {
      bank_id: row.bank_id,
      user_id: row.user_id,
      subject: row.subject,
      grade: row.grade,
      level: row.level,
      language: row.language,
      difficulty: row.difficulty,
      type: row.type,
      is_favorite: row.is_favorite === true || row.is_favorite === 'true' || row.is_favorite === 'TRUE',
      question: Utils.safeJsonParse(row.question_json, {}),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  function saveToBank(session, payload) {
    var q = payload.question || {};
    var now = Utils.nowIso();
    var bankId = Utils.generateUUID();
    var row = {
      bank_id: bankId,
      user_id: session.user_id,
      subject: Utils.sanitizeText(payload.subject || 'Umum', 120),
      grade: Utils.sanitizeText(payload.grade || '', 60),
      level: Utils.sanitizeText(payload.level || 'SMA', 60),
      language: Utils.sanitizeText(payload.language || 'Indonesia', 60),
      difficulty: q.difficulty || payload.difficulty || 'Sedang',
      type: q.type || 'pilihan_ganda',
      is_favorite: Boolean(payload.is_favorite),
      question_json: JSON.stringify(q),
      created_at: now,
      updated_at: now,
    };
    Database.insertOne('QuestionBank', row);
    UsageService.logHistory(
      session.user_id,
      'SAVE_BANK_QUESTION',
      'QuestionBank',
      bankId,
      'Menyimpan soal ke Bank Soal (' + row.subject + ')'
    );
    return hydrateBank_(row);
  }

  function searchBank(session, filters) {
    var f = filters || {};
    var rows = Database.findMany('QuestionBank', function (r) {
      if (String(r.user_id) !== String(session.user_id)) return false;
      if (f.subject && f.subject !== 'all' && r.subject !== f.subject) return false;
      if (f.grade && f.grade !== 'all' && r.grade !== f.grade) return false;
      if (f.language && f.language !== 'all' && r.language !== f.language) return false;
      if (f.difficulty && f.difficulty !== 'all' && r.difficulty !== f.difficulty) return false;
      if (f.type && f.type !== 'all' && r.type !== f.type) return false;
      if (f.favoriteOnly && !(r.is_favorite === true || r.is_favorite === 'true' || r.is_favorite === 'TRUE')) {
        return false;
      }
      if (f.search) {
        var qLower = String(f.search).toLowerCase();
        var hit =
          String(r.question_json).toLowerCase().indexOf(qLower) !== -1 ||
          String(r.subject).toLowerCase().indexOf(qLower) !== -1;
        if (!hit) return false;
      }
      return true;
    });

    rows.sort(function (a, b) {
      return String(b.updated_at).localeCompare(String(a.updated_at));
    });

    var hydrated = rows.map(hydrateBank_);
    return Database.paginate(hydrated, f.page || 1, f.pageSize || 30);
  }

  function toggleFavorite(session, bankId) {
    var row = Database.findOne('QuestionBank', 'bank_id', bankId);
    if (!row || String(row.user_id) !== String(session.user_id)) {
      throw new Error('NOT_FOUND: Soal bank tidak ditemukan.');
    }
    var curFav = row.is_favorite === true || row.is_favorite === 'true' || row.is_favorite === 'TRUE';
    var updated = Database.updateById('QuestionBank', 'bank_id', bankId, {
      is_favorite: !curFav,
      updated_at: Utils.nowIso(),
    });
    return hydrateBank_(updated);
  }

  function duplicateBankItem(session, bankId) {
    var row = Database.findOne('QuestionBank', 'bank_id', bankId);
    if (!row || String(row.user_id) !== String(session.user_id)) {
      throw new Error('NOT_FOUND: Soal bank tidak ditemukan.');
    }
    var now = Utils.nowIso();
    var copy = Object.assign({}, row, {
      bank_id: Utils.generateUUID(),
      is_favorite: false,
      created_at: now,
      updated_at: now,
    });
    Database.insertOne('QuestionBank', copy);
    return hydrateBank_(copy);
  }

  function deleteBankItem(session, bankId) {
    var row = Database.findOne('QuestionBank', 'bank_id', bankId);
    if (!row || String(row.user_id) !== String(session.user_id)) {
      throw new Error('NOT_FOUND: Soal bank tidak ditemukan.');
    }
    Database.deleteByField('QuestionBank', 'bank_id', bankId);
    return { deleted: true };
  }

  function mergeIntoNewProject(session, bankIds, projectMeta) {
    if (!Array.isArray(bankIds) || bankIds.length === 0) {
      throw new Error('Pilih minimal 1 soal dari Bank Soal.');
    }
    var selected = bankIds
      .map(function (id) {
        return Database.findOne('QuestionBank', 'bank_id', id);
      })
      .filter(function (row) {
        return row && String(row.user_id) === String(session.user_id);
      });

    if (selected.length === 0) {
      throw new Error('Tidak ada soal valid yang dipilih.');
    }

    var newProj = ProjectService.createProject(session, {
      title: (projectMeta && projectMeta.title) || 'Paket Gabungan Bank Soal',
      subject: (projectMeta && projectMeta.subject) || selected[0].subject,
      level: (projectMeta && projectMeta.level) || selected[0].level,
      grade: (projectMeta && projectMeta.grade) || selected[0].grade,
      language: (projectMeta && projectMeta.language) || selected[0].language,
      status: 'ready',
    });

    var questions = selected.map(function (row, idx) {
      var q = Utils.safeJsonParse(row.question_json, {});
      return Object.assign({}, q, {
        question_id: Utils.generateUUID(),
        project_id: newProj.project_id,
        user_id: session.user_id,
        number: idx + 1,
        created_at: Utils.nowIso(),
        updated_at: Utils.nowIso(),
      });
    });

    QuestionService.saveQuestionsBatch(questions);
    ProjectService.touchProjectCount(newProj.project_id);
    return ProjectService.getProjectDetail(session, newProj.project_id);
  }

  return {
    saveToBank: saveToBank,
    searchBank: searchBank,
    toggleFavorite: toggleFavorite,
    duplicateBankItem: duplicateBankItem,
    deleteBankItem: deleteBankItem,
    mergeIntoNewProject: mergeIntoNewProject,
  };
})();
