/**
 * Database.gs — Google Sheets Relational Layer dengan LockService, CacheService, Batch CRUD & Pagination
 */

var Database = (function () {
  var SCHEMAS = {
    Users: [
      'user_id',
      'email',
      'name',
      'role',
      'status',
      'daily_quota',
      'used_today',
      'last_quota_date',
      'institution',
      'nip',
      'created_at',
      'updated_at',
      'last_login_at',
    ],
    Projects: [
      'project_id',
      'user_id',
      'title',
      'subtitles_json',
      'subject',
      'grade',
      'level',
      'language',
      'description',
      'question_count',
      'status',
      'header_json',
      'config_json',
      'quality_json',
      'created_at',
      'updated_at',
    ],
    Questions: [
      'question_id',
      'project_id',
      'user_id',
      'number',
      'type',
      'topic_tag',
      'difficulty',
      'cognitive_level',
      'thinking_tier',
      'weight',
      'is_arabic',
      'is_rtl',
      'reading_passage',
      'reading_translation',
      'prompt',
      'arabic_prompt',
      'options_json',
      'matching_json',
      'sequence_json',
      'correct_answer',
      'correct_answers_json',
      'explanation',
      'distractor_analysis',
      'rubric',
      'image_file_id',
      'image_url',
      'svg_markup',
      'visual_caption',
      'verified_by_ai',
      'created_at',
      'updated_at',
    ],
    QuestionBank: [
      'bank_id',
      'user_id',
      'subject',
      'grade',
      'level',
      'language',
      'difficulty',
      'type',
      'is_favorite',
      'question_json',
      'created_at',
      'updated_at',
    ],
    History: [
      'history_id',
      'user_id',
      'action',
      'entity_type',
      'entity_id',
      'summary',
      'created_at',
    ],
    Templates: [
      'template_id',
      'name',
      'category',
      'level',
      'subject',
      'grade',
      'language',
      'title',
      'subtitles_json',
      'description',
      'config_json',
      'is_public',
      'created_at',
    ],
    Settings: ['setting_key', 'setting_value', 'is_public', 'updated_by', 'updated_at'],
    UsageLogs: [
      'log_id',
      'request_id',
      'user_id',
      'action',
      'model',
      'prompt_tokens',
      'completion_tokens',
      'total_tokens',
      'status',
      'latency_ms',
      'error_message',
      'created_at',
    ],
    Jobs: [
      'job_id',
      'request_id',
      'user_id',
      'project_id',
      'status',
      'progress_percent',
      'progress_message',
      'total_target',
      'completed_count',
      'payload_json',
      'result_json',
      'error_message',
      'created_at',
      'updated_at',
    ],
  };

  function getSpreadsheet_() {
    var cfg = Config.getConfig();
    if (!cfg.SPREADSHEET_ID) {
      throw new Error('SPREADSHEET_ID belum dikonfigurasi pada Script Properties.');
    }
    return SpreadsheetApp.openById(cfg.SPREADSHEET_ID);
  }

  function ensureSheet_(ss, name) {
    var sheet = ss.getSheetByName(name);
    var headers = SCHEMAS[name];
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    } else if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
    return sheet;
  }

  function withLock_(fn) {
    var lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      return fn();
    } finally {
      lock.releaseLock();
    }
  }

  function initDatabase() {
    return withLock_(function () {
      var ss = getSpreadsheet_();
      var createdOrVerified = [];
      Object.keys(SCHEMAS).forEach(function (name) {
        ensureSheet_(ss, name);
        createdOrVerified.push(name);
      });
      return {
        spreadsheetName: ss.getName(),
        sheets: createdOrVerified,
      };
    });
  }

  function healthCheck() {
    var ss = getSpreadsheet_();
    var existing = ss.getSheets().map(function (s) {
      return s.getName();
    });
    var missing = Object.keys(SCHEMAS).filter(function (name) {
      return existing.indexOf(name) === -1;
    });
    return {
      ok: missing.length === 0,
      spreadsheetName: ss.getName(),
      existingSheets: existing,
      missingSheets: missing,
    };
  }

  function cacheKey_(sheetName) {
    return 'soalin_db_' + sheetName;
  }

  function invalidateCache(sheetName) {
    try {
      CacheService.getScriptCache().remove(cacheKey_(sheetName));
    } catch (e) {}
  }

  function readAll(sheetName, skipCache) {
    var cache = CacheService.getScriptCache();
    if (!skipCache) {
      var cached = cache.get(cacheKey_(sheetName));
      if (cached) {
        var parsed = Utils.safeJsonParse(cached, null);
        if (parsed) return parsed;
      }
    }

    var ss = getSpreadsheet_();
    var sheet = ensureSheet_(ss, sheetName);
    var lastRow = sheet.getLastRow();
    var headers = SCHEMAS[sheetName];
    if (lastRow <= 1) return [];

    var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    var records = values.map(function (row, idx) {
      var obj = { _rowIndex: idx + 2 };
      for (var c = 0; c < headers.length; c++) {
        obj[headers[c]] = row[c];
      }
      return obj;
    });

    try {
      var serialized = JSON.stringify(records);
      if (serialized.length < 95000) {
        cache.put(cacheKey_(sheetName), serialized, 60);
      }
    } catch (e) {}

    return records;
  }

  function toRowArray_(sheetName, obj) {
    var headers = SCHEMAS[sheetName];
    return headers.map(function (h) {
      var val = obj[h];
      if (val === undefined || val === null) return '';
      if (typeof val === 'boolean' || typeof val === 'number') return val;
      return Utils.sanitizeCell(val);
    });
  }

  function insertOne(sheetName, obj) {
    return insertBatch(sheetName, [obj])[0];
  }

  function insertBatch(sheetName, objects) {
    if (!objects || objects.length === 0) return [];
    return withLock_(function () {
      var ss = getSpreadsheet_();
      var sheet = ensureSheet_(ss, sheetName);
      var rows = objects.map(function (obj) {
        return toRowArray_(sheetName, obj);
      });
      var startRow = Math.max(2, sheet.getLastRow() + 1);
      sheet.getRange(startRow, 1, rows.length, SCHEMAS[sheetName].length).setValues(rows);
      invalidateCache(sheetName);
      return objects;
    });
  }

  function updateById(sheetName, idField, idValue, patchObj) {
    return withLock_(function () {
      var ss = getSpreadsheet_();
      var sheet = ensureSheet_(ss, sheetName);
      var headers = SCHEMAS[sheetName];
      var idCol = headers.indexOf(idField);
      if (idCol === -1) throw new Error('Kolom ID tidak valid: ' + idField);

      var lastRow = sheet.getLastRow();
      if (lastRow <= 1) return null;

      var range = sheet.getRange(2, 1, lastRow - 1, headers.length);
      var values = range.getValues();
      for (var r = 0; r < values.length; r++) {
        if (String(values[r][idCol]) === String(idValue)) {
          var current = {};
          for (var c = 0; c < headers.length; c++) {
            current[headers[c]] = values[r][c];
          }
          Object.keys(patchObj).forEach(function (k) {
            current[k] = patchObj[k];
          });
          var updatedRow = toRowArray_(sheetName, current);
          sheet.getRange(r + 2, 1, 1, headers.length).setValues([updatedRow]);
          invalidateCache(sheetName);
          return current;
        }
      }
      return null;
    });
  }

  function deleteByField(sheetName, fieldName, fieldValue) {
    return withLock_(function () {
      var ss = getSpreadsheet_();
      var sheet = ensureSheet_(ss, sheetName);
      var headers = SCHEMAS[sheetName];
      var colIdx = headers.indexOf(fieldName);
      if (colIdx === -1) return 0;

      var lastRow = sheet.getLastRow();
      if (lastRow <= 1) return 0;

      var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
      var deletedCount = 0;
      for (var r = values.length - 1; r >= 0; r--) {
        if (String(values[r][colIdx]) === String(fieldValue)) {
          sheet.deleteRow(r + 2);
          deletedCount++;
        }
      }
      if (deletedCount > 0) invalidateCache(sheetName);
      return deletedCount;
    });
  }

  function findOne(sheetName, fieldName, value) {
    var rows = readAll(sheetName, false);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][fieldName]) === String(value)) return rows[i];
    }
    return null;
  }

  function findMany(sheetName, filterFn) {
    var rows = readAll(sheetName, false);
    return rows.filter(filterFn);
  }

  function paginate(items, page, pageSize) {
    var p = Math.max(1, Number(page || 1));
    var size = Math.max(1, Math.min(100, Number(pageSize || 20)));
    var total = items.length;
    var totalPages = Math.max(1, Math.ceil(total / size));
    var start = (p - 1) * size;
    return {
      items: items.slice(start, start + size),
      pagination: {
        page: p,
        pageSize: size,
        total: total,
        totalPages: totalPages,
      },
    };
  }

  function seedDefaultTemplatesIfEmpty() {
    var existing = readAll('Templates', true);
    if (existing.length > 0) return;
    var now = Utils.nowIso();
    var seeds = [
      {
        template_id: Utils.generateUUID(),
        name: 'Nahwu & Sharaf Madrasah Aliyah (Bilingual Arab-Indonesia)',
        category: 'Bahasa Arab & Dirasah',
        level: 'MA',
        subject: 'Nahwu & Sharaf',
        grade: 'XI Agama',
        language: 'Indonesia-Arab',
        title: 'Al-Mubtada wal Khabar serta Nawasikh (Kana & Inna)',
        subtitles_json: JSON.stringify([
          'Pengertian dan Pembagian Mubtada dan Khabar',
          'Amal Kana wa Akhwatuha',
          'Amal Inna wa Akhwatuha',
        ]),
        description: 'Gunakan harakat penuh dan contoh kalimat dari kaidah Alfiyah/Jurumiyah.',
        config_json: JSON.stringify({
          counts: { pilihan_ganda: 5, melengkapi_kalimat: 2, analisis_teks: 2, esai: 1 },
          difficulty: 'Campuran',
          cognitiveLevels: ['C2', 'C3', 'C4'],
          arabicFocus: 'Nahwu',
          harakatMode: 'Penuh',
        }),
        is_public: true,
        created_at: now,
      },
      {
        template_id: Utils.generateUUID(),
        name: 'IPA Terpadu SMP (Sistem Pencernaan & Visual)',
        category: 'Sekolah Menengah',
        level: 'SMP',
        subject: 'Ilmu Pengetahuan Alam',
        grade: 'VIII',
        language: 'Indonesia',
        title: 'Sistem Pencernaan Manusia',
        subtitles_json: JSON.stringify([
          'Organ Pencernaan Manusia',
          'Fungsi Enzim Pencernaan',
          'Gangguan Sistem Pencernaan',
        ]),
        description: 'Sertakan soal berbasis gambar/diagram organ dan studi kasus nutrisi.',
        config_json: JSON.stringify({
          counts: { pilihan_ganda: 5, pilihan_ganda_kompleks: 2, berbasis_gambar: 2, esai: 1 },
          difficulty: 'Sedang',
          cognitiveLevels: ['C2', 'C3', 'C4'],
        }),
        is_public: true,
        created_at: now,
      },
    ];
    insertBatch('Templates', seeds);
  }

  return {
    SCHEMAS: SCHEMAS,
    initDatabase: initDatabase,
    healthCheck: healthCheck,
    invalidateCache: invalidateCache,
    readAll: readAll,
    insertOne: insertOne,
    insertBatch: insertBatch,
    updateById: updateById,
    deleteByField: deleteByField,
    findOne: findOne,
    findMany: findMany,
    paginate: paginate,
    seedDefaultTemplatesIfEmpty: seedDefaultTemplatesIfEmpty,
  };
})();
