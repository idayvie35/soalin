/**
 * QuestionGenerator.gs — Mesin Penyusun Soal Otomatis Berbasis Google AI Studio (Gemini API)
 * Mendukung 16+ tipe soal, Memisah & Menyambung Huruf Hijaiyah, Menulis Ulang Kalimat (1, 2, 3+ kata),
 * Taksonomi Bloom C1-C6, Bahasa Arab Berharakat (rata kiri), serta diagram SVG.
 */

var QuestionGenerator = (function () {
  var TYPE_LABELS = {
    pilihan_ganda: 'Pilihan Ganda',
    pilihan_ganda_kompleks: 'Pilihan Ganda Kompleks',
    benar_salah: 'Benar atau Salah',
    esai: 'Esai / Uraian',
    isian_singkat: 'Isian Singkat',
    menjodohkan: 'Menjodohkan',
    melengkapi_kalimat: 'Melengkapi Kalimat',
    mengurutkan: 'Mengurutkan',
    studi_kasus: 'Studi Kasus',
    analisis_teks: 'Analisis Teks',
    hots: 'Soal HOTS',
    berbasis_gambar: 'Soal Berbasis Gambar',
    pemahaman_bacaan: 'Soal Pemahaman Bacaan',
    analisis_data: 'Soal Analisis Data',
    interpretasi_grafik: 'Soal Interpretasi Grafik',
    pemecahan_masalah: 'Soal Pemecahan Masalah',
    memisah_hijaiyah: 'Memisah Huruf Hijaiyah (Bahasa Arab)',
    menyambung_hijaiyah: 'Menyambung Huruf Hijaiyah (Bahasa Arab)',
    menulis_ulang_kalimat: 'Menulis Ulang Kalimat (1, 2, 3+ Kata)',
    menebalkan_mewarnai_arab: 'Menebalkan Garis & Mewarnai Arab (A4 · 2 Soal)',
  };

  function buildSystemPrompt_(config) {
    var isArabic =
      config.language === 'Arab' ||
      String(config.language).indexOf('Arab') !== -1 ||
      [
        'Bahasa Arab',
        'Nahwu',
        'Sharaf',
        'Balaghah',
        'Fiqih',
        'Hadis',
        'Tafsir',
        'Aqidah Akhlak',
        'Tarikh Islam',
        'Ulumul Quran',
        'Ulumul Hadis',
      ].indexOf(config.subject) !== -1;

    var optCount = Number(config.optionCount || 5);
    if (optCount !== 3 && optCount !== 4 && optCount !== 5) optCount = 5;
    var arabicOptLabels = optCount === 3 ? 'أ, ب, ج' : optCount === 4 ? 'أ, ب, ج, د' : 'أ, ب, ج, د, هـ';
    var latinOptLabels = optCount === 3 ? 'A, B, C' : optCount === 4 ? 'A, B, C, D' : 'A, B, C, D, E';

    var arabicBlock = isArabic
      ? '\nATURAN BAHASA ARAB & DIRASAH ISLAMIYAH (PRIORITAS UTAMA):\n' +
        '- Bidang kajian: ' + (config.arabicFocus || config.subject) + '\n' +
        '- Mode harakat/syakal: ' + (config.harakatMode || 'Penuh') + '. Jika penuh, lengkapi seluruh kata dengan harakat yang tepat sesuai kaidah Nahwu dan Sharaf.\n' +
        '- Gunakan huruf Arab Unicode standar dan tanda baca Arab (« » ، ؛ ؟).\n' +
        '- Jika bahasa soal "Arab", seluruh soal, opsi (' + arabicOptLabels + '), kunci, dan pembahasan ditulis dalam Bahasa Arab fusha dengan is_arabic=true dan is_rtl=true.\n' +
        '- Jika bahasa "Indonesia-Arab" / "Bilingual (Arab-Indonesia)", tuliskan bacaan/kalimat uji/dalil Arab berharakat murni dengan is_arabic=true, sedangkan teks campuran Arab+Indonesia tetap mengikuti aturan baca Indonesia dari kiri (is_rtl=false). Kalimat Arab murni yang berdiri sendiri akan dirender dari kanan (RTL).'
      : '';

    return (
      'Anda adalah guru profesional, pakar asesmen pendidikan, dan ahli evaluasi pembelajaran.\n' +
      'ATURAN FORMAT TEKS (WAJIB): DILARANG keras menggunakan tanda bintang (*, **, ***), pagar Markdown (#), atau backtick dalam seluruh output JSON! Gunakan tanda baca standar (titik, koma, titik dua, atau × untuk perkalian).\n' +
      'Anda WAJIB merespons HANYA dengan objek JSON valid berbentuk:\n' +
      '{ "questions": [ ... ] }\n\n' +
      'Setiap objek soal di dalam array "questions" wajib memiliki properti:\n' +
      '- type (string: salah satu dari kode tipe yang diminta)\n' +
      '- topic_tag (string: subjudul terkait)\n' +
      '- difficulty ("Mudah" | "Sedang" | "Sulit")\n' +
      '- cognitive_level ("C1" | "C2" | "C3" | "C4" | "C5" | "C6")\n' +
      '- thinking_tier ("LOTS" | "MOTS" | "HOTS")\n' +
      '- weight (integer bobot nilai, misal 2 untuk PG, 5-10 untuk esai/kasus)\n' +
      '- is_arabic (boolean)\n' +
      '- is_rtl (boolean: true HANYA jika prompt berupa kalimat Arab murni tanpa huruf Latin/Indonesia; false jika campuran Arab+Indonesia atau Bahasa Indonesia/Inggris)\n' +
      '- reading_passage (string opsional, wajib untuk pemahaman_bacaan, berbasis_bacaan, analisis_teks, studi_kasus, analisis_data)\n' +
      '- reading_translation (string opsional terjemahan Indonesia jika reading_passage berbahasa Arab)\n' +
      '- prompt (string pertanyaan jelas, tidak ambigu)\n' +
      '- arabic_prompt (string opsional kalimat Arab terpisah untuk soal campuran)\n' +
      '- options (array of { "label": "...", "text": "...", "isCorrect": true/false, "distractorReason": "..." })\n' +
      '  * Untuk pilihan_ganda / hots / berbasis_gambar / pemahaman_bacaan / berbasis_bacaan / analisis_data / interpretasi_grafik: berikan tepat ' +
      optCount +
      ' opsi (' +
      (config.language === 'Arab' ? arabicOptLabels : latinOptLabels) +
      ') dengan TEPAT 1 isCorrect=true.\n' +
      '  * Untuk pilihan_ganda_kompleks: berikan ' + optCount + ' opsi dengan 2 atau 3 isCorrect=true.\n' +
      '  * Untuk benar_salah: berikan tepat 2 opsi (Benar & Salah, atau صواب & خطأ).\n' +
      '- matching_pairs (array of { "id": "1", "left": "...", "right": "..." } berisi 4 pasang untuk tipe menjodohkan. Instruksi prompt wajib merujuk Kolom Kiri (1-4), Pilihan Kanan (A-D), dan kotak isian jawaban yang tersedia)\n' +
      '- sequence_items (array of strings dalam urutan BENAR untuk tipe mengurutkan)\n' +
      '- correct_answer (string kunci jawaban utama)\n' +
      '- correct_answers (array of strings untuk pilihan_ganda_kompleks)\n' +
      '- explanation (string pembahasan mendidik & alasan mengapa pilihan lain salah)\n' +
      '- distractor_analysis (string ringkasan analisis pengecoh)\n' +
      '- rubric (string pedoman penilaian, kriteria & rentang skor — WAJIB untuk esai, studi_kasus, analisis_teks, pemecahan_masalah)\n' +
      '- capaian_pembelajaran (string Capaian Pembelajaran Kurikulum Merdeka sesuai fase jenjang)\n' +
      '- tujuan_pembelajaran (string Tujuan Pembelajaran Kurikulum Merdeka yang diukur soal ini)\n' +
      '- indikator_soal (string rumusan Indikator Soal berpola "Disajikan ..., peserta didik dapat ... dengan tepat")\n' +
      '- visual_needed (boolean: true HANYA jika gambar/diagram/grafik benar-benar diperlukan untuk menjawab)\n' +
      '- svg_markup (string SVG berlatar putih <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 260" width="480" height="260"><rect width="480" height="260" fill="#ffffff" rx="8"/>...</svg> jika visual_needed=true)\n' +
      '- visual_caption (string keterangan gambar jika visual_needed=true)\n' +
      '- Untuk memisah_hijaiyah: berikan 1 kata Arab berharakat utuh di arabic_prompt (is_arabic=true), dan correct_answer berisi huruf hijaiyah terpisah dengan tanda "-" beserta harakat (misal: مَ - دْ - رَ - سَ - ةٌ).\n' +
      '- Untuk menyambung_hijaiyah: berikan huruf hijaiyah terpisah dengan tanda "-" di arabic_prompt (is_arabic=true), dan correct_answer berisi kata sambung yang benar (misal: كِتَابٌ).\n' +
      '- Untuk menulis_ulang_kalimat: ikuti pengaturan panjang kata (1 kata, 2 kata, 3 kata, dst. atau bertahap), letakkan kalimat sasaran di arabic_prompt/reading_passage dan kunci sama persis di correct_answer.\n' +
      '- Untuk menebalkan_mewarnai_arab: WAJIB is_arabic=true. Berikan 1-3 kata Arab berharakat penuh yang relevan dengan materi pada arabic_prompt (misal: بَيْتٌ جَمِيلٌ atau مَدْرَسَةٌ), arti Indonesianya pada reading_translation, instruksi menebalkan garis dan mewarnai kata/kalimat pada prompt, correct_answer berisi teks Arab tersebut, dan rubric berisi kriteria kerapian garis & pewarnaan.\n' +
      arabicBlock
    );
  }

  function normalizeGeneratedQuestion_(raw, projectId, userId, number, config) {
    var type = String(raw.type || 'pilihan_ganda');
    var options = Array.isArray(raw.options) ? raw.options : [];
    var targetOptCount = Number(config.optionCount || 5);
    if (targetOptCount !== 3 && targetOptCount !== 4 && targetOptCount !== 5) targetOptCount = 5;
    var singleChoiceTypes = ['pilihan_ganda', 'hots', 'berbasis_gambar', 'pemahaman_bacaan', 'berbasis_bacaan', 'analisis_data', 'interpretasi_grafik'];
    var isSingleMc = singleChoiceTypes.indexOf(type) !== -1;
    var isMultiMc = type === 'pilihan_ganda_kompleks';
    var labelSet = config.language === 'Arab' ? ['أ', 'ب', 'ج', 'د', 'هـ'] : ['A', 'B', 'C', 'D', 'E'];

    if ((isSingleMc || isMultiMc) && options.length > 0) {
      var working = options.map(function (o) {
        return {
          text: Utils.cleanAsterisks(o.text || ''),
          isCorrect: Boolean(o.isCorrect),
          distractorReason: Utils.cleanAsterisks(o.distractorReason || ''),
        };
      });

      if (working.length > targetOptCount) {
        var corrects = working.filter(function (o) { return o.isCorrect; });
        var distractors = working.filter(function (o) { return !o.isCorrect; });
        if (isSingleMc) {
          var keptC = corrects[0] || working[0];
          keptC.isCorrect = true;
          working = [keptC].concat(distractors.slice(0, Math.max(0, targetOptCount - 1)));
        } else {
          var targetCs = corrects.slice(0, Math.max(1, Math.min(2, targetOptCount - 1)));
          working = targetCs.concat(distractors.slice(0, Math.max(0, targetOptCount - targetCs.length))).slice(0, targetOptCount);
        }
      }

      if (config.shuffleOptions && working.length > 1) {
        for (var i = working.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var tmp = working[i];
          working[i] = working[j];
          working[j] = tmp;
        }
      }

      options = working.map(function (item, idx) {
        return {
          label: labelSet[idx] || String.fromCharCode(65 + idx),
          text: item.text,
          isCorrect: item.isCorrect,
          distractorReason: item.distractorReason,
        };
      });

      if (isSingleMc) {
        var foundCorrect = options.filter(function (o) { return o.isCorrect; })[0];
        if (foundCorrect) raw.correct_answer = foundCorrect.label;
      } else {
        raw.correct_answers = options.filter(function (o) { return o.isCorrect; }).map(function (o) { return o.label; });
        raw.correct_answer = raw.correct_answers.join(', ');
      }
    }

    var svg = raw.visual_needed ? Utils.sanitizeSvg(raw.svg_markup) : '';
    var cleanedPrompt = Utils.cleanAsterisks(raw.prompt || '');
    var cleanedReading = Utils.cleanAsterisks(raw.reading_passage || '');
    var cleanedArabicPrompt = Utils.cleanAsterisks(raw.arabic_prompt || '');
    var isArabic =
      Boolean(raw.is_arabic) ||
      config.language === 'Arab' ||
      String(config.language).indexOf('Arab') !== -1 ||
      Utils.isArabicText(cleanedPrompt);

    var matchingPairs = Array.isArray(raw.matching_pairs)
      ? raw.matching_pairs.map(function (mp) {
          return {
            id: mp.id || '',
            left: Utils.cleanAsterisks(mp.left || ''),
            right: Utils.cleanAsterisks(mp.right || ''),
          };
        })
      : [];
    var computedCorrectAnswer = Utils.cleanAsterisks(raw.correct_answer || '');
    if (type === 'menjodohkan' && matchingPairs.length > 0) {
      var order =
        matchingPairs.length === 4
          ? [1, 3, 0, 2]
          : matchingPairs.map(function (_, idx) {
              return matchingPairs.length > 1 ? (idx + 1) % matchingPairs.length : 0;
            });
      computedCorrectAnswer = matchingPairs
        .map(function (pair, idx) {
          var rightIdx = order.indexOf(idx);
          var letter = String.fromCharCode(65 + (rightIdx >= 0 ? rightIdx : idx));
          return (idx + 1) + ' → ' + letter + ' (' + (pair.right || '') + ')';
        })
        .join('; ');
    }

    return {
      question_id: Utils.generateUUID(),
      project_id: projectId,
      user_id: userId,
      number: number,
      type: type,
      topic_tag: Utils.cleanAsterisks(Utils.sanitizeText(raw.topic_tag || config.subtitles[0] || config.title, 180)),
      difficulty: raw.difficulty || 'Sedang',
      cognitive_level: raw.cognitive_level || 'C3',
      thinking_tier: raw.thinking_tier || 'MOTS',
      weight: Number(raw.weight) > 0 ? Number(raw.weight) : 2,
      is_arabic: isArabic,
      is_rtl: Utils.isPureArabicBlock(cleanedPrompt),
      reading_passage: cleanedReading,
      reading_translation: Utils.cleanAsterisks(raw.reading_translation || ''),
      prompt: cleanedPrompt,
      arabic_prompt: cleanedArabicPrompt,
      options: options,
      matching_pairs: matchingPairs,
      sequence_items: Array.isArray(raw.sequence_items) ? raw.sequence_items.map(Utils.cleanAsterisks) : [],
      correct_answer: computedCorrectAnswer,
      correct_answers: Array.isArray(raw.correct_answers) ? raw.correct_answers.map(Utils.cleanAsterisks) : [],
      explanation: Utils.cleanAsterisks(raw.explanation || ''),
      distractor_analysis: Utils.cleanAsterisks(raw.distractor_analysis || ''),
      rubric: Utils.cleanAsterisks(raw.rubric || ''),
      capaian_pembelajaran: Utils.cleanAsterisks(raw.capaian_pembelajaran || ''),
      tujuan_pembelajaran: Utils.cleanAsterisks(raw.tujuan_pembelajaran || ''),
      indikator_soal: Utils.cleanAsterisks(raw.indikator_soal || ''),
      image_file_id: '',
      image_url: '',
      svg_markup: svg,
      visual_caption: svg ? Utils.cleanAsterisks(raw.visual_caption || 'Ilustrasi pendukung soal') : '',
      verified_by_ai: true,
      created_at: Utils.nowIso(),
      updated_at: Utils.nowIso(),
    };
  }

  function generateBatch(batchTypesMap, config, projectId, userId, startNumber, existingPrompts, requestId) {
    var typeSummary = Object.keys(batchTypesMap)
      .filter(function (k) {
        return batchTypesMap[k] > 0;
      })
      .map(function (k) {
        return '- ' + batchTypesMap[k] + ' soal bertipe "' + k + '" (' + (TYPE_LABELS[k] || k) + ')';
      })
      .join('\n');

    var userPrompt =
      'Susun paket soal berdasarkan spesifikasi berikut:\n' +
      '- Judul Materi: ' + config.title + '\n' +
      '- Subjudul / Pokok Bahasan:\n' +
      (config.subtitles || []).map(function (s, idx) {
        return '  ' + (idx + 1) + '. ' + s;
      }).join('\n') +
      '\n- Deskripsi Tambahan: ' + (config.description || '-') +
      '\n- Referensi Materi: ' + (config.referenceText || '-') +
      '\n- Jenjang: ' + config.level + ' | Kelas/Tingkat: ' + (config.grade || config.gradeClass || '-') +
      '\n- Mata Pelajaran: ' + config.subject +
      '\n- Bahasa: ' + config.language +
      '\n- Jumlah Opsi Pilihan Ganda: TEPAT ' + ([3, 4, 5].indexOf(Number(config.optionCount)) !== -1 ? Number(config.optionCount) : 5) + ' opsi' +
      '\n- Tingkat Kesulitan: ' + config.difficulty +
      '\n- Level Kognitif Bloom: ' + (config.cognitiveLevels || ['C2', 'C3', 'C4']).join(', ') +
      '\n- Target Persentase HOTS: ' + (config.hotsPercentage !== undefined ? config.hotsPercentage : 30) + '%' +
      '\n- Kedalaman Materi: ' + (config.depth || 'Menengah') +
      '\n- Panjang Soal: ' + (config.questionLength || 'Standar') +
      (config.counts && Number(config.counts.menulis_ulang_kalimat || 0) > 0
        ? '\n- Panjang Kata Menulis Ulang Kalimat: ' +
          (config.rewriteWordMode === 'exact'
            ? 'Tepat ' + (config.rewriteWordCount || 1) + ' kata per soal'
            : 'Bertahap: 1 kata, 2 kata, 3 kata, 4 kata, dst.')
        : '') +
      '\n\nKOMPOSISI BATCH INI (HARUS TEPAT JUMLAH & TIPE):\n' + typeSummary +
      (existingPrompts && existingPrompts.length > 0
        ? '\n\nHINDARI KEMIRIPAN DENGAN SOAL YANG SUDAH ADA:\n' +
          existingPrompts.slice(-15).map(function (p, i) {
            return (i + 1) + '. ' + String(p).substring(0, 120);
          }).join('\n')
        : '');

    var aiResult = GeminiService.chatCompletion({
      systemPrompt: buildSystemPrompt_(config),
      userPrompt: userPrompt,
      expectJson: true,
      requestId: requestId,
      userId: userId,
      actionName: 'generate_batch',
    });

    var parsed = GeminiService.extractJsonFromText(aiResult.content);
    var rawList = parsed && Array.isArray(parsed.questions)
      ? parsed.questions
      : Array.isArray(parsed)
      ? parsed
      : [];

    if (rawList.length === 0) {
      throw new Error('Model AI tidak mengembalikan array soal JSON yang valid.');
    }

    return rawList.map(function (item, idx) {
      return normalizeGeneratedQuestion_(item, projectId, userId, startNumber + idx, config);
    });
  }

  function repairInvalidQuestion(badQuestion, errors, config, existingPrompts, requestMeta) {
    var repairPrompt =
      'Perbaiki 1 soal berikut yang memiliki kesalahan validasi:\n' +
      'Kesalahan ditemukan: ' + errors.join('; ') + '\n' +
      'Materi: ' + config.title + ' (' + config.subject + ', ' + config.level + ', ' + config.language + ')\n' +
      'Soal bermasalah:\n' + JSON.stringify(badQuestion) + '\n\n' +
      'Kembalikan JSON valid { "questions": [ { ...soal_diperbaiki... } ] } tanpa mengulang soal yang sudah ada:\n' +
      existingPrompts.slice(0, 8).join('\n');

    var aiResult = GeminiService.chatCompletion({
      systemPrompt: buildSystemPrompt_(config),
      userPrompt: repairPrompt,
      expectJson: true,
      requestId: requestMeta && requestMeta.requestId,
      userId: requestMeta && requestMeta.userId,
      actionName: 'repair_question',
    });

    var parsed = GeminiService.extractJsonFromText(aiResult.content);
    var rawList = parsed && Array.isArray(parsed.questions) ? parsed.questions : [];
    if (rawList.length === 0) throw new Error('Gagal memparsing hasil perbaikan soal.');

    var normalized = normalizeGeneratedQuestion_(
      rawList[0],
      badQuestion.project_id,
      badQuestion.user_id,
      badQuestion.number,
      config
    );
    normalized.question_id = badQuestion.question_id;
    return normalized;
  }

  function regenerateSingleQuestion(project, existingQuestion, instruction, userId, requestId) {
    var otherPrompts = QuestionService.getQuestionsByProject(project.project_id)
      .filter(function (q) {
        return q.question_id !== existingQuestion.question_id;
      })
      .map(function (q) {
        return q.prompt;
      });

    var config = Utils.safeJsonParse(project.config_json, {});
    config.title = project.title;
    config.subtitles = Utils.safeJsonParse(project.subtitles_json, [project.title]);
    config.subject = project.subject;
    config.level = project.level;
    config.grade = project.grade;
    config.language = project.language;
    config.difficulty = existingQuestion.difficulty || config.difficulty || 'Sedang';

    var optCount = [3, 4, 5].indexOf(Number(config.optionCount)) !== -1 ? Number(config.optionCount) : 5;
    var prompt =
      'Buat ulang 1 butir soal BARU yang berbeda untuk menggantikan soal nomor ' +
      existingQuestion.number +
      '.\nJenjang: ' + (config.level || '-') + ' | Kelas/Tingkat: ' + (config.grade || config.gradeClass || '-') +
      '\nTipe soal yang diminta: ' + existingQuestion.type +
      '\nJumlah Opsi Pilihan Ganda: TEPAT ' + optCount + ' opsi' +
      '\nSubjudul: ' + (existingQuestion.topic_tag || project.title) +
      '\nLevel kognitif: ' + existingQuestion.cognitive_level +
      '\nBobot nilai: ' + existingQuestion.weight +
      '\nSoal lama (JANGAN diulang):\n"' + existingQuestion.prompt + '"\n' +
      (instruction ? '\nInstruksi khusus guru: "' + instruction + '"\n' : '') +
      '\nHindari kemiripan dengan soal lain:\n' +
      otherPrompts.slice(0, 12).map(function (p, idx) {
        return (idx + 1) + '. ' + p.substring(0, 100);
      }).join('\n') +
      '\nKembalikan JSON { "questions": [ { ... } ] }.';

    var aiResult = GeminiService.chatCompletion({
      systemPrompt: buildSystemPrompt_(config),
      userPrompt: prompt,
      expectJson: true,
      requestId: requestId,
      userId: userId,
      actionName: 'regenerate_single_question',
    });

    var parsed = GeminiService.extractJsonFromText(aiResult.content);
    var rawList = parsed && Array.isArray(parsed.questions) ? parsed.questions : [];
    if (rawList.length === 0) {
      throw new Error('Gagal menghasilkan soal pengganti dari AI.');
    }

    var replacement = normalizeGeneratedQuestion_(
      rawList[0],
      project.project_id,
      userId,
      existingQuestion.number,
      config
    );
    replacement.question_id = existingQuestion.question_id;
    return replacement;
  }

  function toStandaloneQuestion_(raw, number, config) {
    var norm = normalizeGeneratedQuestion_(raw, 'standalone', 'standalone', number, config);
    var stimulus = norm.arabic_prompt || norm.reading_passage || (norm.type === 'menebalkan_mewarnai_arab' ? norm.correct_answer : '') || '';
    var wordCountLabel = '';
    var letterBoxes = 5;

    if (norm.type === 'memisah_hijaiyah') {
      var lettersOnly = String(stimulus || norm.prompt || '').replace(/[\u064B-\u065F\u0670\u0640\s\-]/g, '');
      letterBoxes = Math.max(3, Math.min(10, lettersOnly.length || 5));
    } else if (norm.type === 'menulis_ulang_kalimat') {
      var targetText = stimulus || norm.correct_answer || '';
      var wc = String(targetText).trim().split(/\s+/).filter(Boolean).length;
      if (wc > 0) wordCountLabel = wc + ' Kata';
    }

    return {
      id: norm.question_id,
      number: number,
      type: norm.type,
      topicTag: norm.topic_tag,
      difficulty: norm.difficulty,
      cognitiveLevel: norm.cognitive_level,
      thinkingTier: norm.thinking_tier,
      weight: norm.weight,
      isArabic: norm.is_arabic,
      isRTL: Utils.isPureArabicBlock(stimulus || norm.prompt),
      readingPassage: norm.reading_passage || '',
      readingTranslation: norm.reading_translation || '',
      prompt: norm.prompt,
      arabicPrompt: norm.arabic_prompt || '',
      stimulus: stimulus,
      stimulusSub: norm.reading_translation || '',
      letterBoxes: letterBoxes,
      wordCountLabel: wordCountLabel,
      options: norm.options || [],
      matchingPairs: norm.matching_pairs || [],
      sequenceItems: norm.sequence_items || [],
      correctAnswer: norm.correct_answer,
      correctAnswers: norm.correct_answers || [],
      explanation: norm.explanation,
      distractorAnalysis: norm.distractor_analysis || '',
      rubric: norm.rubric || '',
      capaianPembelajaran: norm.capaian_pembelajaran || '',
      tujuanPembelajaran: norm.tujuan_pembelajaran || '',
      indikatorSoal: norm.indikator_soal || '',
      svgMarkup: norm.svg_markup || '',
      visualCaption: norm.visual_caption || '',
      verifiedByAI: true,
    };
  }

  function generateStandaloneBatch(configPayload, requestId) {
    var cfg = Config.getConfig();
    var counts = configPayload.counts || {};
    var totalReq = Object.keys(counts).reduce(function (sum, k) {
      return sum + Math.max(0, Math.floor(Number(counts[k] || 0)));
    }, 0);
    if (totalReq <= 0) {
      throw new Error('Pilih minimal 1 jenis soal dengan jumlah lebih dari 0.');
    }
    if (totalReq > cfg.MAX_QUESTIONS) {
      throw new Error('Jumlah soal per permintaan melebihi batas maksimal (' + cfg.MAX_QUESTIONS + ').');
    }

    var config = Object.assign(
      {
        title: 'Evaluasi Pembelajaran',
        subtitles: ['Materi Pokok'],
        subject: 'Bahasa Arab',
        level: 'SMP',
        language: 'Bilingual (Arab-Indonesia)',
        difficulty: 'Campuran',
        cognitiveLevels: ['C2', 'C3', 'C4'],
        thinkingTier: 'Campuran',
        harakatMode: 'Penuh (Syakal Lengkap)',
        shuffleOptions: true,
        rewriteWordMode: 'progressive',
        rewriteWordCount: 3,
      },
      configPayload || {}
    );

    var typeSummary = Object.keys(counts)
      .filter(function (k) {
        return Number(counts[k] || 0) > 0;
      })
      .map(function (k) {
        return '- ' + counts[k] + ' soal bertipe "' + k + '" (' + (TYPE_LABELS[k] || k) + ')';
      })
      .join('\n');

    var customWordsBlock = config.customWordsText && String(config.customWordsText).trim()
      ? '\n- Daftar Kata / Kalimat Kustom dari Guru (PRIORITASKAN untuk memisah_hijaiyah, menyambung_hijaiyah, atau menulis_ulang_kalimat):\n' +
        String(config.customWordsText).trim()
      : '';

    var existingPrompts = Array.isArray(config.existingPrompts) ? config.existingPrompts : [];
    var startNumber = Math.max(1, Number(config.startNumber || 1));

    var userPrompt =
      'Susun paket soal LIVE berdasarkan spesifikasi berikut:\n' +
      '- Judul Materi: ' + config.title + '\n' +
      '- Subjudul / Pokok Bahasan:\n' +
      (config.subtitles || []).map(function (s, idx) {
        return '  ' + (idx + 1) + '. ' + s;
      }).join('\n') +
      '\n- Jenjang: ' + config.level + ' | Kelas/Tingkat: ' + (config.grade || config.gradeClass || '-') +
      '\n- Mata Pelajaran: ' + config.subject +
      '\n- Bahasa Soal: ' + config.language +
      '\n- Jumlah Opsi Pilihan Ganda: TEPAT ' + (Number(config.optionCount || 5)) + ' opsi' +
      '\n- Mode Harakat: ' + (config.harakatMode || 'Penuh (Syakal Lengkap)') +
      '\n- Tingkat Kesulitan: ' + config.difficulty +
      '\n- Orientasi Berpikir: ' + (config.thinkingTier || 'Campuran') +
      '\n- Level Kognitif Bloom: ' + (config.cognitiveLevels || ['C2', 'C3', 'C4']).join(', ') +
      customWordsBlock +
      (Number(counts.menulis_ulang_kalimat || 0) > 0
        ? '\n- Panjang Kata Soal "menulis_ulang_kalimat": ' +
          (config.rewriteWordMode === 'exact'
            ? 'TEPAT ' + (config.rewriteWordCount || 1) + ' kata per soal'
            : 'BERTAHAP mulai dari 1 kata, 2 kata, 3 kata, 4 kata, dst.')
        : '') +
      '\n\nKOMPOSISI SOAL WAJIB (HARUS TEPAT JUMLAH & TIPENYA):\n' +
      typeSummary +
      (existingPrompts.length > 0
        ? '\n\nHINDARI DUPLIKASI DENGAN SOAL YANG SUDAH DIBUAT:\n' +
          existingPrompts.slice(-20).map(function (p, i) {
            return (i + 1) + '. ' + String(p).substring(0, 110);
          }).join('\n')
        : '');

    var aiResult = GeminiService.chatCompletion({
      systemPrompt: buildSystemPrompt_(config),
      userPrompt: userPrompt,
      expectJson: true,
      requestId: requestId,
      userId: 'standalone',
      actionName: 'standalone_generate',
    });

    var parsed = GeminiService.extractJsonFromText(aiResult.content);
    var rawList = parsed && Array.isArray(parsed.questions)
      ? parsed.questions
      : Array.isArray(parsed)
      ? parsed
      : [];

    if (rawList.length === 0) {
      throw new Error('Google AI Studio tidak mengembalikan array soal JSON yang valid.');
    }

    var questions = rawList.map(function (item, idx) {
      return toStandaloneQuestion_(item, startNumber + idx, config);
    });

    return {
      questions: questions,
      model: aiResult.model,
      usage: aiResult.usage,
      provider: 'Google AI Studio (Gemini)',
    };
  }

  function regenerateStandaloneQuestion(payload, requestId) {
    var config = payload.config || {};
    var existing = payload.existingQuestion || {};
    var instruction = payload.instruction || '';
    var otherPrompts = Array.isArray(payload.otherPrompts) ? payload.otherPrompts : [];

    var optCount = [3, 4, 5].indexOf(Number(config.optionCount)) !== -1 ? Number(config.optionCount) : 5;
    var userPrompt =
      'Buat ulang 1 butir soal BARU yang berbeda untuk menggantikan soal nomor ' +
      (existing.number || 1) +
      '.\nMateri: ' + (config.title || '-') + ' (' + (config.subject || '-') + ', Jenjang ' + (config.level || '-') + ', Kelas/Tingkat ' + (config.grade || config.gradeClass || '-') + ', Bahasa ' + (config.language || '-') + ')' +
      '\nTipe soal: ' + (existing.type || 'pilihan_ganda') +
      '\nJumlah Opsi Pilihan Ganda: TEPAT ' + optCount + ' opsi' +
      '\nSoal lama (JANGAN diulang):\n"' + (existing.prompt || '') + '"' +
      (instruction ? '\nInstruksi guru: "' + instruction + '"' : '') +
      (otherPrompts.length > 0
        ? '\nHindari kemiripan dengan soal lain:\n' + otherPrompts.slice(0, 12).map(function (p, i) {
            return (i + 1) + '. ' + String(p).substring(0, 100);
          }).join('\n')
        : '') +
      '\nKembalikan JSON { "questions": [ { ... } ] }.';

    var aiResult = GeminiService.chatCompletion({
      systemPrompt: buildSystemPrompt_(config),
      userPrompt: userPrompt,
      expectJson: true,
      requestId: requestId,
      userId: 'standalone',
      actionName: 'standalone_regenerate',
    });

    var parsed = GeminiService.extractJsonFromText(aiResult.content);
    var rawList = parsed && Array.isArray(parsed.questions)
      ? parsed.questions
      : Array.isArray(parsed)
      ? parsed
      : [];
    if (rawList.length === 0) {
      throw new Error('Gagal menghasilkan soal pengganti dari Google AI Studio.');
    }

    var q = toStandaloneQuestion_(rawList[0], Number(existing.number || 1), config);
    if (existing.id) q.id = existing.id;
    return {
      question: q,
      model: aiResult.model,
      usage: aiResult.usage,
    };
  }

  function cleanRppDeep_(obj) {
    if (typeof obj === 'string') return Utils.cleanAsterisks(obj);
    if (Array.isArray(obj)) return obj.map(cleanRppDeep_);
    if (obj && typeof obj === 'object') {
      var out = {};
      Object.keys(obj).forEach(function (k) {
        out[k] = cleanRppDeep_(obj[k]);
      });
      return out;
    }
    return obj;
  }

  function generateRppKurmer(configPayload, requestId) {
    var cfg = configPayload || {};
    var topic = Utils.cleanAsterisks(cfg.topic || cfg.title || 'Materi Pembelajaran');
    var subtopics = Array.isArray(cfg.subtopics) ? cfg.subtopics.map(Utils.cleanAsterisks) : [topic];
    var subject = cfg.subject || 'Bahasa Arab';
    var level = cfg.level || 'SD';
    var gradeClass = cfg.gradeClass || cfg.grade || 'Kelas 3';
    var fase = cfg.fase || 'Fase B (Kelas 3-4)';
    var semester = cfg.semester || 'Ganjil (I)';
    var academicYear = cfg.academicYear || '2025/2026';
    var alokasiWaktu = cfg.alokasiWaktu || '2 x 35 Menit (1 Pertemuan)';
    var jumlahPertemuan = cfg.jumlahPertemuan || '1 Pertemuan';
    var modelPembelajaran = cfg.modelPembelajaran || 'Discovery Learning / Pembelajaran Aktif';
    var targetPesertaDidik = cfg.targetPesertaDidik || ('Peserta didik reguler ' + gradeClass);

    var sysPrompt =
      'Anda adalah pakar kurikulum nasional (Kurikulum Merdeka Kemendikbudristek) dan penyusun Modul Ajar / RPP SIT PLUS CORDOVA.\n' +
      'ATURAN FORMAT: DILARANG keras menggunakan tanda bintang (*, **), pagar (#), atau backtick dalam seluruh nilai teks JSON.\n' +
      'Kembalikan HANYA JSON valid dengan properti: kompetensiAwal, profilPelajarPancasila (array of strings), saranaPrasarana, capaianPembelajaran, tujuanPembelajaran (array of strings), pemahamanBermakna, pertanyaanPemantik (array of strings), kegiatanPembelajaran ({ pendahuluan: { durasi, langkah: [] }, inti: { durasi, langkah: [] }, penutup: { durasi, langkah: [] } }), asesmen ({ diagnostik, formatif, sumatif }), pengayaanRemedial ({ pengayaan, remedial }), refleksi ({ pendidik, pesertaDidik }), glosarium ([{ term, definition }]), daftarPustaka.';

    var usrPrompt =
      'Susun Modul Ajar / RPP Kurikulum Merdeka lengkap & aplikatif untuk:\n' +
      '- Satuan Pendidikan: ' + (cfg.institutionName || 'SIT PLUS CORDOVA (SD-SMA)') + '\n' +
      '- Guru Penyusun: ' + (cfg.teacherName || 'Ustdz Mulyadi, S.T.') + '\n' +
      '- Mata Pelajaran: ' + subject + '\n' +
      '- Jenjang / Kelas / Fase: ' + level + ' · ' + gradeClass + ' (' + fase + ')\n' +
      '- Semester / Tahun Ajaran: ' + semester + ' / ' + academicYear + '\n' +
      '- Topik / Materi Utama: ' + topic + '\n' +
      '- Subtopik: ' + subtopics.join(', ') + '\n' +
      '- Alokasi Waktu: ' + alokasiWaktu + ' (' + jumlahPertemuan + ')\n' +
      '- Model Pembelajaran: ' + modelPembelajaran + '\n' +
      '- Target Peserta Didik: ' + targetPesertaDidik;

    var aiResult = GeminiService.chatCompletion({
      systemPrompt: sysPrompt,
      userPrompt: usrPrompt,
      expectJson: true,
      requestId: requestId,
      userId: 'standalone',
      actionName: 'generate_rpp',
    });

    var parsed = GeminiService.extractJsonFromText(aiResult.content);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Model AI tidak mengembalikan JSON Modul Ajar RPP Kurikulum Merdeka yang valid.');
    }

    var cleaned = cleanRppDeep_(parsed);
    cleaned.institutionName = Utils.cleanAsterisks(cfg.institutionName || 'SEKOLAH ISLAM TERPADU PLUS CORDOVA (SD–SMA)');
    cleaned.institutionAddress = Utils.cleanAsterisks(cfg.institutionAddress || 'Sekolah Islam Terpadu Plus Cordova · Jenjang SD–SMA');
    cleaned.teacherName = Utils.cleanAsterisks(cfg.teacherName || 'Ustdz Mulyadi, S.T.');
    cleaned.teacherNip = Utils.cleanAsterisks(cfg.teacherNip || '-');
    cleaned.principalName = Utils.cleanAsterisks(cfg.principalName || 'Kepala Sekolah SIT PLUS CORDOVA');
    cleaned.principalNip = Utils.cleanAsterisks(cfg.principalNip || '-');
    cleaned.subject = subject;
    cleaned.level = level;
    cleaned.gradeClass = gradeClass;
    cleaned.fase = fase;
    cleaned.semester = semester;
    cleaned.academicYear = academicYear;
    cleaned.topic = topic;
    cleaned.subtopics = subtopics;
    cleaned.alokasiWaktu = alokasiWaktu;
    cleaned.jumlahPertemuan = jumlahPertemuan;
    cleaned.modelPembelajaran = modelPembelajaran;
    cleaned.targetPesertaDidik = targetPesertaDidik;

    return {
      rpp: cleaned,
      model: aiResult.model,
      usage: aiResult.usage,
    };
  }

  return {
    TYPE_LABELS: TYPE_LABELS,
    generateBatch: generateBatch,
    repairInvalidQuestion: repairInvalidQuestion,
    regenerateSingleQuestion: regenerateSingleQuestion,
    generateStandaloneBatch: generateStandaloneBatch,
    regenerateStandaloneQuestion: regenerateStandaloneQuestion,
    generateRppKurmer: generateRppKurmer,
  };
})();
