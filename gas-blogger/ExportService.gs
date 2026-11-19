/**
 * ExportService.gs — Ekspor Resmi PDF & DOCX melalui Google Docs API + Google Drive
 * Menghasilkan file PDF dan DOCX biner yang valid, bukan HTML yang diubah ekstensi.
 */

var ExportService = (function () {
  function setParagraphRtlIfArabic_(paragraph, text, forceArabic, compact) {
    var cleanText = Utils.cleanAsterisks(text || '');
    var hasAr = Boolean(forceArabic) || Utils.isArabicText(cleanText);
    var pureAr = Utils.isPureArabicBlock(cleanText);
    if (pureAr) {
      try { paragraph.setLeftToRight(false); } catch (e) {}
      paragraph.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
    } else {
      try { paragraph.setLeftToRight(true); } catch (e) {}
      paragraph.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
    }
    if (hasAr) {
      try {
        paragraph.setAttributes({
          FONT_FAMILY: 'Amiri',
          FONT_SIZE: compact ? 11.5 : 12.5,
          LINE_SPACING: compact ? 1.25 : 1.4,
        });
      } catch (e) {}
    } else {
      try {
        paragraph.setAttributes({
          FONT_FAMILY: 'Arial',
          FONT_SIZE: compact ? 9.5 : 10.5,
          LINE_SPACING: compact ? 1.12 : 1.2,
        });
      } catch (e) {}
    }
    return pureAr;
  }

  function getFaseKurikulumMerdeka_(level, gradeClass) {
    var lvl = String(level || '').toUpperCase();
    var gr = String(gradeClass || '').toUpperCase();
    if (lvl.indexOf('SD') !== -1 || lvl.indexOf('MI') !== -1) {
      if (/\b(1|2|I|II)\b/.test(gr)) return 'Fase A (Kelas 1–2)';
      if (/\b(3|4|III|IV)\b/.test(gr)) return 'Fase B (Kelas 3–4)';
      return 'Fase C (Kelas 5–6)';
    }
    if (lvl.indexOf('SMP') !== -1 || lvl.indexOf('MTS') !== -1) return 'Fase D (Kelas 7–9)';
    if (lvl.indexOf('SMA') !== -1 || lvl.indexOf('SMK') !== -1 || lvl.indexOf('MA') !== -1) {
      if (/\b(10|X)\b/.test(gr)) return 'Fase E (Kelas 10)';
      return 'Fase F (Kelas 11–12)';
    }
    return 'Fase Umum';
  }

  function buildKisiKisiRow_(q, project) {
    var materi = q.topic_tag || project.title || project.subject || '-';
    var cog = q.cognitive_level || 'C2';
    var tier = q.thinking_tier || (cog === 'C1' || cog === 'C2' ? 'LOTS' : cog === 'C3' ? 'MOTS' : 'HOTS');
    var tp = q.tujuan_pembelajaran ||
      ('Peserta didik mampu memahami dan menerapkan konsep ' + materi + ' pada mata pelajaran ' + (project.subject || '-') + '.');
    var ind = q.indikator_soal ||
      ('Disajikan stimulus/pernyataan terkait ' + materi + ', peserta didik dapat menyelesaikan soal ' + (QuestionGenerator.TYPE_LABELS[q.type] || q.type) + ' dengan tepat.');
    return {
      number: q.number,
      tp: tp,
      materi: materi,
      indikator: ind,
      levelBentuk: cog + ' (' + tier + ')\n' + (QuestionGenerator.TYPE_LABELS[q.type] || q.type),
      weight: String(q.weight || 2),
    };
  }

  function appendHeaderAndIdentity_(doc, project, compact) {
    var body = doc.getBody();
    var header = project.header || {};

    if (header.logoFileId) {
      var logoBlob = ImageService.getImageBlobByFileId(header.logoFileId);
      if (logoBlob) {
        var logoPara = body.appendParagraph('');
        logoPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        var inlineLogo = logoPara.appendInlineImage(logoBlob);
        inlineLogo.setWidth(compact ? 42 : 52);
        inlineLogo.setHeight(compact ? 42 : 52);
      }
    }

    var instPara = body.appendParagraph(String(header.institutionName || 'SIT PLUS CORDOVA').toUpperCase());
    instPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    instPara.setSpacingAfter(1);
    instPara.editAsText().setBold(true).setFontSize(compact ? 12 : 13.5).setForegroundColor('#0F294A');

    if (header.institutionAddress) {
      var addrPara = body.appendParagraph(String(header.institutionAddress));
      addrPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      addrPara.setSpacingAfter(2);
      addrPara.editAsText().setFontSize(8.5).setForegroundColor('#475569');
    }

    body.appendHorizontalRule();

    var examTitle = body.appendParagraph(
      String(header.examTitle || 'LEMBAR EVALUASI').toUpperCase() +
      ' · ' + (project.subject || '') + ' (' + (project.title || '') + ')'
    );
    examTitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    examTitle.setSpacingBefore(2).setSpacingAfter(4);
    examTitle.editAsText().setBold(true).setFontSize(compact ? 10 : 11);

    var gradeDisplay = header.gradeClass || project.grade || '-';
    var faseStr = getFaseKurikulumMerdeka_(project.level, gradeDisplay);
    var metaRows = [
      [
        'Jenjang / Kelas / Fase : ' + (project.level || '-') + ' · ' + gradeDisplay + ' (' + faseStr + ')',
        'Pengampu / Waktu : ' + (header.teacherName || '-') + ' · ' + (header.timeAllocation || '90 Menit'),
      ],
    ];
    if (header.includeStudentIdentityBox !== false) {
      metaRows.push([
        'Nama Siswa : ........................................',
        'Kelas / No : ................... / ...................',
      ]);
    }
    var metaTable = body.appendTable(metaRows);
    metaTable.setBorderColor('#94A3B8');
    metaTable.setBorderWidth(1);
    for (var mr = 0; mr < metaTable.getNumRows(); mr++) {
      for (var mc = 0; mc < 2; mc++) {
        var cell = metaTable.getRow(mr).getCell(mc);
        cell.setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(6).setPaddingRight(6);
        cell.editAsText().setFontSize(compact ? 8.5 : 9.5);
      }
    }

    if (header.instructions) {
      var instNote = body.appendParagraph('Petunjuk: ' + header.instructions);
      instNote.setSpacingBefore(3).setSpacingAfter(5);
      instNote.editAsText().setItalic(true).setFontSize(8.5).setForegroundColor('#475569');
    }

    try {
      var docHeader = doc.addHeader();
      var hp = docHeader.appendParagraph(
        (header.institutionName || 'SIT PLUS CORDOVA') + ' · ' + (project.subject || '') + ' · ' + faseStr
      );
      hp.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
      hp.editAsText().setFontSize(7.5).setForegroundColor('#64748B');

      var docFooter = doc.addFooter();
      var fp = docFooter.appendParagraph('Naskah Evaluasi Kurikulum Merdeka · ' + (project.title || ''));
      fp.editAsText().setFontSize(7.5).setForegroundColor('#64748B');
    } catch (e) {}
  }

  function appendQuestionsSection_(body, questions, compact) {
    var bigArabicCount = 0;
    questions.forEach(function (q, qIdx) {
      if (q.type === 'menebalkan_mewarnai_arab') {
        if (bigArabicCount === 0 && qIdx > 0) {
          body.appendPageBreak();
        }
        var arTarget = q.arabic_prompt || q.reading_passage || q.correct_answer || '';
        var pHead = body.appendParagraph(q.number + '. ' + q.prompt + (q.reading_translation ? '  [Arti: ' + q.reading_translation + ']' : ''));
        pHead.setSpacingBefore(6).setSpacingAfter(4);
        pHead.editAsText().setBold(true).setFontSize(10.5).setForegroundColor('#0F172A');

        var wsTable = body.appendTable([
          ['A. Tebalkan Garis Kata / Kalimat Arab (التَّتَبُّعُ):\n' + arTarget],
          ['B. Warnailah Kata / Kalimat Arab Berikut (التَّلْوِينُ):\n' + arTarget],
        ]);
        wsTable.setBorderColor('#94A3B8');
        wsTable.setBorderWidth(1.5);
        for (var wr = 0; wr < 2; wr++) {
          var wCell = wsTable.getRow(wr).getCell(0);
          wCell.setPaddingTop(10).setPaddingBottom(16).setPaddingLeft(12).setPaddingRight(12);
          var cPara0 = wCell.getChild(0).asParagraph();
          cPara0.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
          cPara0.editAsText().setBold(true).setFontSize(9.5).setForegroundColor('#475569');
          if (wCell.getNumChildren() > 1) {
            var cPara1 = wCell.getChild(1).asParagraph();
            cPara1.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
            cPara1.setSpacingBefore(8).setSpacingAfter(10);
            cPara1.editAsText()
              .setFontFamily('Amiri')
              .setFontSize(wr === 0 ? 34 : 42)
              .setBold(true)
              .setForegroundColor(wr === 0 ? '#CBD5E1' : '#94A3B8');
          }
        }
        bigArabicCount++;
        if (bigArabicCount % 2 === 0 && qIdx < questions.length - 1) {
          body.appendPageBreak();
        } else {
          body.appendParagraph('').setSpacingAfter(8);
        }
        return;
      }

      var cleanPrompt = Utils.cleanAsterisks(q.prompt || '');
      var cleanPassage = Utils.cleanAsterisks(q.reading_passage || '');
      var cleanArabicPrompt = Utils.cleanAsterisks(q.arabic_prompt || '');
      var isArPrompt = Boolean(q.is_arabic) || Utils.isArabicText(cleanPrompt);

      if (cleanPassage) {
        var rp = body.appendParagraph(cleanPassage);
        setParagraphRtlIfArabic_(rp, cleanPassage, Utils.isArabicText(cleanPassage), compact);
        rp.setSpacingBefore(compact ? 3 : 5).setSpacingAfter(2);
      }

      var promptLine = Utils.isPureArabicBlock(cleanPrompt) ? (cleanPrompt + ' .' + q.number) : (q.number + '. ' + cleanPrompt);
      var pp = body.appendParagraph(promptLine);
      setParagraphRtlIfArabic_(pp, cleanPrompt, isArPrompt, compact);
      pp.editAsText().setBold(true);
      pp.setSpacingBefore(compact ? 4 : 6).setSpacingAfter(2);

      if (cleanArabicPrompt) {
        var ap = body.appendParagraph(cleanArabicPrompt);
        setParagraphRtlIfArabic_(ap, cleanArabicPrompt, true, compact);
        ap.setSpacingAfter(2);
      }

      if (q.image_file_id) {
        var imgBlob = ImageService.getImageBlobByFileId(q.image_file_id);
        if (imgBlob && imgBlob.getContentType().indexOf('svg') === -1) {
          var imgPara = body.appendParagraph('');
          imgPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
          var inlineImg = imgPara.appendInlineImage(imgBlob);
          var w = inlineImg.getWidth();
          var h = inlineImg.getHeight();
          var maxW = compact ? 300 : 380;
          if (w > maxW) {
            var ratio = maxW / w;
            inlineImg.setWidth(maxW);
            inlineImg.setHeight(Math.round(h * ratio));
          }
          if (q.visual_caption) {
            var capP = body.appendParagraph(q.visual_caption);
            capP.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
            capP.editAsText().setItalic(true).setFontSize(8.5).setForegroundColor('#475569');
          }
        }
      }

      if (Array.isArray(q.options) && q.options.length > 0) {
        var useTwoCol =
          compact &&
          q.options.length >= 2 &&
          q.options.every(function (o) {
            return Utils.cleanAsterisks(o.text || '').length <= 36;
          });

        if (useTwoCol) {
          var optRows = [];
          for (var oi = 0; oi < q.options.length; oi += 2) {
            var leftOpt = q.options[oi];
            var rightOpt = q.options[oi + 1];
            optRows.push([
              leftOpt ? leftOpt.label + '. ' + Utils.cleanAsterisks(leftOpt.text || '') : '',
              rightOpt ? rightOpt.label + '. ' + Utils.cleanAsterisks(rightOpt.text || '') : '',
            ]);
          }
          var optTbl = body.appendTable(optRows);
          optTbl.setBorderWidth(0);
          for (var ori = 0; ori < optTbl.getNumRows(); ori++) {
            for (var oci = 0; oci < 2; oci++) {
              var oCell = optTbl.getRow(ori).getCell(oci);
              oCell.setPaddingTop(1).setPaddingBottom(1).setPaddingLeft(10).setPaddingRight(6);
              var cellTxt = oCell.getText();
              if (Utils.isPureArabicBlock(cellTxt)) {
                try {
                  var cp = oCell.getChild(0).asParagraph();
                  cp.setLeftToRight(false);
                  cp.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
                } catch (e) {}
              }
              if (Utils.isArabicText(cellTxt)) {
                oCell.editAsText().setFontFamily('Amiri').setFontSize(11);
              } else {
                oCell.editAsText().setFontFamily('Arial').setFontSize(9.5);
              }
            }
          }
        } else {
          q.options.forEach(function (opt) {
            var optClean = Utils.cleanAsterisks(opt.text || '');
            var optAr = Utils.isArabicText(optClean);
            var line = '    ' + opt.label + '. ' + optClean;
            var op = body.appendParagraph(line);
            setParagraphRtlIfArabic_(op, opt.label + '. ' + optClean, optAr, compact);
            op.setSpacingAfter(1);
          });
        }
      }

      if (q.type === 'menjodohkan' && Array.isArray(q.matching_pairs) && q.matching_pairs.length > 0) {
        var pairs = q.matching_pairs;
        var order =
          pairs.length === 4
            ? [1, 3, 0, 2]
            : pairs.map(function (_, idx) {
                return pairs.length > 1 ? (idx + 1) % pairs.length : 0;
              });
        var lastLetter = String.fromCharCode(65 + Math.max(0, pairs.length - 1));
        var hintP = body.appendParagraph(
          '    Pasangkan Kolom Kiri (1–' +
            pairs.length +
            ') dengan Pilihan Kanan (A–' +
            lastLetter +
            '), lalu tuliskan jawaban pada kotak isian di bawah ini:'
        );
        hintP.editAsText().setItalic(true).setFontSize(8.5).setForegroundColor('#475569');
        hintP.setSpacingAfter(2);

        var colRows = [
          ['Kolom Kiri (1–' + pairs.length + ')', 'Pilihan Kanan (A–' + lastLetter + ')'],
        ];
        for (var rIdx = 0; rIdx < pairs.length; rIdx++) {
          var leftTxt = (rIdx + 1) + '. ' + (pairs[rIdx].left || '');
          var rightOrigIdx = order[rIdx];
          var rightTxt =
            String.fromCharCode(65 + rIdx) +
            '. ' +
            ((pairs[rightOrigIdx] && pairs[rightOrigIdx].right) || '');
          colRows.push([leftTxt, rightTxt]);
        }
        var pairTbl = body.appendTable(colRows);
        pairTbl.setBorderColor('#CBD5E1');
        pairTbl.setBorderWidth(1);
        for (var rowI = 0; rowI < pairTbl.getNumRows(); rowI++) {
          var tblRow = pairTbl.getRow(rowI);
          for (var colI = 0; colI < 2; colI++) {
            var cell = tblRow.getCell(colI);
            cell.setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(6).setPaddingRight(6);
            cell.editAsText().setFontSize(9.5);
            if (rowI === 0) {
              cell.setBackgroundColor('#F1F5F9');
              cell.editAsText().setBold(true).setFontSize(8.5).setForegroundColor('#0F294A');
            }
          }
        }

        var boxTitle = body.appendParagraph('    Kotak Isian Jawaban:');
        boxTitle.editAsText().setBold(true).setFontSize(8.5).setForegroundColor('#334155');
        boxTitle.setSpacingBefore(3).setSpacingAfter(2);

        var boxRows = [];
        for (var bIdx = 0; bIdx < pairs.length; bIdx++) {
          boxRows.push(['Jawaban No. ' + (bIdx + 1), '\n ']);
        }
        var boxTbl = body.appendTable(boxRows);
        boxTbl.setBorderColor('#94A3B8');
        boxTbl.setBorderWidth(1);
        for (var bRowI = 0; bRowI < boxTbl.getNumRows(); bRowI++) {
          var bRow = boxTbl.getRow(bRowI);
          bRow.getCell(0).setWidth(110).setBackgroundColor('#F8FAFC').setPaddingTop(5).setPaddingBottom(5).setPaddingLeft(6);
          bRow.getCell(0).editAsText().setBold(true).setFontSize(9).setForegroundColor('#334155');
          bRow.getCell(1).setPaddingTop(8).setPaddingBottom(12).setPaddingLeft(8);
        }
      }

      if (q.type === 'mengurutkan' && Array.isArray(q.sequence_items)) {
        var sorted = q.sequence_items.slice().sort();
        sorted.forEach(function (item, idx) {
          var sp = body.appendParagraph('    [ ' + (idx + 1) + ' ] ' + item);
          setParagraphRtlIfArabic_(sp, item, Utils.isArabicText(item), compact);
          sp.setSpacingAfter(1);
        });
      }

      if (['esai', 'studi_kasus', 'analisis_teks', 'pemecahan_masalah'].indexOf(q.type) !== -1) {
        var ansSpace = body.appendParagraph(
          'Jawaban: ...........................................................................................................'
        );
        ansSpace.editAsText().setForegroundColor('#94A3B8').setFontSize(9);
        ansSpace.setSpacingAfter(compact ? 6 : 10);
      }
    });
  }

  function appendKeysAndExplanations_(body, questions, mode, compact) {
    var heading = body.appendParagraph(
      mode === 'answer_key'
        ? 'KUNCI JAWABAN'
        : 'KUNCI JAWABAN, PEMBAHASAN & RUBRIK PENILAIAN'
    );
    heading.editAsText().setBold(true).setFontSize(11.5).setForegroundColor('#0F294A');
    heading.setSpacingBefore(4).setSpacingAfter(6);

    questions.forEach(function (q) {
      var keyStr = Utils.cleanAsterisks(
        Array.isArray(q.correct_answers) && q.correct_answers.length > 0
          ? q.correct_answers.join(', ')
          : q.correct_answer
      );

      var line =
        'No. ' +
        q.number +
        ' (' +
        (QuestionGenerator.TYPE_LABELS[q.type] || q.type) +
        ' · ' +
        q.cognitive_level +
        ' · ' +
        q.weight +
        ' pt) — Kunci: ' +
        keyStr;
      var kp = body.appendParagraph(line);
      kp.setSpacingBefore(compact ? 2 : 4).setSpacingAfter(1);
      kp.editAsText().setFontSize(compact ? 9 : 10).setForegroundColor('#047857').setBold(true);

      if (mode !== 'answer_key') {
        if (q.explanation) {
          var ep = body.appendParagraph('Pembahasan: ' + Utils.cleanAsterisks(q.explanation));
          ep.setSpacingAfter(1);
          ep.editAsText().setFontSize(compact ? 8.5 : 9.5).setForegroundColor('#334155');
        }
        if (q.rubric) {
          var rp = body.appendParagraph('Rubrik: ' + Utils.cleanAsterisks(q.rubric));
          rp.setSpacingAfter(2);
          rp.editAsText().setFontSize(8.5).setForegroundColor('#475569');
        }
      }
    });
  }

  function appendKisiKisiSection_(body, project) {
    var header = project.header || {};
    var faseStr = getFaseKurikulumMerdeka_(project.level, header.gradeClass || project.grade);
    var heading = body.appendParagraph('KISI-KISI PENULISAN SOAL (KURIKULUM MERDEKA)');
    heading.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    heading.editAsText().setBold(true).setFontSize(11.5).setForegroundColor('#0F294A');
    heading.setSpacingBefore(4).setSpacingAfter(2);

    var sub = body.appendParagraph(
      (header.institutionName || 'SIT PLUS CORDOVA') +
        ' · ' +
        (project.subject || '') +
        ' · ' +
        faseStr +
        ' · Penyusun: ' +
        (header.teacherName || '-')
    );
    sub.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    sub.editAsText().setFontSize(8.5).setForegroundColor('#475569');
    sub.setSpacingAfter(6);

    var firstCp = '';
    var qs = project.questions || [];
    for (var i = 0; i < qs.length; i++) {
      if (qs[i].capaian_pembelajaran) {
        firstCp = qs[i].capaian_pembelajaran;
        break;
      }
    }
    if (firstCp) {
      var cpPara = body.appendParagraph('Capaian Pembelajaran (CP): ' + firstCp);
      cpPara.editAsText().setFontSize(8.5).setItalic(true).setForegroundColor('#1E293B');
      cpPara.setSpacingAfter(5);
    }

    var rows = [
      ['No', 'Tujuan Pembelajaran (TP) & Materi', 'Indikator Soal', 'Level & Bentuk', 'Bobot'],
    ];
    qs.forEach(function (q) {
      var r = buildKisiKisiRow_(q, project);
      rows.push([
        String(r.number),
        r.tp + '\nMateri: ' + r.materi,
        r.indikator,
        r.levelBentuk,
        r.weight,
      ]);
    });

    var table = body.appendTable(rows);
    table.setBorderColor('#94A3B8');
    table.setBorderWidth(1);
    var colWidths = [28, 145, 200, 95, 36];
    for (var ri = 0; ri < table.getNumRows(); ri++) {
      var tRow = table.getRow(ri);
      for (var ci = 0; ci < 5; ci++) {
        var cell = tRow.getCell(ci);
        cell.setWidth(colWidths[ci]);
        cell.setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(4).setPaddingRight(4);
        if (ri === 0) {
          cell.setBackgroundColor('#E2E8F0');
          cell.editAsText().setBold(true).setFontSize(8.5).setForegroundColor('#0F294A');
        } else {
          cell.editAsText().setFontSize(8).setForegroundColor('#0F172A');
        }
      }
    }
  }

  function exportProjectDocument(session, projectId, options) {
    var project = ProjectService.getProjectDetail(session, projectId);
    var mode = (options && options.mode) || 'complete'; // questions_only | answer_key | explanations | complete | official_exam_sheet | kisi_kisi_only
    var format = (options && options.format) || 'pdf'; // pdf | docx | gdoc
    var compact = !(options && options.compact === false);
    var includeKisiKisi = !(options && options.includeKisiKisi === false);

    var folder = ImageService.getTargetFolder();
    var docName =
      (project.title || 'SIT-PLUS-CORDOVA') +
      '-' +
      mode +
      '-' +
      Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmm');

    var doc = DocumentApp.create(docName);
    var docId = doc.getId();
    var body = doc.getBody();

    // Margin A4 padat & hemat kertas (~12mm)
    var marginPt = compact ? 34 : 48;
    body.setMarginTop(marginPt);
    body.setMarginBottom(marginPt);
    body.setMarginLeft(marginPt);
    body.setMarginRight(marginPt);

    if (mode === 'questions_only' || mode === 'official_exam_sheet' || mode === 'complete') {
      appendHeaderAndIdentity_(doc, project, compact);
      appendQuestionsSection_(body, project.questions || [], compact);
    }

    if (mode === 'complete') {
      body.appendPageBreak();
    }

    if (mode === 'answer_key' || mode === 'explanations' || mode === 'complete') {
      if (mode === 'answer_key' || mode === 'explanations') {
        var titleP = body.appendParagraph(
          (project.header && project.header.institutionName ? project.header.institutionName + ' — ' : '') +
            project.subject +
            ' (' +
            project.title +
            ')'
        );
        titleP.editAsText().setBold(true).setFontSize(11);
      }
      appendKeysAndExplanations_(body, project.questions || [], mode, compact);
    }

    if (mode === 'kisi_kisi_only' || (mode === 'complete' && includeKisiKisi)) {
      if (mode === 'complete') {
        body.appendPageBreak();
      }
      appendKisiKisiSection_(body, project);
    }

    doc.saveAndClose();

    var docFile = DriveApp.getFileById(docId);
    folder.addFile(docFile);

    var result = {
      project_id: projectId,
      mode: mode,
      format: format,
      doc_id: docId,
      doc_url: docFile.getUrl(),
      file_name: docName,
    };

    if (format === 'pdf') {
      var pdfBlob = docFile.getAs('application/pdf');
      pdfBlob.setName(docName + '.pdf');
      var pdfFile = folder.createFile(pdfBlob);
      try {
        pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (e) {}
      result.file_id = pdfFile.getId();
      result.download_url = 'https://drive.google.com/uc?export=download&id=' + pdfFile.getId();
      result.view_url = pdfFile.getUrl();
      result.base64 = Utilities.base64Encode(pdfBlob.getBytes());
      result.mime_type = 'application/pdf';
    } else if (format === 'docx') {
      var exportUrl =
        'https://docs.google.com/feeds/download/documents/export/Export?id=' +
        encodeURIComponent(docId) +
        '&exportFormat=docx';
      var docxResp = UrlFetchApp.fetch(exportUrl, {
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true,
      });
      if (docxResp.getResponseCode() !== 200) {
        throw new Error('Gagal mengonversi Google Docs ke DOCX (HTTP ' + docxResp.getResponseCode() + ').');
      }
      var docxBlob = docxResp
        .getBlob()
        .setName(docName + '.docx')
        .setContentType('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      var docxFile = folder.createFile(docxBlob);
      try {
        docxFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (e) {}
      result.file_id = docxFile.getId();
      result.download_url = 'https://drive.google.com/uc?export=download&id=' + docxFile.getId();
      result.view_url = docxFile.getUrl();
      result.base64 = Utilities.base64Encode(docxBlob.getBytes());
      result.mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else {
      try {
        docFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (e) {}
      result.file_id = docId;
      result.download_url = docFile.getUrl();
      result.view_url = docFile.getUrl();
    }

    UsageService.logHistory(
      session.user_id,
      'EXPORT_DOCUMENT',
      'Project',
      projectId,
      'Mengekspor ' + format.toUpperCase() + ' (' + mode + ') ke Google Drive'
    );

    return result;
  }

  return {
    exportProjectDocument: exportProjectDocument,
  };
})();
