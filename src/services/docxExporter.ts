import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { QUESTION_TYPE_META } from '../constants.ts';
import { ExamProject, QuestionItem, RppKurmer } from '../types.ts';
import {
  cleanAsterisks,
  hasArabicText,
  isPureArabicBlock,
} from '../utils/arabic.ts';
import { getSynchronizedMatching } from '../utils/matching.ts';
import { buildKisiKisiRow, getFaseKurikulumMerdeka } from '../utils/kurikulumMerdeka.ts';

export type DocxExportMode = 'questions_only' | 'answers_only' | 'kisi_kisi_only' | 'complete';

async function svgOrDataUrlToPngBytes(
  svgMarkup?: string,
  imageUrl?: string
): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  try {
    let src = imageUrl || '';
    if (svgMarkup) {
      const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      src = URL.createObjectURL(svgBlob);
    }
    if (!src) return null;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Gagal memuat gambar'));
      img.src = src;
    });

    const width = 460;
    const aspect = img.naturalHeight && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.56;
    const height = Math.round(width * aspect);

    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (svgMarkup) URL.revokeObjectURL(src);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return null;
    const buf = await blob.arrayBuffer();
    return { data: new Uint8Array(buf), width, height };
  } catch {
    return null;
  }
}

function makeParagraph(
  rawText: string,
  options?: {
    bold?: boolean;
    italic?: boolean;
    size?: number;
    color?: string;
    rtl?: boolean;
    spacingAfter?: number;
    spacingBefore?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  }
): Paragraph {
  const text = cleanAsterisks(rawText);
  const hasArabic = hasArabicText(text);
  const isPureAr = options?.rtl !== undefined ? options.rtl : isPureArabicBlock(text);
  return new Paragraph({
    bidirectional: isPureAr,
    alignment: options?.align ?? (isPureAr ? AlignmentType.RIGHT : AlignmentType.LEFT),
    spacing: {
      before: options?.spacingBefore ?? 0,
      after: options?.spacingAfter ?? 100,
    },
    children: [
      new TextRun({
        text,
        bold: options?.bold,
        italics: options?.italic,
        size: options?.size ?? (hasArabic ? 26 : 22),
        color: options?.color,
        rightToLeft: isPureAr,
        font: hasArabic ? 'Amiri' : 'Calibri',
      }),
    ],
  });
}

