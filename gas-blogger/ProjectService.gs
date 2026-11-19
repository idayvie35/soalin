/**
 * ProjectService.gs — Manajemen Proyek Pembuatan Soal & Template
 */

var ProjectService = (function () {
  function getProjectRecordAuthorized(session, projectId) {
    var project = Database.findOne('Projects', 'project_id', projectId);
    if (!project) throw new Error('NOT_FOUND: Proyek tidak ditemukan.');
    if (
      session.role !== 'Administrator' &&
      String(project.user_id) !== String(session.user_id)
    ) {
      throw new Error('FORBIDDEN: Anda tidak berhak mengakses proyek ini.');
    }
    return project;
  }

  function hydrateProject_(row, includeQuestions) {
    var proj = {
      project_id: row.project_id,
      user_id: row.user_id,
      title: row.title,
      subtitles: Utils.safeJsonParse(row.subtitles_json, []),
      subject: row.subject,
      grade: row.grade,
      level: row.level,
      language: row.language,
      description: row.description,
      question_count: Number(row.question_count || 0),
      status: row.status,
      header: Utils.safeJsonParse(row.header_json, {}),
      config: Utils.safeJsonParse(row.config_json, {}),
      quality_report: Utils.safeJsonParse(row.quality_json, null),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    if (includeQuestions) {
      proj.questions = QuestionService.getQuestionsByProject(row.project_id);
    }
    return proj;
  }

  function listProjects(session, filters) {
    var isAdmin = session.role === 'Administrator';
    var f = filters || {};
    var rows = Database.findMany('Projects', function (p) {
      if (!isAdmin && String(p.user_id) !== String(session.user_id)) return false;
      if (f.subject && f.subject !== 'all' && p.subject !== f.subject) return false;
      if (f.level && f.level !== 'all' && p.level !== f.level) return false;
      if (f.search) {
        var q = String(f.search).toLowerCase();
        var hit =
          String(p.title).toLowerCase().indexOf(q) !== -1 ||
          String(p.subject).toLowerCase().indexOf(q) !== -1;
        if (!hit) return false;
      }
      return true;
    });

    rows.sort(function (a, b) {
      return String(b.updated_at).localeCompare(String(a.updated_at));
    });

    var hydrated = rows.map(function (r) {
      return hydrateProject_(r, false);
    });
    return Database.paginate(hydrated, f.page || 1, f.pageSize || 20);
  }

  function getProjectDetail(session, projectId) {
    var row = getProjectRecordAuthorized(session, projectId);
    return hydrateProject_(row, true);
  }

  function createProject(session, payload) {
    var now = Utils.nowIso();
    var projectId = Utils.generateUUID();
    var defaultHeader = {
      institutionName: session.user.institution || 'Lembaga Pendidikan / Sekolah',
      institutionAddress: '',
      examTitle: 'PENILAIAN / EVALUASI PEMBELAJARAN',
      subject: payload.subject || 'Umum',
      level: payload.level || 'SMA',
      gradeClass: payload.grade || 'X',
      semester: 'Ganjil',
      academicYear: '2026/2027',
      teacherName: session.user.name || session.email,
      teacherNip: session.user.nip || '',
      timeAllocation: '90 Menit',
      instructions: 'Bacalah soal dengan saksama sebelum menjawab.',
      includeStudentIdentityBox: true,
      logoFileId: '',
    };

    var row = {
      project_id: projectId,
      user_id: session.user_id,
      title: Utils.sanitizeText(payload.title || 'Proyek Soal Baru', 220),
      subtitles_json: JSON.stringify(payload.subtitles || []),
      subject: Utils.sanitizeText(payload.subject || 'Umum', 120),
      grade: Utils.sanitizeText(payload.grade || '', 60),
      level: Utils.sanitizeText(payload.level || 'SMA', 60),
      language: Utils.sanitizeText(payload.language || 'Indonesia', 60),
      description: Utils.sanitizeText(payload.description || '', 1000),
      question_count: 0,
      status: payload.status || 'draft',
      header_json: JSON.stringify(payload.header || defaultHeader),
      config_json: JSON.stringify(payload.config || {}),
      quality_json: JSON.stringify(payload.quality_report || null),
      created_at: now,
      updated_at: now,
    };

    Database.insertOne('Projects', row);
    UsageService.logHistory(
      session.user_id,
      'CREATE_PROJECT',
      'Project',
      projectId,
      'Membuat proyek: ' + row.title
    );
    return hydrateProject_(row, true);
  }

  function updateProject(session, projectId, payload) {
    var existing = getProjectRecordAuthorized(session, projectId);
    var patch = { updated_at: Utils.nowIso() };
    if (payload.title !== undefined) patch.title = Utils.sanitizeText(payload.title, 220);
    if (payload.subtitles !== undefined) patch.subtitles_json = JSON.stringify(payload.subtitles);
    if (payload.subject !== undefined) patch.subject = Utils.sanitizeText(payload.subject, 120);
    if (payload.grade !== undefined) patch.grade = Utils.sanitizeText(payload.grade, 60);
    if (payload.level !== undefined) patch.level = Utils.sanitizeText(payload.level, 60);
    if (payload.language !== undefined) patch.language = Utils.sanitizeText(payload.language, 60);
    if (payload.description !== undefined) patch.description = Utils.sanitizeText(payload.description, 1000);
    if (payload.status !== undefined) patch.status = Utils.sanitizeText(payload.status, 40);
    if (payload.header !== undefined) patch.header_json = JSON.stringify(payload.header);
    if (payload.quality_report !== undefined) patch.quality_json = JSON.stringify(payload.quality_report);

    var updated = Database.updateById('Projects', 'project_id', existing.project_id, patch);
    return hydrateProject_(updated, false);
  }

  function touchProjectCount(projectId) {
    var count = QuestionService.getQuestionsByProject(projectId).length;
    Database.updateById('Projects', 'project_id', projectId, {
      question_count: count,
      updated_at: Utils.nowIso(),
    });
  }

  function duplicateProject(session, projectId) {
    var orig = getProjectRecordAuthorized(session, projectId);
    var origQuestions = QuestionService.getQuestionsByProject(projectId);
    var now = Utils.nowIso();
    var newId = Utils.generateUUID();

    var copyProj = {
      project_id: newId,
      user_id: session.user_id,
      title: orig.title + ' (Salinan)',
      subtitles_json: orig.subtitles_json,
      subject: orig.subject,
      grade: orig.grade,
      level: orig.level,
      language: orig.language,
      description: orig.description,
      question_count: origQuestions.length,
      status: 'ready',
      header_json: orig.header_json,
      config_json: orig.config_json,
      quality_json: orig.quality_json,
      created_at: now,
      updated_at: now,
    };
    Database.insertOne('Projects', copyProj);

    if (origQuestions.length > 0) {
      var copiedQuestions = origQuestions.map(function (q) {
        var c = Object.assign({}, q, {
          question_id: Utils.generateUUID(),
          project_id: newId,
          user_id: session.user_id,
          created_at: now,
          updated_at: now,
        });
        return c;
      });
      QuestionService.saveQuestionsBatch(copiedQuestions);
    }

    UsageService.logHistory(
      session.user_id,
      'DUPLICATE_PROJECT',
      'Project',
      newId,
      'Menduplikasi proyek: ' + orig.title
    );
    return hydrateProject_(copyProj, true);
  }

  function deleteProject(session, projectId) {
    var existing = getProjectRecordAuthorized(session, projectId);
    Database.deleteByField('Questions', 'project_id', existing.project_id);
    Database.deleteByField('Projects', 'project_id', existing.project_id);
    UsageService.logHistory(
      session.user_id,
      'DELETE_PROJECT',
      'Project',
      existing.project_id,
      'Menghapus proyek: ' + existing.title
    );
    return { deleted: true, project_id: existing.project_id };
  }

  function listTemplates() {
    var rows = Database.readAll('Templates', false);
    return rows.map(function (t) {
      return {
        template_id: t.template_id,
        name: t.name,
        category: t.category,
        level: t.level,
        subject: t.subject,
        grade: t.grade,
        language: t.language,
        title: t.title,
        subtitles: Utils.safeJsonParse(t.subtitles_json, []),
        description: t.description,
        config: Utils.safeJsonParse(t.config_json, {}),
      };
    });
  }

  return {
    getProjectRecordAuthorized: getProjectRecordAuthorized,
    listProjects: listProjects,
    getProjectDetail: getProjectDetail,
    createProject: createProject,
    updateProject: updateProject,
    touchProjectCount: touchProjectCount,
    duplicateProject: duplicateProject,
    deleteProject: deleteProject,
    listTemplates: listTemplates,
  };
})();
