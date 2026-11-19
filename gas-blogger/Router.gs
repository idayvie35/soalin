/**
 * Router.gs — Router API Terpadu untuk doGet & doPost (Kompatibel dengan Transport Blogger ↔ GAS)
 * Mendukung payload JSON via text/plain (untuk menghindari CORS preflight OPTIONS pada GAS Web App).
 */

var Router = (function () {
  function parseRequest_(e, method) {
    var cfg = Config.getConfig();
    var rawBody = '';
    var body = {};

    if (method === 'POST' && e && e.postData && e.postData.contents) {
      rawBody = e.postData.contents;
      if (!Utils.validateRequestSize(rawBody, cfg.MAX_REQUEST_SIZE)) {
        throw new Error('PAYLOAD_TOO_LARGE: Ukuran permintaan melebihi batas ' + cfg.MAX_REQUEST_SIZE + ' byte.');
      }
      body = Utils.safeJsonParse(rawBody, {});
    }

    var params = (e && e.parameter) || {};
    var action = body.action || params.action || 'health';
    var token = body.token || params.token || '';
    var requestId = body.requestId || params.requestId || Utils.generateUUID();

    return {
      method: method,
      action: String(action),
      token: String(token),
      requestId: String(requestId),
      params: params,
      payload: body.payload !== undefined ? body.payload : body,
    };
  }

  function handle(e, method) {
    var requestId = Utils.generateUUID();
    try {
      var req = parseRequest_(e, method);
      requestId = req.requestId;
      var action = req.action;
      var payload = req.payload || {};

      // Endpoint Publik (Tidak Membutuhkan Login Google, Tidak Pernah Membuka Rahasia)
      if (action === 'health' || action === 'standalone_health') {
        var validation = Config.validateConfig();
        return Utils.successResponse(requestId, {
          status: 'healthy',
          publicConfig: Config.getPublicConfig(),
          configReady: validation.valid,
          standaloneReady: validation.standaloneReady,
          errors: validation.errors,
          warnings: validation.warnings,
        });
      }

      if (action === 'standalone_generate') {
        var cache = CacheService.getScriptCache();
        var rlKey = 'rl_standalone_' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMddHHmm');
        var curCount = Number(cache.get(rlKey) || '0');
        if (curCount >= 40) {
          throw new Error('RATE_LIMITED: Terlalu banyak permintaan dalam 1 menit. Tunggu sebentar lalu coba lagi.');
        }
        cache.put(rlKey, String(curCount + 1), 65);

        return Utils.successResponse(
          requestId,
          QuestionGenerator.generateStandaloneBatch(payload, requestId)
        );
      }

      if (action === 'standalone_regenerate') {
        return Utils.successResponse(
          requestId,
          QuestionGenerator.regenerateStandaloneQuestion(payload, requestId)
        );
      }

      if (action === 'standalone_generate_rpp') {
        return Utils.successResponse(
          requestId,
          QuestionGenerator.generateRppKurmer(payload, requestId)
        );
      }

      if (action === 'auth_login') {
        var authResult = Auth.loginWithGoogleToken(payload.idToken);
        return Utils.successResponse(requestId, authResult);
      }

      if (action === 'auth_logout') {
        return Utils.successResponse(requestId, Auth.logout(req.token));
      }

      if (action === 'templates_list') {
        return Utils.successResponse(requestId, ProjectService.listTemplates());
      }

      // Semua Endpoint Berikutnya WAJIB Autentikasi Sesi Server-Side
      var session = Auth.requireSession(req.token);

      switch (action) {
        case 'me':
          return Utils.successResponse(requestId, {
            user: Auth.sanitizeUserForClient(session.user),
            publicConfig: Config.getPublicConfig(),
          });

        case 'profile_update':
          return Utils.successResponse(requestId, Auth.updateMyProfile(session, payload));

        case 'dashboard':
          return Utils.successResponse(requestId, UsageService.getDashboardData(session));

        case 'history_list':
          return Utils.successResponse(
            requestId,
            UsageService.getUserHistory(session, payload.page || req.params.page, payload.pageSize || req.params.pageSize)
          );

        // Proyek
        case 'projects_list':
          return Utils.successResponse(requestId, ProjectService.listProjects(session, payload));

        case 'project_get':
          return Utils.successResponse(
            requestId,
            ProjectService.getProjectDetail(session, payload.project_id || req.params.project_id)
          );

        case 'project_create':
          return Utils.successResponse(requestId, ProjectService.createProject(session, payload));

        case 'project_update':
          return Utils.successResponse(
            requestId,
            ProjectService.updateProject(session, payload.project_id, payload)
          );

        case 'project_duplicate':
          return Utils.successResponse(
            requestId,
            ProjectService.duplicateProject(session, payload.project_id)
          );

        case 'project_delete':
          return Utils.successResponse(
            requestId,
            ProjectService.deleteProject(session, payload.project_id)
          );

        // Generasi Soal Asinkron (Job Queue)
        case 'generate_start':
          Auth.checkRateLimit(session.user_id, 'generate_start', 10);
          return Utils.successResponse(
            requestId,
            JobService.createGenerationJob(session, payload, requestId)
          );

        case 'job_status':
          return Utils.successResponse(
            requestId,
            JobService.getJobStatus(
              session,
              payload.job_id || req.params.job_id,
              payload.autoAdvance !== false
            )
          );

        case 'job_cancel':
          return Utils.successResponse(requestId, JobService.cancelJob(session, payload.job_id));

        case 'generate_rpp':
          return Utils.successResponse(
            requestId,
            QuestionGenerator.generateRppKurmer(payload, requestId)
          );

        // Soal Individual & Editor
        case 'question_update':
          return Utils.successResponse(requestId, QuestionService.updateQuestion(session, payload));

        case 'question_add':
          return Utils.successResponse(
            requestId,
            QuestionService.addManualQuestion(session, payload.project_id, payload.question)
          );

        case 'question_duplicate':
          return Utils.successResponse(
            requestId,
            QuestionService.duplicateQuestion(session, payload.question_id)
          );

        case 'question_delete':
          return Utils.successResponse(
            requestId,
            QuestionService.deleteQuestion(session, payload.question_id)
          );

        case 'question_reorder':
          return Utils.successResponse(
            requestId,
            QuestionService.reorderQuestions(session, payload.project_id, payload.orderedQuestionIds)
          );

        case 'question_regenerate':
          return Utils.successResponse(
            requestId,
            QuestionService.regenerateSingle(session, payload.question_id, payload.instruction, requestId)
          );

        case 'question_upload_image':
          return Utils.successResponse(
            requestId,
            QuestionService.attachUploadedImage(
              session,
              payload.question_id,
              payload.base64DataUrl,
              payload.fileName,
              payload.caption
            )
          );

        // Bank Soal
        case 'bank_save':
          return Utils.successResponse(requestId, QuestionBankService.saveToBank(session, payload));

        case 'bank_search':
          return Utils.successResponse(requestId, QuestionBankService.searchBank(session, payload));

        case 'bank_favorite':
          return Utils.successResponse(
            requestId,
            QuestionBankService.toggleFavorite(session, payload.bank_id)
          );

        case 'bank_duplicate':
          return Utils.successResponse(
            requestId,
            QuestionBankService.duplicateBankItem(session, payload.bank_id)
          );

        case 'bank_delete':
          return Utils.successResponse(
            requestId,
            QuestionBankService.deleteBankItem(session, payload.bank_id)
          );

        case 'bank_merge_project':
          return Utils.successResponse(
            requestId,
            QuestionBankService.mergeIntoNewProject(session, payload.bank_ids, payload.projectMeta)
          );

        // Ekspor PDF / DOCX / Google Docs
        case 'export_document':
          Auth.checkRateLimit(session.user_id, 'export', 15);
          return Utils.successResponse(
            requestId,
            ExportService.exportProjectDocument(session, payload.project_id, payload)
          );

        // Endpoint Khusus Administrator
        case 'admin_overview':
          Auth.requireAdmin(req.token);
          return Utils.successResponse(requestId, AdminService.getAdminOverview(session));

        case 'admin_user_update':
          Auth.requireAdmin(req.token);
          return Utils.successResponse(requestId, AdminService.updateUserByAdmin(session, payload));

        case 'admin_config_update':
          Auth.requireAdmin(req.token);
          return Utils.successResponse(
            requestId,
            AdminService.updateConfigProperties(session, payload)
          );

        case 'admin_models_list':
          Auth.requireAdmin(req.token);
          return Utils.successResponse(requestId, AdminService.listGeminiModels());

        case 'admin_test_ai':
          Auth.requireAdmin(req.token);
          return Utils.successResponse(requestId, Config.checkAIConnection());

        case 'admin_test_db':
          Auth.requireAdmin(req.token);
          return Utils.successResponse(requestId, Config.checkDatabase());

        case 'admin_init_db':
          Auth.requireAdmin(req.token);
          return Utils.successResponse(requestId, Config.initializeApp());

        default:
          return Utils.errorResponse(
            requestId,
            'UNKNOWN_ACTION',
            'Action tidak dikenali: ' + action,
            404
          );
      }
    } catch (err) {
      var msg = err && err.message ? String(err.message) : 'Kesalahan server.';
      var code = 'SERVER_ERROR';
      var status = 500;
      if (msg.indexOf('UNAUTHORIZED:') === 0) {
        code = 'UNAUTHORIZED';
        status = 401;
      } else if (msg.indexOf('FORBIDDEN:') === 0) {
        code = 'FORBIDDEN';
        status = 403;
      } else if (msg.indexOf('NOT_FOUND:') === 0) {
        code = 'NOT_FOUND';
        status = 404;
      } else if (msg.indexOf('RATE_LIMITED:') === 0) {
        code = 'RATE_LIMITED';
        status = 429;
      } else if (msg.indexOf('QUOTA_EXCEEDED:') === 0) {
        code = 'QUOTA_EXCEEDED';
        status = 429;
      } else if (msg.indexOf('PAYLOAD_TOO_LARGE:') === 0) {
        code = 'PAYLOAD_TOO_LARGE';
        status = 413;
      }

      // Jangan pernah mengekspos stack trace atau secret
      return Utils.errorResponse(requestId, code, msg, status);
    }
  }

  return {
    handle: handle,
  };
})();
