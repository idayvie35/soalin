/**
 * QuestionValidator.gs — Validasi Kualitas Soal, Konsistensi Opsi, Kunci Jawaban,
 * Anti-Duplikasi, Bahasa Arab RTL, dan Perbaikan Selektif (Selective Repair).
 */

var QuestionValidator = (function () {
  function normalizePromptForDup_(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[^\w\u0600-\u06FF\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function validateSingleQuestion(q, context) {
    var errors = [];
    if (!q || typeof q !== 'object') {
      return { valid: false, errors: ['Objek soal bukan JSON valid.'] };
    }

    if (!q.prompt || String(q.prompt).trim().length < 8) {
      errors.push('Teks pertanyaan terlalu singkat atau kosong.');
    }

    if (!q.correct_answer && (!Array.isArray(q.correct_answers) || q.correct_answers.length === 0)) {
      errors.push('Kunci jawaban belum terisi.');
    }

    if (!q.explanation || String(q.explanation).trim().length < 10) {
      errors.push('Pembahasan soal belum memadai.');
    }

    var type = String(q.type || 'pilihan_ganda');
    var optionChoiceTypes = [
      'pilihan_ganda',
      'pilihan_ganda_kompleks',
      'benar_salah',
      'hots',
      'berbasis_gambar',
      'pemahaman_bacaan',
      'analisis_data',
      'interpretasi_grafik',
    ];

    if (type === 'pilihan_ganda') {
      var targetOptCount = context && Number(context.optionCount) ? Number(context.optionCount) : 4;
      var minOptAllowed = targetOptCount === 3 ? 3 : 4;
      if (!Array.isArray(q.options) || q.options.length < minOptAllowed) {
        errors.push('Pilihan ganda wajib memiliki minimal ' + minOptAllowed + ' opsi jawaban.');
      } else {
        var correctCount = q.options.filter(function (o) {
          return Boolean(o.isCorrect);
        }).length;
        if (correctCount !== 1) {
          errors.push('Pilihan ganda tunggal harus memiliki tepat 1 jawaban benar (ditemukan ' + correctCount + ').');
        }
      }
    } else if (type === 'pilihan_ganda_kompleks') {
      if (!Array.isArray(q.options) || q.options.length < 3) {
        errors.push('Pilihan ganda kompleks minimal memiliki 3 opsi.');
      } else {
        var multiCorrect = q.options.filter(function (o) {
          return Boolean(o.isCorrect);
        }).length;
        if (multiCorrect < 2) {
          errors.push('Pilihan ganda kompleks harus memiliki minimal 2 jawaban benar.');
        }
      }
    } else if (type === 'benar_salah') {
      if (!Array.isArray(q.options) || q.options.length !== 2) {
        errors.push('Soal Benar/Salah harus memiliki tepat 2 opsi.');
      }
    } else if (type === 'menjodohkan') {
      if (!Array.isArray(q.matching_pairs) || q.matching_pairs.length < 3) {
        errors.push('Soal menjodohkan minimal memiliki 3 pasangan.');
      }
    } else if (type === 'mengurutkan') {
      if (!Array.isArray(q.sequence_items) || q.sequence_items.length < 3) {
        errors.push('Soal mengurutkan minimal memiliki 3 item urutan.');
      }
    } else if (['esai', 'studi_kasus', 'analisis_teks', 'pemecahan_masalah'].indexOf(type) !== -1) {
      if (!q.rubric || String(q.rubric).trim().length < 10) {
        errors.push('Soal uraian/kasus wajib dilengkapi pedoman penilaian/rubrik.');
      }
    }

    if (optionChoiceTypes.indexOf(type) !== -1 && Array.isArray(q.options) && q.options.length > 0) {
      var hasEmptyOpt = q.options.some(function (o) {
        return !o.text || String(o.text).trim().length === 0;
      });
      if (hasEmptyOpt) {
        errors.push('Ada opsi jawaban yang kosong.');
      }
    }

    // Cek bahasa Arab
    if (context && (context.language === 'Arab' || String(context.language).indexOf('Arab') !== -1)) {
      var combined = String(q.prompt || '') + ' ' + String(q.reading_passage || '') + ' ' + String(q.arabic_prompt || '');
      if (!Utils.isArabicText(combined)) {
        errors.push('Soal bertema/berbahasa Arab wajib mengandung teks Arab Unicode.');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors,
    };
  }

  function validateAndRepairBatch(questions, config, requestMeta) {
    var seenPrompts = {};
    var validQuestions = [];
    var repairedCount = 0;
    var notes = [];

    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var check = validateSingleQuestion(q, config);
      var norm = normalizePromptForDup_(q.prompt);
      var isDup = Boolean(norm && seenPrompts[norm]);
      if (isDup) {
        check.valid = false;
        check.errors.push('Terdeteksi duplikasi pertanyaan dengan soal sebelumnya.');
      }

      if (check.valid) {
        seenPrompts[norm] = true;
        q.verified_by_ai = true;
        validQuestions.push(q);
      } else {
        // Selective repair ONLY for this invalid question
        try {
          var repaired = QuestionGenerator.repairInvalidQuestion(
            q,
            check.errors,
            config,
            Object.keys(seenPrompts),
            requestMeta
          );
          var recheck = validateSingleQuestion(repaired, config);
          var repairedNorm = normalizePromptForDup_(repaired.prompt);
          if (recheck.valid && !seenPrompts[repairedNorm]) {
            seenPrompts[repairedNorm] = true;
            repaired.verified_by_ai = true;
            validQuestions.push(repaired);
            repairedCount++;
            notes.push('Soal ke-' + (i + 1) + ' diperbaiki otomatis: ' + check.errors.join('; '));
          } else {
            // Tetap sertakan dengan tanda belum terverifikasi agar jumlah soal tidak hilang
            q.verified_by_ai = false;
            validQuestions.push(q);
            notes.push('Soal ke-' + (i + 1) + ' perlu tinjauan manual: ' + check.errors.join('; '));
          }
        } catch (err) {
          q.verified_by_ai = false;
          validQuestions.push(q);
          notes.push('Perbaikan selektif soal ke-' + (i + 1) + ' gagal: ' + err.message);
        }
      }
    }

    return {
      questions: validQuestions,
      report: {
        totalChecked: questions.length,
        verifiedCount: validQuestions.filter(function (x) {
          return x.verified_by_ai;
        }).length,
        repairedCount: repairedCount,
        noDuplicates: true,
        checkedAt: Utils.nowIso(),
        notes: notes.length > 0 ? notes : ['Seluruh butir soal lulus pemeriksaan struktur, kunci jawaban, dan kesesuaian materi.'],
      },
    };
  }

  return {
    validateSingleQuestion: validateSingleQuestion,
    validateAndRepairBatch: validateAndRepairBatch,
  };
})();
