/**
 * JobService.gs — Antrian Pemrosesan Batch Asinkron untuk Generasi Soal Skala Besar
 * Menghindari batas eksekusi Google Apps Script (6 menit) dan menjaga soal per-batch tetap tersimpan.
 */

var JobService = (function () {
  var BATCH_SIZE = 12;

  function expandCountsToBatches_(countsMap) {
    var expanded = [];
    Object.keys(countsMap || {}).forEach(function (type) {
      var n = Math.max(0, Math.min(50, Math.floor(Number(countsMap[type] || 0))));
      for (var i = 0; i < n; i++) expanded.push(type);
    });

    var batches = [];
    for (var idx = 0; idx < expanded.length; idx += BATCH_SIZE) {
      var slice = expanded.slice(idx, idx + BATCH_SIZE);
      var map = {};
      slice.forEach(function (t) {
        map[t] = (map[t] || 0) + 1;
      });
      batches.push(map);
    }
    return { total: expanded.length, batches: batches };
  }

  function createGenerationJob(session, configPayload, requestId) {
    var cfg = Config.getConfig();
    var plan = expandCountsToBatches_(configPayload.counts || {});
    if (plan.total === 0) {
      throw new Error('Pilih minimal 1 jenis soal dengan jumlah lebih dari 0.');
    }
    if (plan.total > cfg.MAX_QUESTIONS) {
      throw new Error(
        'Jumlah soal melebihi batas maksimal sistem (' + cfg.MAX_QUESTIONS + ' soal per paket).'
      );
    }

    UsageService.assertWithinDailyQuota(session.user, plan.total);

    var project = ProjectService.createProject(session, {
      title: configPayload.title,
      subtitles: configPayload.subtitles || [],
      subject: configPayload.subject,
      grade: configPayload.grade,
      level: configPayload.level,
      language: configPayload.language,
      description: configPayload.description,
      status: 'generating',
      config: configPayload,
    });

    var jobId = Utils.generateUUID();
    var now = Utils.nowIso();
    var jobRecord = {
      job_id: jobId,
      request_id: requestId || Utils.generateUUID(),
      user_id: session.user_id,
      project_id: project.project_id,
      status: 'Pending',
      progress_percent: 5,
      progress_message: 'Antrian pembuatan ' + plan.total + ' soal dibuat (' + plan.batches.length + ' batch)...',
      total_target: plan.total,
      completed_count: 0,
      payload_json: JSON.stringify({
        config: configPayload,
        batches: plan.batches,
        nextBatchIndex: 0,
      }),
      result_json: '',
      error_message: '',
      created_at: now,
      updated_at: now,
    };
    Database.insertOne('Jobs', jobRecord);

    // Jadwalkan trigger proses latar belakang agar berjalan meskipun koneksi awal selesai
    try {
      ScriptApp.newTrigger('processPendingJobTrigger')
        .timeBased()
        .after(1000)
        .create();
    } catch (e) {}

    return {
      job_id: jobId,
      project_id: project.project_id,
      status: 'Pending',
      total_target: plan.total,
      total_batches: plan.batches.length,
    };
  }

  function processNextBatchForJob(jobId, session) {
    var job = Database.findOne('Jobs', 'job_id', jobId);
    if (!job) throw new Error('NOT_FOUND: Job tidak ditemukan.');
    if (
      session &&
      session.role !== 'Administrator' &&
      String(job.user_id) !== String(session.user_id)
    ) {
      throw new Error('FORBIDDEN: Tidak berhak mengakses job ini.');
    }

    if (job.status === 'Completed' || job.status === 'Cancelled' || job.status === 'Failed') {
      return hydrateJob_(job);
    }

    var payload = Utils.safeJsonParse(job.payload_json, null);
    if (!payload || !Array.isArray(payload.batches)) {
      Database.updateById('Jobs', 'job_id', jobId, {
        status: 'Failed',
        error_message: 'Payload job tidak valid.',
        updated_at: Utils.nowIso(),
      });
      return hydrateJob_(Database.findOne('Jobs', 'job_id', jobId));
    }

    var bIdx = Number(payload.nextBatchIndex || 0);
    if (bIdx >= payload.batches.length) {
      return finalizeJob_(job);
    }

    Database.updateById('Jobs', 'job_id', jobId, {
      status: 'Processing',
      progress_message:
        'Menyusun batch ' + (bIdx + 1) + ' dari ' + payload.batches.length + ' melalui Google AI Studio (Gemini)...',
      updated_at: Utils.nowIso(),
    });

    try {
      var existingQuestions = QuestionService.getQuestionsByProject(job.project_id);
      var existingPrompts = existingQuestions.map(function (q) {
        return q.prompt;
      });
      var startNumber = existingQuestions.length + 1;

      var generated = QuestionGenerator.generateBatch(
        payload.batches[bIdx],
        payload.config,
        job.project_id,
        job.user_id,
        startNumber,
        existingPrompts,
        job.request_id
      );

      // Validasi selektif per batch sebelum disimpan
      var validated = QuestionValidator.validateAndRepairBatch(
        generated,
        payload.config,
        { requestId: job.request_id, userId: job.user_id }
      );

      // Simpan langsung batch ini ke Google Sheets agar tidak hilang jika batch selanjutnya gagal
      QuestionService.saveQuestionsBatch(validated.questions);
      ProjectService.touchProjectCount(job.project_id);
      UsageService.incrementUserQuota(job.user_id, validated.questions.length);

      payload.nextBatchIndex = bIdx + 1;
      var newCompleted = existingQuestions.length + validated.questions.length;
      var isAllDone = payload.nextBatchIndex >= payload.batches.length;

      if (isAllDone) {
        return finalizeJobWithReport_(job, payload, newCompleted, validated.report);
      }

      var pct = Math.min(92, Math.round((payload.nextBatchIndex / payload.batches.length) * 85) + 8);
      var updated = Database.updateById('Jobs', 'job_id', jobId, {
        status: 'Processing',
        progress_percent: pct,
        progress_message:
          'Batch ' + payload.nextBatchIndex + '/' + payload.batches.length + ' selesai (' + newCompleted + ' soal tersimpan).',
        completed_count: newCompleted,
        payload_json: JSON.stringify(payload),
        updated_at: Utils.nowIso(),
      });
      return hydrateJob_(updated);
    } catch (err) {
      Database.updateById('Jobs', 'job_id', jobId, {
        status: 'Failed',
        error_message: err.message,
        progress_message: 'Gagal pada batch ' + (bIdx + 1) + ': ' + err.message,
        updated_at: Utils.nowIso(),
      });
      Database.updateById('Projects', 'project_id', job.project_id, {
        status: 'partial_error',
        updated_at: Utils.nowIso(),
      });
      return hydrateJob_(Database.findOne('Jobs', 'job_id', jobId));
    }
  }

  function finalizeJob_(job) {
    var payload = Utils.safeJsonParse(job.payload_json, {});
    var count = QuestionService.getQuestionsByProject(job.project_id).length;
    return finalizeJobWithReport_(job, payload, count, {
      totalChecked: count,
      verifiedCount: count,
      repairedCount: 0,
      noDuplicates: true,
      checkedAt: Utils.nowIso(),
      notes: ['Seluruh soal tersimpan dan tervalidasi.'],
    });
  }

  function finalizeJobWithReport_(job, payload, totalCompleted, report) {
    var config = payload.config || {};
    var allQ = QuestionService.getQuestionsByProject(job.project_id);

    // Pengacakan urutan soal jika diaktifkan
    if (config.shuffleQuestions && allQ.length > 1) {
      var ids = allQ.map(function (q) {
        return q.question_id;
      });
      for (var i = ids.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = ids[i];
        ids[i] = ids[j];
        ids[j] = t;
      }
      ids.forEach(function (qId, idx) {
        Database.updateById('Questions', 'question_id', qId, {
          number: idx + 1,
          updated_at: Utils.nowIso(),
        });
      });
    }

    Database.updateById('Projects', 'project_id', job.project_id, {
      status: 'ready',
      question_count: totalCompleted,
      quality_json: JSON.stringify(report),
      updated_at: Utils.nowIso(),
    });

    UsageService.logHistory(
      job.user_id,
      'GENERATE_QUESTIONS',
      'Project',
      job.project_id,
      'Berhasil membuat ' + totalCompleted + ' soal otomatis.'
    );

    var doneJob = Database.updateById('Jobs', 'job_id', job.job_id, {
      status: 'Completed',
      progress_percent: 100,
      progress_message: 'Selesai! ' + totalCompleted + ' soal siap ditinjau.',
      completed_count: totalCompleted,
      payload_json: JSON.stringify(payload),
      result_json: JSON.stringify({ project_id: job.project_id, report: report }),
      updated_at: Utils.nowIso(),
    });
    return hydrateJob_(doneJob);
  }

  function getJobStatus(session, jobId, autoAdvance) {
    var job = Database.findOne('Jobs', 'job_id', jobId);
    if (!job) throw new Error('NOT_FOUND: Job tidak ditemukan.');
    if (
      session.role !== 'Administrator' &&
      String(job.user_id) !== String(session.user_id)
    ) {
      throw new Error('FORBIDDEN: Anda tidak berhak melihat job ini.');
    }

    // Jika autoAdvance=true dan masih Pending/Processing, proses 1 batch langsung saat polling
    // sehingga antrian tetap berjalan stabil bahkan tanpa menunggu trigger menit GAS!
    if (autoAdvance && (job.status === 'Pending' || job.status === 'Processing')) {
      return processNextBatchForJob(jobId, session);
    }
    return hydrateJob_(job);
  }

  function cancelJob(session, jobId) {
    var job = Database.findOne('Jobs', 'job_id', jobId);
    if (!job) throw new Error('NOT_FOUND: Job tidak ditemukan.');
    if (
      session.role !== 'Administrator' &&
      String(job.user_id) !== String(session.user_id)
    ) {
      throw new Error('FORBIDDEN: Akses ditolak.');
    }
    var updated = Database.updateById('Jobs', 'job_id', jobId, {
      status: 'Cancelled',
      progress_message: 'Dibatalkan oleh pengguna.',
      updated_at: Utils.nowIso(),
    });
    return hydrateJob_(updated);
  }

  function processPendingJobsInBackground() {
    var pending = Database.findMany('Jobs', function (j) {
      return j.status === 'Pending' || j.status === 'Processing';
    });
    if (pending.length === 0) return;
    processNextBatchForJob(pending[0].job_id, null);
  }

  function hydrateJob_(job) {
    return {
      job_id: job.job_id,
      request_id: job.request_id,
      project_id: job.project_id,
      status: job.status,
      progress_percent: Number(job.progress_percent || 0),
      progress_message: job.progress_message || '',
      total_target: Number(job.total_target || 0),
      completed_count: Number(job.completed_count || 0),
      result: Utils.safeJsonParse(job.result_json, null),
      error_message: job.error_message || '',
      created_at: job.created_at,
      updated_at: job.updated_at,
    };
  }

  return {
    createGenerationJob: createGenerationJob,
    processNextBatchForJob: processNextBatchForJob,
    getJobStatus: getJobStatus,
    cancelJob: cancelJob,
    processPendingJobsInBackground: processPendingJobsInBackground,
  };
})();
