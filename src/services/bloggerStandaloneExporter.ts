import { QUESTION_TYPE_META } from '../constants.ts';
import { ExamProject, QuestionItem } from '../types.ts';
import {
  cleanAsterisks,
  getTextDirection,
  hasArabicText,
  isPureArabicBlock,
} from '../utils/arabic.ts';
import { getSynchronizedMatching } from '../utils/matching.ts';

function escapeHtml(str: string): string {
  return cleanAsterisks(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderQuestionHtmlForEmbed(q: QuestionItem, idx: number, interactive: boolean): string {
  const cleanPrompt = cleanAsterisks(q.prompt);
  const cleanPassage = cleanAsterisks(q.readingPassage);
  const cleanArPrompt = cleanAsterisks(q.arabicPrompt);
  const promptDir = getTextDirection(cleanPrompt);
  const passageDir = getTextDirection(cleanPassage);
  const arPromptDir = getTextDirection(cleanArPrompt);
  const isArabic = q.isArabic || hasArabicText(cleanPrompt);
  const arabicClass = isArabic ? 'soalin-rtl' : '';

  const readingHtml = cleanPassage
    ? `<div class="soalin-passage ${hasArabicText(cleanPassage) ? 'soalin-rtl' : ''}" dir="${passageDir}" style="text-align:${
        passageDir === 'rtl' ? 'right' : 'left'
      };">${escapeHtml(cleanPassage)}${
        q.readingTranslation
          ? `<div class="soalin-trans" dir="ltr" style="text-align:left;"><em>Terjemahan:</em> ${escapeHtml(
              q.readingTranslation
            )}</div>`
          : ''
      }</div>`
    : '';

  const visualHtml = q.visual
    ? `<div class="soalin-visual">${
        q.visual.svgMarkup
          ? q.visual.svgMarkup
          : q.visual.imageUrl
          ? `<img src="${q.visual.imageUrl}" alt="${escapeHtml(q.visual.caption)}" style="max-width:100%;border-radius:8px;" />`
          : ''
      }${q.visual.caption ? `<div class="soalin-caption">${escapeHtml(q.visual.caption)}</div>` : ''}</div>`
    : '';

  let optionsHtml = '';
  if (q.options && q.options.length > 0) {
    const inputType = q.type === 'pilihan_ganda_kompleks' ? 'checkbox' : 'radio';
    optionsHtml = `<div class="soalin-options ${arabicClass}" dir="${promptDir}">${q.options
      .map((opt) => {
        const optText = cleanAsterisks(opt.text);
        const optPureAr = isPureArabicBlock(optText);
        const rowRtl = isPureArabicBlock(`${opt.label} ${optText}`) || (promptDir === 'rtl' && optPureAr);
        return `
      <label class="soalin-opt" dir="${rowRtl ? 'rtl' : 'ltr'}" style="text-align:${rowRtl ? 'right' : 'left'};">
        ${
          interactive
            ? `<input type="${inputType}" name="q_${idx}" value="${escapeHtml(opt.label)}" data-correct="${
                opt.isCorrect ? '1' : '0'
              }" />`
            : ''
        }
        <span class="soalin-opt-label">${escapeHtml(opt.label)}.</span>
        <span class="soalin-opt-text" dir="${optPureAr ? 'rtl' : 'ltr'}" style="${
          optPureAr && !rowRtl ? 'unicode-bidi:isolate;' : ''
        }">${escapeHtml(optText)}</span>
      </label>`;
      })
      .join('')}</div>`;
  } else if (q.type === 'menjodohkan' && q.matchingPairs && q.matchingPairs.length > 0) {
    const sync = getSynchronizedMatching(q.matchingPairs);
    const lastLetter = sync.rightOptions[sync.rightOptions.length - 1]?.letter || 'D';
    optionsHtml = `<div class="soalin-matching" dir="ltr" style="text-align:left;">
      <div style="font-size:12.5px;color:#334155;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 10px;margin-bottom:10px;">
        Pasangkan <strong>Kolom Kiri (1–${sync.rows.length})</strong> dengan <strong>Pilihan Kanan (A–${lastLetter})</strong>, lalu tuliskan jawaban Anda pada kotak isian yang luas di bawah ini.
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:10px;">
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px;background:#fff;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:6px;">Kolom Kiri</div>
          ${sync.rows
            .map(
              (r) =>
                `<div class="soalin-pair ${hasArabicText(r.left) ? 'soalin-rtl' : ''}" dir="${getTextDirection(
                  r.left
                )}" style="padding:4px 0;text-align:${isPureArabicBlock(r.left) ? 'right' : 'left'};"><span><strong>${
                  r.number
                }.</strong> ${escapeHtml(r.left)}</span></div>`
            )
            .join('')}
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px;background:#fff;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:6px;">Pilihan Kanan</div>
          ${sync.rightOptions
            .map(
              (opt) =>
                `<div class="soalin-pair ${hasArabicText(opt.text) ? 'soalin-rtl' : ''}" dir="${getTextDirection(
                  opt.text
                )}" style="padding:4px 0;text-align:${isPureArabicBlock(opt.text) ? 'right' : 'left'};"><span><strong>${
                  opt.letter
                }.</strong> ${escapeHtml(opt.text)}</span></div>`
            )
            .join('')}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;">
        ${sync.rows
          .map((r) =>
            interactive
              ? `<div><div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:4px;">Jawaban No. ${r.number}:</div><textarea class="soalin-textarea" rows="2" style="min-height:54px;" placeholder="Tuliskan huruf (misal: ${r.correctLetter ? 'A–' + lastLetter : 'A'}) &amp; pasangan jawaban No. ${r.number}..."></textarea></div>`
              : `<div><div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:4px;">Jawaban No. ${r.number}:</div><div style="min-height:52px;border:1.5px solid #94a3b8;border-radius:8px;background:#fff;"></div></div>`
          )
          .join('')}
      </div>
    </div>`;
  } else if (q.type === 'mengurutkan' && q.sequenceItems) {
    const shuffled = [...q.sequenceItems].sort((a, b) => a.localeCompare(b));
    optionsHtml = `<div class="soalin-seq">${shuffled
      .map((item, sIdx) => `<div>[ ${sIdx + 1} ] ${escapeHtml(item)}</div>`)
      .join('')}</div>`;
  } else if (q.type === 'menebalkan_mewarnai_arab') {
    const arWord = cleanAsterisks(q.arabicPrompt || q.readingPassage || q.correctAnswer || '');
    optionsHtml = `
      <div class="soalin-a4-big" dir="ltr">
        ${q.readingTranslation ? `<div style="font-size:12px;font-weight:600;color:#047857;margin-bottom:8px;">Arti: ${escapeHtml(q.readingTranslation)}</div>` : ''}
        <div class="soalin-a4-box">
          <div class="soalin-a4-label">1. Tebalkan Garis Kata / Kalimat Arab (التَّتَبُّعُ):</div>
          <div class="soalin-a4-trace" dir="rtl">${escapeHtml(arWord)}</div>
        </div>
        <div class="soalin-a4-box" style="border:2px solid #94a3b8;margin-top:10px;">
          <div class="soalin-a4-label">2. Warnailah Kata / Kalimat Arab Berikut (التَّلْوِينُ):</div>
          <div class="soalin-a4-color" dir="rtl">${escapeHtml(arWord)}</div>
        </div>
      </div>`;
  } else if (interactive) {
    const placeholder =
      q.type === 'memisah_hijaiyah'
        ? 'Pisahkan huruf hijaiyah dengan tanda hubung (contoh: مَ - دْ - رَ - سَ - ةٌ)...'
        : q.type === 'menyambung_hijaiyah'
        ? 'Tuliskan kata Arab yang sudah disambung...'
        : q.type === 'menulis_ulang_kalimat'
        ? 'Tuliskan ulang kata/kalimat di atas dengan rapi...'
        : 'Tuliskan jawaban Anda di sini...';
    optionsHtml = `<textarea class="soalin-textarea ${arabicClass}" dir="${
      q.type === 'memisah_hijaiyah' || q.type === 'menyambung_hijaiyah' ? 'rtl' : promptDir
    }" rows="2" placeholder="${placeholder}"></textarea>`;
  }

  const keyStr = cleanAsterisks(
    q.correctAnswers && q.correctAnswers.length > 0
      ? q.correctAnswers.join(', ')
      : q.correctAnswer
  );
  const keyDir = getTextDirection(keyStr);

  return `
  <article class="soalin-card" data-qindex="${idx}" data-weight="${q.weight}" data-type="${q.type}">
    <div class="soalin-meta">
      <span>Soal ${q.number}</span>
      <span>·</span>
      <span>${escapeHtml(QUESTION_TYPE_META[q.type]?.shortLabel || q.type)}</span>
      <span>·</span>
      <span>${escapeHtml(q.cognitiveLevel)}</span>
      <span>·</span>
      <span>${q.weight} Poin</span>
    </div>
    ${readingHtml}
    <div class="soalin-prompt ${arabicClass}" dir="${promptDir}" style="text-align:${
      promptDir === 'rtl' ? 'right' : 'left'
    };">${escapeHtml(cleanPrompt)}</div>
    ${
      cleanArPrompt && q.type !== 'menebalkan_mewarnai_arab'
        ? `<div class="soalin-prompt soalin-rtl" dir="${arPromptDir}" style="text-align:${
            arPromptDir === 'rtl' ? 'right' : 'left'
          };">${escapeHtml(cleanArPrompt)}</div>`
        : ''
    }
    ${visualHtml}
    ${optionsHtml}
    <div class="soalin-answer-box" style="display:none;">
      <div class="soalin-key"><strong>Kunci Jawaban:</strong> <span dir="${keyDir}" ${
        hasArabicText(keyStr) ? 'class="soalin-rtl-inline"' : ''
      } style="${keyDir === 'rtl' ? 'unicode-bidi:isolate;display:inline-block;' : ''}">${escapeHtml(
        keyStr
      )}</span></div>
      ${q.explanation ? `<div class="soalin-exp"><strong>Pembahasan:</strong> ${escapeHtml(q.explanation)}</div>` : ''}
      ${q.rubric ? `<div class="soalin-rubric"><strong>Rubrik:</strong> ${escapeHtml(q.rubric)}</div>` : ''}
    </div>
  </article>`;
}

export function generateBloggerHtmlSnippet(project: ExamProject): string {
  const questionsHtml = project.questions
    .map((q, idx) => renderQuestionHtmlForEmbed(q, idx, true))
    .join('\n');

  return `<!-- SIT PLUS CORDOVA — Widget Soal Sekolah Islam Terpadu Plus Cordova (SD–SMA) -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@400;600;700&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" rel="stylesheet" />