function buildKopAndStudentHeader(project: ExamProject): Array<Paragraph | Table> {
  const { header } = project;
  const blocks: Array<Paragraph | Table> = [];

  // Institution Title (Compact)
  blocks.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [
        new TextRun({
          text: header.institutionName.toUpperCase(),
          bold: true,
          size: 24,
          font: 'Calibri',
          color: '0F294A',
        }),
      ],
    })
  );

  if (header.institutionAddress) {
    blocks.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: header.institutionAddress,
            size: 16,
            color: '475569',
            font: 'Calibri',
          }),
        ],
      })
    );
  }

  // Divider line
  blocks.push(
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.DOUBLE, size: 8, color: '0F294A' },
      },
      spacing: { after: 70 },
      children: [],
    })
  );

  // Exam Title
  blocks.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [
        new TextRun({
          text: `${header.examTitle.toUpperCase()} — ${header.subject} (${project.title})`,
          bold: true,
          size: 20,
          font: 'Calibri',
        }),
      ],
    })
  );

  blocks.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 70 },
      children: [
        new TextRun({
          text: `${getFaseKurikulumMerdeka(header.level, header.gradeClass)}`,
          size: 17,
          color: '475569',
          font: 'Calibri',
        }),
      ],
    })
  );

  // Exam Metadata Table
  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  };

  blocks.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: cellBorder,
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                makeParagraph(`Jenjang / Kelas : ${header.level} / ${header.gradeClass}`, {
                  size: 19,
                  spacingAfter: 40,
                }),
                makeParagraph(`Semester / Tahun : ${header.semester} / ${header.academicYear}`, {
                  size: 19,
                  spacingAfter: 40,
                }),
              ],
            }),
            new TableCell({
              borders: cellBorder,
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                makeParagraph(`Pengampu : ${header.teacherName}`, {
                  size: 19,
                  spacingAfter: 40,
                }),
                makeParagraph(`Alokasi Waktu : ${header.timeAllocation}`, {
                  size: 19,
                  spacingAfter: 40,
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  if (header.includeStudentIdentityBox) {
    blocks.push(
      new Paragraph({ spacing: { before: 50, after: 20 }, children: [] })
    );
    blocks.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: cellBorder,
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  makeParagraph('Nama: .................................  Kelas: ..............', {
                    size: 18,
                    spacingAfter: 20,
                  }),
                ],
              }),
              new TableCell({
                borders: cellBorder,
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  makeParagraph('No. Peserta: ......................  Tanggal: ............', {
                    size: 18,
                    spacingAfter: 20,
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  if (header.instructions) {
    blocks.push(
      makeParagraph(`Petunjuk: ${header.instructions}`, {
        italic: true,
        size: 17,
        color: '475569',
        spacingBefore: 50,
        spacingAfter: 70,
      })
    );
  }

  return blocks;
}

async function renderQuestionBlock(q: QuestionItem): Promise<Array<Paragraph | Table>> {
  const out: Array<Paragraph | Table> = [];
  const cleanPrompt = cleanAsterisks(q.prompt);
  const cleanPassage = cleanAsterisks(q.readingPassage);
  const cleanArPrompt = cleanAsterisks(q.arabicPrompt);
  const isPureArPrompt = isPureArabicBlock(cleanPrompt);

  if (cleanPassage) {
    const isPureArPassage = isPureArabicBlock(cleanPassage);
    out.push(
      makeParagraph(cleanPassage, {
        rtl: isPureArPassage,
        size: hasArabicText(cleanPassage) ? 25 : 20,
        spacingBefore: 80,
        spacingAfter: 60,
      })
    );
  }

  const promptLine = `${q.number}. ${cleanPrompt}`;
  out.push(
    makeParagraph(promptLine, {
      bold: true,
      rtl: isPureArPrompt,
      size: hasArabicText(cleanPrompt) ? 24 : 20,
      spacingBefore: 50,
      spacingAfter: 25,
    })
  );

  if (cleanArPrompt && q.type !== 'menebalkan_mewarnai_arab') {
    out.push(
      makeParagraph(cleanArPrompt, {
        rtl: isPureArabicBlock(cleanArPrompt),
        size: 24,
        spacingAfter: 30,
      })
    );
  }

  if (q.visual && (q.visual.svgMarkup || q.visual.imageUrl)) {
    const imgBytes = await svgOrDataUrlToPngBytes(q.visual.svgMarkup, q.visual.imageUrl);
    if (imgBytes) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 30, after: 20 },
          children: [
            new ImageRun({
              data: imgBytes.data,
              transformation: {
                width: Math.min(340, imgBytes.width),
                height: Math.round((Math.min(340, imgBytes.width) / imgBytes.width) * imgBytes.height),
              },
              type: 'png',
            }),
          ],
        })
      );
      if (q.visual.caption) {
        out.push(
          makeParagraph(q.visual.caption, {
            align: AlignmentType.CENTER,
            italic: true,
            size: 16,
            color: '475569',
            spacingAfter: 35,
          })
        );
      }
    }
  }

  if (q.options && q.options.length > 0) {
    const allShort = q.options.every((o) => (o.text || '').length <= 36);
    if (allShort && q.options.length >= 2) {
      const noBorder = {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      };
      const optRows: TableRow[] = [];
      for (let oi = 0; oi < q.options.length; oi += 2) {
        const leftOpt = q.options[oi];
        const rightOpt = q.options[oi + 1];
        const leftLine = `${leftOpt.label}. ${leftOpt.text}`;
        const rightLine = rightOpt ? `${rightOpt.label}. ${rightOpt.text}` : '';
        optRows.push(
          new TableRow({
            children: [
              new TableCell({
                borders: noBorder,
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  makeParagraph(leftLine, {
                    rtl: isPureArabicBlock(leftLine),
                    size: hasArabicText(leftOpt.text) ? 22 : 19,
                    spacingAfter: 20,
                  }),
                ],
              }),
              new TableCell({
                borders: noBorder,
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  rightOpt
                    ? makeParagraph(rightLine, {
                        rtl: isPureArabicBlock(rightLine),
                        size: hasArabicText(rightOpt.text) ? 22 : 19,
                        spacingAfter: 20,
                      })
                    : makeParagraph('', { size: 16 }),
                ],
              }),
            ],
          })
        );
      }
      out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: optRows }));
    } else {
      for (const opt of q.options) {
        const line = `${opt.label}. ${opt.text}`;
        const optPureAr = isPureArabicBlock(line);
        out.push(
          makeParagraph(line, {
            rtl: optPureAr,
            size: hasArabicText(opt.text) ? 22 : 19,
            spacingAfter: 20,
          })
        );
      }
    }
  }

  if (q.type === 'menjodohkan' && q.matchingPairs && q.matchingPairs.length > 0) {
    const sync = getSynchronizedMatching(q.matchingPairs);
    const lastLetter = sync.rightOptions[sync.rightOptions.length - 1]?.letter || 'D';
    out.push(
      makeParagraph(
        `   Pasangkan Kolom Kiri (1–${sync.rows.length}) dengan Pilihan Kanan (A–${lastLetter}), lalu tuliskan jawabannya pada kotak isian di bawah ini:`,
        { size: 19, italic: true, color: '475569', spacingBefore: 40, spacingAfter: 60 }
      )
    );

    out.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  makeParagraph('Kolom Kiri', { bold: true, size: 19, color: '0F294A', spacingAfter: 40 }),
                  ...sync.rows.map((row) =>
                    makeParagraph(`${row.number}. ${row.left}`, {
                      rtl: isPureArabicBlock(row.left),
                      size: hasArabicText(row.left) ? 23 : 20,
                      spacingAfter: 40,
                    })
                  ),
                ],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  makeParagraph('Pilihan Kanan', { bold: true, size: 19, color: '0F294A', spacingAfter: 40 }),
                  ...sync.rightOptions.map((opt) =>
                    makeParagraph(`${opt.letter}. ${opt.text}`, {
                      rtl: isPureArabicBlock(opt.text),
                      size: hasArabicText(opt.text) ? 23 : 20,
                      spacingAfter: 40,
                    })
                  ),
                ],
              }),
            ],
          }),
        ],
      })
    );

    out.push(
      makeParagraph('   Kotak Isian Jawaban:', {
        bold: true,
        size: 19,
        color: '334155',
        spacingBefore: 80,
        spacingAfter: 40,
      })
    );

    out.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: sync.rows.map(
          (row) =>
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 22, type: WidthType.PERCENTAGE },
                  children: [
                    makeParagraph(`Jawaban No. ${row.number}`, {
                      bold: true,
                      size: 19,
                      spacingBefore: 60,
                      spacingAfter: 60,
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 78, type: WidthType.PERCENTAGE },
                  children: [
                    makeParagraph(' ', { size: 24, spacingBefore: 120, spacingAfter: 160 }),
                  ],
                }),
              ],
            })
        ),
      })
    );
  }

  if (q.type === 'mengurutkan' && q.sequenceItems && q.sequenceItems.length > 0) {
    const displayed = [...q.sequenceItems].sort((a, b) => a.localeCompare(b));
    displayed.forEach((item, idx) => {
      out.push(
        makeParagraph(`   [ ${idx + 1} ] ${item}`, {
          rtl: isPureArabicBlock(item),
          size: 20,
          spacingAfter: 40,
        })
      );
    });
  }

  if (['esai', 'studi_kasus', 'analisis_teks'].includes(q.type)) {
    out.push(
      makeParagraph(
        'Jawaban: ........................................................................................................................',
        { size: 19, color: '94A3B8', spacingBefore: 40, spacingAfter: 100 }
      )
    );
  }

  if (q.type === 'memisah_hijaiyah') {
    out.push(
      makeParagraph('[      ] - [      ] - [      ] - [      ] - [      ]', {
        rtl: true,
        size: 22,
        color: '64748B',
        spacingBefore: 40,
        spacingAfter: 100,
      })
    );
  }

  if (q.type === 'menyambung_hijaiyah') {
    out.push(
      makeParagraph('Kata sambung: ................................................', {
        rtl: false,
        size: 20,
        color: '64748B',
        spacingBefore: 40,
        spacingAfter: 100,
      })
    );
  }

  if (q.type === 'menulis_ulang_kalimat') {
    out.push(
      makeParagraph(
        '........................................................................................................................................',
        { rtl: false, size: 20, color: '94A3B8', spacingBefore: 40, spacingAfter: 60 }
      ),
      makeParagraph(
        '........................................................................................................................................',
        { rtl: false, size: 20, color: '94A3B8', spacingAfter: 100 }
      )
    );
  }

  if (q.type === 'menebalkan_mewarnai_arab') {
    const arTarget = cleanAsterisks(q.arabicPrompt || q.readingPassage || q.correctAnswer || '');
    if (q.readingTranslation) {
      out.push(
        makeParagraph(`Arti: ${q.readingTranslation}`, {
          size: 20,
          color: '047857',
          bold: true,
          spacingAfter: 60,
        })
      );
    }
    out.push(
      makeParagraph('A. Tebalkan garis kata / kalimat Arab berikut:', {
        size: 20,
        bold: true,
        color: '475569',
        spacingBefore: 60,
        spacingAfter: 40,
      }),
      makeParagraph(arTarget, {
        rtl: true,
        align: AlignmentType.CENTER,
        size: 72,
        color: 'CBD5E1',
        bold: true,
        spacingBefore: 40,
        spacingAfter: 100,
      }),
      makeParagraph('B. Warnailah kata / kalimat Arab berikut (Gunakan format Outline/WordArt untuk cetak warna):', {
        size: 20,
        bold: true,
        color: '334155',
        spacingBefore: 60,
        spacingAfter: 40,
      }),
      makeParagraph(arTarget, {
        rtl: true,
        align: AlignmentType.CENTER,
        size: 84,
        color: '64748B',
        bold: true,
        spacingBefore: 40,
        spacingAfter: 160,
      })
    );
  }

  return out;
}

