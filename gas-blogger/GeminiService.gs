/**
 * GeminiService.gs — AI Gateway Resmi Google AI Studio (Gemini API)
 * Menggunakan GEMINI_API_KEY dari Script Properties (PropertiesService).
 * Tidak pernah mengekspos API Key ke browser/client.
 */

var GeminiService = (function () {
  var MAX_RETRIES = 3;
  var ALLOWED_ACTIVE_MODELS = [
    'gemini-4-hydrogen',
    'gemini-3.1-flash-lite',
    'gemini-4-argon',
    'gemini-4-carbon',
  ];

  function assertConfigured_() {
    var cfg = Config.getConfig();
    if (!cfg.GEMINI_API_KEY) {
      throw new Error(
        'GEMINI_API_KEY belum diisi pada Script Properties GAS. Buka Project Settings > Script Properties di Apps Script lalu tambahkan GEMINI_API_KEY dari Google AI Studio.'
      );
    }
    return cfg;
  }

  function resolveModel_(requestedModel, cfg) {
    var m = String(requestedModel || cfg.GEMINI_MODEL || 'gemini-4-hydrogen').trim();
    // Pastikan tidak menggunakan model usang yang sudah dihentikan
    if (/^(gemini-1\.5|gemini-2\.0|gemini-pro$)/i.test(m)) {
      return 'gemini-4-hydrogen';
    }
    return m || 'gemini-4-hydrogen';
  }

  function fetchAvailableModels() {
    var cfg = assertConfigured_();
    var url = cfg.GEMINI_BASE_URL + '/models';

    var resp = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        'x-goog-api-key': cfg.GEMINI_API_KEY,
        Accept: 'application/json',
      },
      muteHttpExceptions: true,
    });

    var code = resp.getResponseCode();
    var text = resp.getContentText();
    if (code < 200 || code >= 300) {
      throw new Error(
        'Gagal mengambil daftar model Google AI Studio (HTTP ' +
          code +
          '). Periksa GEMINI_API_KEY di Script Properties GAS.'
      );
    }

    var parsed = Utils.safeJsonParse(text, null);
    if (!parsed || !Array.isArray(parsed.models)) {
      return ALLOWED_ACTIVE_MODELS.map(function (id) {
        return { id: id, name: id, owned_by: 'Google AI Studio' };
      });
    }

    var mapped = parsed.models
      .filter(function (m) {
        var methods = m.supportedGenerationMethods || [];
        return methods.indexOf('generateContent') !== -1;
      })
      .map(function (m) {
        var shortId = String(m.name || '').replace(/^models\//, '');
        return {
          id: shortId,
          name: m.displayName || shortId,
          owned_by: 'Google AI Studio',
        };
      })
      .filter(function (m) {
        return m.id && !/^(gemini-1\.5|gemini-2\.0|gemini-pro$)/i.test(m.id);
      });

    if (mapped.length === 0) {
      return ALLOWED_ACTIVE_MODELS.map(function (id) {
        return { id: id, name: id, owned_by: 'Google AI Studio' };
      });
    }

    return mapped;
  }

  function testConnection() {
    var start = Date.now();
    try {
      var cfg = assertConfigured_();
      var models = fetchAvailableModels();
      return {
        ok: true,
        provider: 'Google AI Studio (Gemini)',
        latencyMs: Date.now() - start,
        modelsCount: models.length,
        activeModel: resolveModel_(cfg.GEMINI_MODEL, cfg),
        sampleModels: models.slice(0, 8),
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'Google AI Studio (Gemini)',
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  function safeLogUsage_(entry) {
    try {
      if (Config.getConfig().SPREADSHEET_ID) {
        UsageService.logUsage(entry);
      }
    } catch (e) {}
  }

  function chatCompletion(options) {
    var cfg = assertConfigured_();
    var model = resolveModel_(options.model, cfg);
    var url =
      cfg.GEMINI_BASE_URL +
      '/models/' +
      encodeURIComponent(model) +
      ':generateContent';

    var payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: String(options.userPrompt || '') }],
        },
      ],
    };

    if (options.systemPrompt) {
      payload.systemInstruction = {
        parts: [{ text: String(options.systemPrompt) }],
      };
    }

    function applyThinkingConfig_(m, gCfg) {
      if (options.fastMode === false) return;
      if (m === 'gemini-3.1-flash-lite') {
        gCfg.thinkingConfig = { thinkingLevel: 'MINIMAL' };
      } else {
        gCfg.thinkingConfig = { thinkingLevel: 'LOW' };
      }
    }

    var generationConfig = {};
    if (options.expectJson) {
      generationConfig.responseMimeType = 'application/json';
    }
    applyThinkingConfig_(model, generationConfig);
    if (Object.keys(generationConfig).length > 0) {
      payload.generationConfig = generationConfig;
    }

    var attempt = 0;
    var switchedToFallback = false;
    var lastError = null;
    var startedAt = Date.now();

    while (attempt < MAX_RETRIES) {
      attempt++;
      try {
        var reqUrl =
          cfg.GEMINI_BASE_URL +
          '/models/' +
          encodeURIComponent(model) +
          ':generateContent';
        var response = UrlFetchApp.fetch(reqUrl, {
          method: 'post',
          contentType: 'application/json',
          headers: {
            'x-goog-api-key': cfg.GEMINI_API_KEY,
            Accept: 'application/json',
            'User-Agent': 'aistudio-build',
          },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        });

        var statusCode = response.getResponseCode();
        var bodyText = response.getContentText();

        if (statusCode === 429 && !switchedToFallback && model !== 'gemini-3.1-flash-lite') {
          switchedToFallback = true;
          model = 'gemini-3.1-flash-lite';
          if (!payload.generationConfig) payload.generationConfig = {};
          applyThinkingConfig_(model, payload.generationConfig);
          attempt = Math.max(0, attempt - 1);
          continue;
        }

        if (statusCode === 429 || statusCode >= 500) {
          lastError = new Error(
            statusCode === 429
              ? 'Kuota permintaan per menit (Free Tier) Google AI Studio sedang penuh. Silakan tunggu sebentar atau gunakan API key berbayar.'
              : 'Google AI Studio HTTP ' + statusCode + ': layanan sedang sibuk, mencoba ulang...'
          );
          Utilities.sleep(1500 * Math.pow(2, attempt - 1));
          continue;
        }

        if (statusCode < 200 || statusCode >= 300) {
          var errJson = Utils.safeJsonParse(bodyText, {});
          var errMsg =
            (errJson.error && errJson.error.message) ||
            errJson.message ||
            'Gemini API mengembalikan HTTP ' + statusCode;
          if (
            statusCode === 400 &&
            payload.generationConfig &&
            payload.generationConfig.thinkingConfig &&
            /thinking/i.test(errMsg)
          ) {
            delete payload.generationConfig.thinkingConfig;
            continue;
          }
          throw new Error(errMsg);
        }

        var data = Utils.safeJsonParse(bodyText, null);
        if (
          !data ||
          !data.candidates ||
          !data.candidates[0] ||
          !data.candidates[0].content ||
          !Array.isArray(data.candidates[0].content.parts)
        ) {
          throw new Error('Respons Google AI Studio tidak berisi kandidat teks.');
        }

        var content = data.candidates[0].content.parts
          .map(function (part) {
            return part.text || '';
          })
          .join('\n')
          .trim();

        var meta = data.usageMetadata || {};
        var usage = {
          prompt_tokens: Number(meta.promptTokenCount || 0),
          completion_tokens: Number(meta.candidatesTokenCount || 0),
          total_tokens: Number(meta.totalTokenCount || 0),
        };

        safeLogUsage_({
          request_id: options.requestId,
          user_id: options.userId || 'standalone',
          action: options.actionName || 'generate_content',
          model: model,
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens,
          status: 'success',
          latency_ms: Date.now() - startedAt,
        });

        return {
          content: content,
          model: model,
          usage: usage,
        };
      } catch (e) {
        lastError = e;
        if (attempt >= MAX_RETRIES) break;
        Utilities.sleep(800 * attempt);
      }
    }

    safeLogUsage_({
      request_id: options.requestId,
      user_id: options.userId || 'standalone',
      action: options.actionName || 'generate_content',
      model: model,
      status: 'error',
      latency_ms: Date.now() - startedAt,
      error_message: lastError ? lastError.message : 'Unknown Gemini API error',
    });

    throw lastError || new Error('Gagal berkomunikasi dengan Google AI Studio API.');
  }

  function extractJsonFromText(text) {
    var cleaned = String(text || '').trim();
    cleaned = cleaned
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    var direct = Utils.safeJsonParse(cleaned, null);
    if (direct) return direct;

    var firstBrace = cleaned.indexOf('{');
    var firstBracket = cleaned.indexOf('[');
    var start = -1;
    var end = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = cleaned.lastIndexOf('}');
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = cleaned.lastIndexOf(']');
    }

    if (start !== -1 && end > start) {
      return Utils.safeJsonParse(cleaned.substring(start, end + 1), null);
    }
    return null;
  }

  return {
    fetchAvailableModels: fetchAvailableModels,
    testConnection: testConnection,
    chatCompletion: chatCompletion,
    extractJsonFromText: extractJsonFromText,
  };
})();