<style>
  .soalin-blogger-wrap { font-family: "Plus Jakarta Sans", system-ui, sans-serif; max-width: 820px; margin: 20px auto; color: #0f172a; line-height: 1.65; }
  .soalin-header { background: #0f294a; color: #ffffff; padding: 20px 24px; border-radius: 12px; margin-bottom: 18px; }
  .soalin-header h2 { margin: 0 0 6px; font-size: 20px; font-weight: 700; color: #ffffff; }
  .soalin-header p { margin: 0; font-size: 13px; color: #cbd5e1; }
  .soalin-toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; margin-bottom: 16px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; }
  .soalin-btn { cursor: pointer; border: 1px solid #0f294a; background: #0f294a; color: #ffffff; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; }
  .soalin-btn-sec { background: #ffffff; color: #0f294a; }
  .soalin-score { font-size: 14px; font-weight: 700; color: #059669; }
  .soalin-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin-bottom: 14px; }
  .soalin-meta { font-size: 12px; color: #64748b; display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .soalin-passage { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 8px; margin-bottom: 12px; font-size: 15px; }
  .soalin-trans { margin-top: 8px; font-size: 13px; color: #475569; border-top: 1px dashed #cbd5e1; padding-top: 6px; }
  .soalin-prompt { font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
  .soalin-rtl { font-family: "Noto Naskh Arabic", "Amiri", serif; font-size: 19px; line-height: 2.05; }
  .soalin-rtl-inline { font-family: "Noto Naskh Arabic", "Amiri", serif; font-size: 17px; }
  .soalin-visual { margin: 12px 0; text-align: center; }
  .soalin-visual svg { max-width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
  .soalin-caption { font-size: 12px; color: #64748b; margin-top: 4px; font-style: italic; }
  .soalin-options { display: flex; flex-direction: column; gap: 8px; }
  .soalin-opt { display: flex; align-items: flex-start; gap: 8px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-size: 14px; }
  .soalin-opt:hover { background: #f8fafc; }
  .soalin-opt-label { font-weight: 700; min-width: 22px; }
  .soalin-textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; font-family: inherit; font-size: 14px; }
  .soalin-matching, .soalin-seq { background: #f8fafc; padding: 10px 14px; border-radius: 8px; font-size: 14px; display: flex; flex-direction: column; gap: 6px; }
  .soalin-pair { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; }
  .soalin-answer-box { margin-top: 12px; padding: 12px 14px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; font-size: 13.5px; color: #064e3b; }
  .soalin-exp, .soalin-rubric { margin-top: 6px; }
  .soalin-a4-big { margin-top: 10px; }
  .soalin-a4-box { border: 1px dashed #94a3b8; border-radius: 10px; padding: 10px 14px; background: #ffffff; text-align: center; }
  .soalin-a4-label { font-size: 11px; font-weight: 700; color: #475569; text-align: left; text-transform: uppercase; margin-bottom: 6px; }
  .soalin-a4-trace { font-family: "Amiri", "Noto Naskh Arabic", serif; font-size: 52px; font-weight: 700; line-height: 1.9; color: #f8fafc; -webkit-text-stroke: 1.8px #64748b; paint-order: stroke fill; }
  .soalin-a4-color { font-family: "Amiri", "Noto Naskh Arabic", serif; font-size: 64px; font-weight: 700; line-height: 1.85; color: #ffffff; -webkit-text-stroke: 4px #0f172a; paint-order: stroke fill; }
</style>

<div class="soalin-blogger-wrap" id="soalin-blogger-app">
  <div class="soalin-header">
    <h2>${escapeHtml(project.title)}</h2>
    <p>${escapeHtml(project.header.institutionName || 'Sekolah Islam Terpadu Plus Cordova')} · ${escapeHtml(project.subject)} · ${escapeHtml(project.level)}${project.header.gradeClass ? ` (${escapeHtml(project.header.gradeClass)})` : ''} · ${project.questions.length} Soal</p>
  </div>
  <div class="soalin-toolbar">
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button type="button" class="soalin-btn" onclick="soalinCheckQuiz()">Periksa Jawaban</button>
      <button type="button" class="soalin-btn soalin-btn-sec" onclick="soalinToggleKeys()">Tampilkan / Sembunyikan Kunci</button>
    </div>
    <div class="soalin-score" id="soalin-score-display"></div>
  </div>
  ${questionsHtml}
</div>

<script>
  function soalinToggleKeys() {
    var boxes = document.querySelectorAll('#soalin-blogger-app .soalin-answer-box');
    boxes.forEach(function(b) {
      b.style.display = (b.style.display === 'none' || !b.style.display) ? 'block' : 'none';
    });
  }
  function soalinCheckQuiz() {
    var cards = document.querySelectorAll('#soalin-blogger-app .soalin-card');
    var earned = 0, total = 0;
    cards.forEach(function(card, i) {
      var inputs = card.querySelectorAll('input[name="q_' + i + '"]');
      var w = parseInt(card.getAttribute('data-weight') || '1', 10);
      if (inputs.length > 0) {
        total += w;
        var allCorrect = true;
        var anyChecked = false;
        inputs.forEach(function(inp) {
          var isC = inp.getAttribute('data-correct') === '1';
          if (inp.checked) anyChecked = true;
          if (inp.checked !== isC) allCorrect = false;
        });
        if (anyChecked && allCorrect) earned += w;
      }
      var box = card.querySelector('.soalin-answer-box');
      if (box) box.style.display = 'block';
    });
    var el = document.getElementById('soalin-score-display');
    if (el) el.textContent = total > 0 ? 'Skor Objektif: ' + earned + ' / ' + total : 'Kunci pembahasan ditampilkan.';
  }
</script>`;
}

export function generateStandaloneHtmlDocument(project: ExamProject): string {
  const snippet = generateBloggerHtmlSnippet(project);
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(project.title)} — ${escapeHtml(project.header.examTitle)}</title>
  <style>
    body { margin: 0; padding: 16px; background: #f1f5f9; color: #0f172a; }
    .standalone-student-bar { max-width: 820px; margin: 0 auto 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; font-family: system-ui, sans-serif; font-size: 13px; }
    .standalone-student-bar input { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; }
    .standalone-timer { font-weight: 700; color: #0f294a; font-variant-numeric: tabular-nums; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .soalin-toolbar { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="standalone-student-bar">
    <div><label>Nama Siswa<input type="text" placeholder="Masukkan nama lengkap" /></label></div>
    <div><label>Kelas / Ruang<input type="text" value="${escapeHtml(project.header.gradeClass)}" /></label></div>
    <div><label>Alokasi Waktu</label><div class="standalone-timer" id="soalin-timer">${escapeHtml(project.header.timeAllocation)}</div></div>
    <div style="display:flex;align-items:flex-end;gap:8px;"><button onclick="window.print()" style="padding:7px 14px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;font-weight:600;">Cetak / PDF</button></div>
  </div>
  ${snippet}
</body>
</html>`;
}