function renderAnswerKeyBlocks(questions: QuestionItem[]): Paragraph[] {
  const blocks: Paragraph[] = [];

  blocks.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 80, after: 140 },
      children: [
        new TextRun({
          text: 'KUNCI JAWABAN, PEMBAHASAN & RUBRIK PENILAIAN',
          bold: true,
          size: 26,
          color: '0F294A',
          font: 'Calibri',
        }),
      ],
    })
  );

  for (const q of questions) {
    const typeLabel = QUESTION_TYPE_META[q.type]?.shortLabel || q.type;
    blocks.push(
      makeParagraph(
        `Soal No. ${q.number} (${typeLabel} · ${q.cognitiveLevel} · Bobot: ${q.weight} poin)`,
        { bold: true, size: 22, color: '0F294A', spacingBefore: 100, spacingAfter: 40 }
      )
    );

    const keyStr =
      q.correctAnswers && q.correctAnswers.length > 0
        ? q.correctAnswers.join(', ')
        : q.correctAnswer;

    blocks.push(
      makeParagraph(`Kunci Jawaban: ${keyStr}`, {
        bold: true,
        rtl: false,
        size: 21,
        color: '047857',
        spacingAfter: 40,
      })
    );

    if (q.explanation) {
      blocks.push(
        makeParagraph(`Pembahasan: ${q.explanation}`, {
          rtl: false,
          size: 20,
          spacingAfter: 40,
        })
      );
    }

    if (q.distractorAnalysis) {
      blocks.push(
        makeParagraph(`Analisis Pengecoh: ${q.distractorAnalysis}`, {
          size: 19,
          color: '475569',
          spacingAfter: 40,
        })
      );
    }

    if (q.rubric) {
      blocks.push(
        makeParagraph(`Pedoman Penilaian / Rubrik: ${q.rubric}`, {
          size: 19,
          color: '334155',
          spacingAfter: 80,
        })
      );
    }
  }

  return blocks;
}

