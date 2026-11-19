/**
 * QuestionService.gs — CRUD Soal Individual (1 Baris = 1 Soal di Google Sheets)
 */

var QuestionService = (function () {
  function serializeRow_(q) {
    return {
      question_id: q.question_id || Utils.generateUUID(),
      project_id: q.project_id,
      user_id: q.user_id,
      number: Number(q.number || 1),
      type: q.type || 'pilihan_ganda',
      topic_tag: Utils.sanitizeText(q.topic_tag || '', 200),
      difficulty: q.difficulty || 'Sedang',
      cognitive_level: q.cognitive_level || 'C3',
      thinking_tier: q.thinking_tier || 'MOTS',
      weight: Number(q.weight || 2),
      is_arabic: Boolean(q.is_arabic),
      is_rtl: Boolean(q.is_rtl),
      reading_passage: q.reading_passage || '',
      reading_translation: q.reading_translation || '',
      prompt: q.prompt || '',
      arabic_prompt: q.arabic_prompt || '',
      options_json: JSON.stringify(q.options || []),
      matching_json: JSON.stringify(q.matching_pairs || []),
      sequence_json: JSON.stringify(q.sequence_items || []),
      correct_answer: q.correct_answer || '',
      correct_answers_json: JSON.stringify(q.correct_answers || []),
      explanation: q.explanation || '',
      distractor_analysis: q.distractor_analysis || '',
      rubric: q.rubric || '',
      image_file_id: q.image_file_id || '',
      image_url: q.image_url || '',
      svg_markup: q.svg_markup || '',
      visual_caption: q.visual_caption || '',
      verified_by_ai: Boolean(q.verified_by_ai),
      created_at: q.created_at || Utils.nowIso(),
      updated_at: Utils.nowIso(),
    };
  }

  function hydrateRow_(row) {
    return {
      question_id: row.question_id,
      project_id: row.project_id,
      user_id: row.user_id,
      number: Number(row.number || 1),
      type: row.type,
      topic_tag: row.topic_tag,
      difficulty: row.difficulty,
      cognitive_level: row.cognitive_level,
      thinking_tier: row.thinking_tier,
      weight: Number(row.weight || 2),
      is_arabic: row.is_arabic === true || row.is_arabic === 'true' || row.is_arabic === 'TRUE',
      is_rtl: row.is_rtl === true || row.is_rtl === 'true' || row.is_rtl === 'TRUE',
      reading_passage: row.reading_passage || '',
      reading_translation: row.reading_translation || '',
      prompt: row.prompt || '',
      arabic_prompt: row.arabic_prompt || '',
      options: Utils.safeJsonParse(row.options_json, []),
      matching_pairs: Utils.safeJsonParse(row.matching_json, []),
      sequence_items: Utils.safeJsonParse(row.sequence_json, []),
      correct_answer: row.correct_answer || '',
      correct_answers: Utils.safeJsonParse(row.correct_answers_json, []),
      explanation: row.explanation || '',
      distractor_analysis: row.distractor_analysis || '',
      rubric: row.rubric || '',
      image_file_id: row.image_file_id || '',
      image_url: row.image_url || '',
      svg_markup: row.svg_markup || '',
      visual_caption: row.visual_caption || '',
      verified_by_ai: row.verified_by_ai === true || row.verified_by_ai === 'true' || row.verified_by_ai === 'TRUE',
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  function getQuestionsByProject(projectId) {
    var rows = Database.findMany('Questions', function (r) {
      return String(r.project_id) === String(projectId);
    });
    rows.sort(function (a, b) {
      return Number(a.number) - Number(b.number);
    });
    return rows.map(hydrateRow_);
  }

  function saveQuestionsBatch(questions) {
    var serialized = questions.map(serializeRow_);
    Database.insertBatch('Questions', serialized);
    return questions;
  }

  function assertOwnership_(questionRow, session) {
    if (!questionRow) throw new Error('NOT_FOUND: Soal tidak ditemukan.');
    if (
      session.role !== 'Administrator' &&
      String(questionRow.user_id) !== String(session.user_id)
    ) {
      throw new Error('FORBIDDEN: Anda tidak memiliki akses ke soal ini.');
    }
  }

  function updateQuestion(session, questionPayload) {
    var existing = Database.findOne('Questions', 'question_id', questionPayload.question_id);
    assertOwnership_(existing, session);

    var merged = Object.assign(hydrateRow_(existing), questionPayload, {
      question_id: existing.question_id,
      project_id: existing.project_id,
      user_id: existing.user_id,
      updated_at: Utils.nowIso(),
    });
    var rowObj = serializeRow_(merged);
    Database.updateById('Questions', 'question_id', existing.question_id, rowObj);
    ProjectService.touchProjectCount(existing.project_id);
    return merged;
  }

  function addManualQuestion(session, projectId, questionPayload) {
    var project = ProjectService.getProjectRecordAuthorized(session, projectId);
    var current = getQuestionsByProject(projectId);
    var nextNum = current.length + 1;

    var newQ = Object.assign(
      {
        question_id: Utils.generateUUID(),
        project_id: project.project_id,
        user_id: project.user_id,
        number: nextNum,
        type: 'pilihan_ganda',
        topic_tag: project.title,
        difficulty: 'Sedang',
        cognitive_level: 'C2',
        thinking_tier: 'MOTS',
        weight: 2,
        is_arabic: String(project.language).indexOf('Arab') !== -1,
        is_rtl: false,
        prompt: 'Tuliskan pertanyaan di sini...',
        options: [],
        correct_answer: '',
        explanation: '',
        verified_by_ai: false,
      },
      questionPayload || {},
      {
        question_id: Utils.generateUUID(),
        project_id: project.project_id,
        user_id: project.user_id,
        number: nextNum,
      }
    );

    Database.insertOne('Questions', serializeRow_(newQ));
    ProjectService.touchProjectCount(project.project_id);
    return newQ;
  }

  function duplicateQuestion(session, questionId) {
    var existing = Database.findOne('Questions', 'question_id', questionId);
    assertOwnership_(existing, session);
    var current = getQuestionsByProject(existing.project_id);
    var copy = hydrateRow_(existing);
    copy.question_id = Utils.generateUUID();
    copy.number = current.length + 1;
    copy.created_at = Utils.nowIso();
    copy.updated_at = Utils.nowIso();
    Database.insertOne('Questions', serializeRow_(copy));
    ProjectService.touchProjectCount(existing.project_id);
    return copy;
  }

  function deleteQuestion(session, questionId) {
    var existing = Database.findOne('Questions', 'question_id', questionId);
    assertOwnership_(existing, session);
    Database.deleteByField('Questions', 'question_id', questionId);
    renumberProjectQuestions(existing.project_id);
    ProjectService.touchProjectCount(existing.project_id);
    return { deleted: true, project_id: existing.project_id };
  }

  function renumberProjectQuestions(projectId) {
    var list = getQuestionsByProject(projectId);
    list.forEach(function (q, idx) {
      if (Number(q.number) !== idx + 1) {
        Database.updateById('Questions', 'question_id', q.question_id, {
          number: idx + 1,
          updated_at: Utils.nowIso(),
        });
      }
    });
  }

  function reorderQuestions(session, projectId, orderedQuestionIds) {
    ProjectService.getProjectRecordAuthorized(session, projectId);
    if (!Array.isArray(orderedQuestionIds)) {
      throw new Error('orderedQuestionIds harus berupa array.');
    }
    orderedQuestionIds.forEach(function (qId, idx) {
      Database.updateById('Questions', 'question_id', qId, {
        number: idx + 1,
        updated_at: Utils.nowIso(),
      });
    });
    return getQuestionsByProject(projectId);
  }

  function regenerateSingle(session, questionId, instruction, requestId) {
    Auth.checkRateLimit(session.user_id, 'regenerate', 20);
    UsageService.assertWithinDailyQuota(session.user, 1);

    var existingRow = Database.findOne('Questions', 'question_id', questionId);
    assertOwnership_(existingRow, session);
    var existing = hydrateRow_(existingRow);
    var project = ProjectService.getProjectRecordAuthorized(session, existing.project_id);

    var regenerated = QuestionGenerator.regenerateSingleQuestion(
      project,
      existing,
      instruction,
      session.user_id,
      requestId
    );
    Database.updateById('Questions', 'question_id', existing.question_id, serializeRow_(regenerated));
    UsageService.incrementUserQuota(session.user_id, 1);
    UsageService.logHistory(
      session.user_id,
      'REGENERATE_QUESTION',
      'Question',
      existing.question_id,
      'Meregenerasi soal nomor ' + existing.number + ' pada proyek ' + project.title
    );
    return regenerated;
  }

  function attachUploadedImage(session, questionId, base64DataUrl, fileName, caption) {
    var existingRow = Database.findOne('Questions', 'question_id', questionId);
    assertOwnership_(existingRow, session);
    var uploaded = ImageService.saveBase64ImageToDrive(base64DataUrl, fileName, questionId);
    Database.updateById('Questions', 'question_id', questionId, {
      image_file_id: uploaded.image_file_id,
      image_url: uploaded.image_url,
      visual_caption: Utils.sanitizeText(caption || uploaded.file_name, 180),
      updated_at: Utils.nowIso(),
    });
    return uploaded;
  }

  return {
    serializeRow: serializeRow_,
    hydrateRow: hydrateRow_,
    getQuestionsByProject: getQuestionsByProject,
    saveQuestionsBatch: saveQuestionsBatch,
    updateQuestion: updateQuestion,
    addManualQuestion: addManualQuestion,
    duplicateQuestion: duplicateQuestion,
    deleteQuestion: deleteQuestion,
    reorderQuestions: reorderQuestions,
    regenerateSingle: regenerateSingle,
    attachUploadedImage: attachUploadedImage,
  };
})();
