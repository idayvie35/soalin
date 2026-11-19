/**
 * Utils.gs — Utilitas Keamanan, Sanitasi, Validasi, JSON Response, dan Bahasa Arab
 */

var Utils = (function () {
  function generateUUID() {
    return Utilities.getUuid();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function todayDateKey() {
    return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  }

  function sanitizeText(input, maxLen) {
    if (input === null || input === undefined) return '';
    var str = String(input).trim();
    if (maxLen && str.length > maxLen) {
      str = str.substring(0, maxLen);
    }
    return str;
  }

  // Mencegah Spreadsheet Formula Injection (=, +, -, @ di awal sel)
  function sanitizeCell(input) {
    if (input === null || input === undefined) return '';
    var str = String(input);
    if (/^[=+\-@\t\r]/.test(str)) {
      return "'" + str;
    }
    return str;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeJsonParse(str, fallback) {
    if (!str || typeof str !== 'string') return fallback;
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  }

  function validateRequestSize(rawString, maxBytes) {
    if (!rawString) return true;
    var byteLength = Utilities.newBlob(String(rawString)).getBytes().length;
    return byteLength <= maxBytes;
  }

  function cleanAsterisks(input) {
    if (input === null || input === undefined) return '';
    var text = String(input);
    text = text.replace(/(\d\s*)\*(\s*\d)/g, '$1__MATH_MUL__$2');
    text = text.replace(/^\s*\*\s+/gm, '• ');
    text = text.replace(/\*/g, '');
    text = text.replace(/^\s*#{1,6}\s+/gm, '');
    text = text.replace(/`/g, '');
    text = text.replace(/__MATH_MUL__/g, '×');
    return text.replace(/[ \t]+\n/g, '\n').trim();
  }

  function isArabicText(text) {
    if (!text) return false;
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(String(text));
  }

  function hasLatinText(text) {
    if (!text) return false;
    return /[A-Za-z\u00C0-\u024F]/.test(String(text));
  }

  function isPureArabicBlock(text) {
    var s = cleanAsterisks(text);
    if (!s) return false;
    return isArabicText(s) && !hasLatinText(s);
  }

  function sanitizeSvg(svg) {
    if (!svg || typeof svg !== 'string') return '';
    var trimmed = svg.trim();
    if (trimmed.indexOf('<svg') === -1) return '';
    return trimmed
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/\son\w+='[^']*'/gi, '')
      .replace(/javascript:/gi, '');
  }

  function jsonResponse(payload) {
    return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
      ContentService.MimeType.JSON
    );
  }

  function successResponse(requestId, data, meta) {
    var body = {
      ok: true,
      requestId: requestId || generateUUID(),
      timestamp: nowIso(),
      data: data,
    };
    if (meta) body.meta = meta;
    return jsonResponse(body);
  }

  function errorResponse(requestId, code, message, status) {
    return jsonResponse({
      ok: false,
      requestId: requestId || generateUUID(),
      timestamp: nowIso(),
      error: {
        code: code || 'INTERNAL_ERROR',
        message: message || 'Terjadi kesalahan pada server.',
        status: status || 400,
      },
    });
  }

  return {
    generateUUID: generateUUID,
    nowIso: nowIso,
    todayDateKey: todayDateKey,
    sanitizeText: sanitizeText,
    sanitizeCell: sanitizeCell,
    escapeHtml: escapeHtml,
    safeJsonParse: safeJsonParse,
    validateRequestSize: validateRequestSize,
    cleanAsterisks: cleanAsterisks,
    isArabicText: isArabicText,
    hasLatinText: hasLatinText,
    isPureArabicBlock: isPureArabicBlock,
    sanitizeSvg: sanitizeSvg,
    jsonResponse: jsonResponse,
    successResponse: successResponse,
    errorResponse: errorResponse,
  };
})();