function buildKisiKisiBlocks(project: ExamProject): Array<Paragraph | Table> {
  const { header } = project;
  const fase = getFaseKurikulumMerdeka(header.level, header.gradeClass);
  const border = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  };
  const blocks: Array<Paragraph | Table> = [
    makeParagraph('KISI-KISI PENULISAN SOAL (KURIKULUM MERDEKA)', {
      align: AlignmentType.CENTER,
      bold: true,
      size: 22,
      color: '0F294A',
      spacingBefore: 20,
      spacingAfter: 20,
    }),
    makeParagraph(
      `${header.institutionName} · ${header.subject} · ${fase} (${header.gradeClass}) · Penyusun: ${header.teacherName}`,
      {
        align: AlignmentType.CENTER,
        size: 17,
        color: '475569',
        spacingAfter: 60,
      }
    ),
  ];

  const headerRow = new TableRow({
    children: [
      new TableCell({ borders: border, width: { size: 6, type: WidthType.PERCENTAGE }, children: [makeParagraph('No', { bold: true, size: 17, color: '0F294A' })] }),
      new TableCell({ borders: border, width: { size: 28, type: WidthType.PERCENTAGE }, children: [makeParagraph('TP / Lingkup Materi', { bold: true, size: 17, color: '0F294A' })] }),
      new TableCell({ borders: border, width: { size: 38, type: WidthType.PERCENTAGE }, children: [makeParagraph('Indikator Soal', { bold: true, size: 17, color: '0F294A' })] }),
      new TableCell({ borders: border, width: { size: 18, type: WidthType.PERCENTAGE }, children: [makeParagraph('Level & Bentuk', { bold: true, size: 17, color: '0F294A' })] }),
      new TableCell({ borders: border, width: { size: 10, type: WidthType.PERCENTAGE }, children: [makeParagraph('Bobot', { bold: true, size: 17, color: '0F294A' })] }),
    ],
  });

  const dataRows = project.questions.map((q) => {
    const row = buildKisiKisiRow(q, {
      subject: header.subject,
      level: header.level,
      gradeClass: header.gradeClass,
      title: project.title,
    });
    return new TableRow({
      children: [
        new TableCell({ borders: border, children: [makeParagraph(String(row.number), { bold: true, size: 17 })] }),
        new TableCell({
          borders: border,
          children: [
            makeParagraph(`${row.tujuanPembelajaran}`, { size: 16, spacingAfter: 10 }),
            makeParagraph(`Materi: ${row.materi}`, { italic: true, size: 15, color: '475569' }),
          ],
        }),
        new TableCell({ borders: border, children: [makeParagraph(row.indikatorSoal, { size: 16 })] }),
        new TableCell({ borders: border, children: [makeParagraph(`${row.cognitiveLevel} (${row.thinkingTier})\n${row.bentukSoal}`, { size: 16 })] }),
        new TableCell({ borders: border, children: [makeParagraph(`${row.weight} pt`, { size: 16 })] }),
      ],
    });
  });

  blocks.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    })
  );

  return blocks;
}

export async function exportProjectToDocx(
  project: ExamProject,
  mode: DocxExportMode,
  includeKisiKisi = true
): Promise<void> {
  const children: Array<Paragraph | Table> = [];

  if (mode === 'kisi_kisi_only') {
    children.push(...buildKisiKisiBlocks(project));
  } else {
    if (mode === 'questions_only' || mode === 'complete') {
      children.push(...buildKopAndStudentHeader(project));
      for (const q of project.questions) {
        const qBlocks = await renderQuestionBlock(q);
        children.push(...qBlocks);
      }
    }

    if (mode === 'complete') {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    if (mode === 'answers_only' || mode === 'complete') {
      if (mode === 'answers_only') {
        children.push(
          makeParagraph(`${project.header.institutionName} — ${project.header.examTitle}`, {
            bold: true,
            size: 22,
            color: '0F294A',
            spacingAfter: 20,
          })
        );
        children.push(
          makeParagraph(`Mata Pelajaran: ${project.header.subject} · Materi: ${project.title}`, {
            size: 18,
            color: '475569',
            spacingAfter: 60,
          })
        );
      }
      children.push(...renderAnswerKeyBlocks(project.questions));
    }

    if (mode === 'complete' && includeKisiKisi) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(...buildKisiKisiBlocks(project));
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 640,
              right: 680,
              bottom: 640,
              left: 680,
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const suffix =
    mode === 'questions_only'
      ? 'Naskah-Soal'
      : mode === 'answers_only'
      ? 'Kunci-Pembahasan'
      : mode === 'kisi_kisi_only'
      ? 'Kisi-Kisi-Kurmer'
      : 'Paket-Lengkap';
  const safeName = project.title.replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, '-').slice(0, 40);
  a.href = url;
  a.download = `${safeName}-${suffix}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportRppToDocx(rpp: RppKurmer): Promise<void> {
  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  };
  const noBorder = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };

  const children: Array<Paragraph | Table> = [
    makeParagraph(rpp.institutionName.toUpperCase(), {
      align: AlignmentType.CENTER,
      bold: true,
      size: 24,
      color: '0F294A',
      spacingAfter: 20,
    }),
    makeParagraph(rpp.institutionAddress || 'Sekolah Islam Terpadu Plus Cordova', {
      align: AlignmentType.CENTER,
      size: 16,
      color: '475569',
      spacingAfter: 40,
    }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.DOUBLE, size: 8, color: '0F294A' } },
      spacing: { after: 80 },
      children: [],
    }),
    makeParagraph('MODUL AJAR / RPP KURIKULUM MERDEKA', {
      align: AlignmentType.CENTER,
      bold: true,
      size: 22,
      color: '0F294A',
      spacingAfter: 30,
    }),
    makeParagraph(`${rpp.subject} — ${rpp.topic}`, {
      align: AlignmentType.CENTER,
      bold: true,
      size: 20,
      spacingAfter: 100,
    }),
    makeParagraph('A. INFORMASI UMUM & IDENTITAS MODUL', {
      bold: true,
      size: 20,
      color: '0F294A',
      spacingBefore: 60,
      spacingAfter: 40,
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        [
          ['Penyusun / Guru', rpp.teacherName],
          ['Satuan Pendidikan', rpp.institutionName],
        ],
        [
          ['Mata Pelajaran', rpp.subject],
          ['Jenjang / Kelas / Fase', `${rpp.level} · ${rpp.gradeClass} (${rpp.fase})`],
        ],
        [
          ['Tahun / Semester', `${rpp.academicYear} / ${rpp.semester}`],
          ['Alokasi Waktu', `${rpp.alokasiWaktu} (${rpp.jumlahPertemuan})`],
        ],
        [
          ['Model Pembelajaran', rpp.modelPembelajaran],
          ['Target Peserta Didik', rpp.targetPesertaDidik],
        ],
      ].map(
        (pair) =>
          new TableRow({
            children: pair.map(
              ([label, val]) =>
                new TableCell({
                  borders: cellBorder,
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    makeParagraph(`${label}: ${val}`, { size: 18, spacingAfter: 30 }),
                  ],
                })
            ),
          })
      ),
    }),
    makeParagraph(`Kompetensi Awal: ${rpp.kompetensiAwal}`, {
      size: 19,
      spacingBefore: 80,
      spacingAfter: 40,
    }),
    makeParagraph(
      `Dimensi Profil Pelajar Pancasila (P5): ${rpp.profilPelajarPancasila.join(', ')}`,
      { size: 19, spacingAfter: 40 }
    ),
    makeParagraph(`Sarana & Prasarana: ${rpp.saranaPrasarana}`, {
      size: 19,
      spacingAfter: 80,
    }),
    makeParagraph('B. KOMPONEN INTI', {
      bold: true,
      size: 20,
      color: '0F294A',
      spacingBefore: 60,
      spacingAfter: 40,
    }),
    makeParagraph('1. Capaian Pembelajaran (CP):', { bold: true, size: 19, spacingAfter: 20 }),
    makeParagraph(rpp.capaianPembelajaran, { size: 19, spacingAfter: 60 }),
    makeParagraph('2. Tujuan Pembelajaran (TP):', { bold: true, size: 19, spacingAfter: 20 }),
    ...rpp.tujuanPembelajaran.map((tp, idx) =>
      makeParagraph(`   ${idx + 1}. ${tp}`, { size: 19, spacingAfter: 25 })
    ),
    makeParagraph('3. Pemahaman Bermakna:', {
      bold: true,
      size: 19,
      spacingBefore: 50,
      spacingAfter: 20,
    }),
    makeParagraph(rpp.pemahamanBermakna, { size: 19, spacingAfter: 50 }),
    makeParagraph('4. Pertanyaan Pemantik:', { bold: true, size: 19, spacingAfter: 20 }),
    ...rpp.pertanyaanPemantik.map((q, idx) =>
      makeParagraph(`   ${idx + 1}. ${q}`, { size: 19, spacingAfter: 25 })
    ),
    makeParagraph('5. Kegiatan Pembelajaran:', {
      bold: true,
      size: 19,
      spacingBefore: 60,
      spacingAfter: 30,
    }),
    makeParagraph(`   a. Pendahuluan (${rpp.kegiatanPembelajaran.pendahuluan.durasi}):`, {
      bold: true,
      size: 18,
      spacingAfter: 20,
    }),
    ...rpp.kegiatanPembelajaran.pendahuluan.langkah.map((step, i) =>
      makeParagraph(`      ${i + 1}) ${step}`, { size: 18, spacingAfter: 20 })
    ),
    makeParagraph(`   b. Kegiatan Inti (${rpp.kegiatanPembelajaran.inti.durasi}):`, {
      bold: true,
      size: 18,
      spacingBefore: 30,
      spacingAfter: 20,
    }),
    ...rpp.kegiatanPembelajaran.inti.langkah.map((step, i) =>
      makeParagraph(`      ${i + 1}) ${step}`, { size: 18, spacingAfter: 20 })
    ),
    makeParagraph(`   c. Penutup (${rpp.kegiatanPembelajaran.penutup.durasi}):`, {
      bold: true,
      size: 18,
      spacingBefore: 30,
      spacingAfter: 20,
    }),
    ...rpp.kegiatanPembelajaran.penutup.langkah.map((step, i) =>
      makeParagraph(`      ${i + 1}) ${step}`, { size: 18, spacingAfter: 20 })
    ),
    makeParagraph('6. Asesmen Pembelajaran:', {
      bold: true,
      size: 19,
      spacingBefore: 60,
      spacingAfter: 30,
    }),
    makeParagraph(`   • Asesmen Diagnostik (Awal): ${rpp.asesmen.diagnostik}`, {
      size: 18,
      spacingAfter: 25,
    }),
    makeParagraph(`   • Asesmen Formatif (Proses): ${rpp.asesmen.formatif}`, {
      size: 18,
      spacingAfter: 25,
    }),
    makeParagraph(`   • Asesmen Sumatif (Akhir): ${rpp.asesmen.sumatif}`, {
      size: 18,
      spacingAfter: 50,
    }),
    makeParagraph('7. Pengayaan & Remedial:', { bold: true, size: 19, spacingAfter: 25 }),
    makeParagraph(`   • Pengayaan: ${rpp.pengayaanRemedial.pengayaan}`, {
      size: 18,
      spacingAfter: 25,
    }),
    makeParagraph(`   • Remedial: ${rpp.pengayaanRemedial.remedial}`, {
      size: 18,
      spacingAfter: 50,
    }),
    makeParagraph('8. Refleksi Guru & Peserta Didik:', { bold: true, size: 19, spacingAfter: 25 }),
    makeParagraph(`   • Refleksi Pendidik: ${rpp.refleksi.pendidik}`, {
      size: 18,
      spacingAfter: 25,
    }),
    makeParagraph(`   • Refleksi Peserta Didik: ${rpp.refleksi.pesertaDidik}`, {
      size: 18,
      spacingAfter: 60,
    }),
  ];

  if (rpp.glosarium.length > 0) {
    children.push(
      makeParagraph('C. LAMPIRAN: GLOSARIUM & DAFTAR PUSTAKA', {
        bold: true,
        size: 20,
        color: '0F294A',
        spacingBefore: 40,
        spacingAfter: 30,
      })
    );
    rpp.glosarium.forEach((g) => {
      children.push(
        makeParagraph(`   • ${g.term}: ${g.definition}`, { size: 18, spacingAfter: 20 })
      );
    });
  }

  if (rpp.daftarPustaka) {
    children.push(
      makeParagraph(`Daftar Pustaka: ${rpp.daftarPustaka}`, {
        size: 18,
        color: '475569',
        spacingBefore: 40,
        spacingAfter: 100,
      })
    );
  }

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: noBorder,
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                makeParagraph('Mengetahui,', { size: 18, spacingAfter: 10 }),
                makeParagraph('Kepala Sekolah', { bold: true, size: 18, spacingAfter: 240 }),
                makeParagraph(rpp.principalName || 'Kepala Sekolah', {
                  bold: true,
                  size: 18,
                  spacingAfter: 10,
                }),
                makeParagraph(`NIP/NIY. ${rpp.principalNip || '-'}`, { size: 17, color: '475569' }),
              ],
            }),
            new TableCell({
              borders: noBorder,
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                makeParagraph(`SIT Plus Cordova, ${new Date().toLocaleDateString('id-ID')}`, {
                  size: 18,
                  spacingAfter: 10,
                }),
                makeParagraph('Guru Mata Pelajaran', { bold: true, size: 18, spacingAfter: 240 }),
                makeParagraph(rpp.teacherName, { bold: true, size: 18, spacingAfter: 10 }),
                makeParagraph(`NIP/NIY. ${rpp.teacherNip || '-'}`, { size: 17, color: '475569' }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 680, right: 720, bottom: 680, left: 720 } },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = rpp.topic.replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, '-').slice(0, 40) || 'Modul';
  a.href = url;
  a.download = `RPP-Kurmer-${safeName}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
