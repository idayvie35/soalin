/**
 * ImageService.gs — Manajemen Upload Gambar ke Google Drive & Lampiran Visual Soal
 * Tidak pernah menggunakan URL gambar fiktif.
 */

var ImageService = (function () {
  function getTargetFolder_() {
    var cfg = Config.getConfig();
    if (cfg.GOOGLE_DRIVE_FOLDER_ID) {
      try {
        return DriveApp.getFolderById(cfg.GOOGLE_DRIVE_FOLDER_ID);
      } catch (e) {}
    }
    var folders = DriveApp.getFoldersByName('SIT_PLUS_CORDOVA_ASSETS');
    if (folders.hasNext()) return folders.next();
    return DriveApp.createFolder('SIT_PLUS_CORDOVA_ASSETS');
  }

  function saveBase64ImageToDrive(base64DataUrl, fileName, questionId) {
    if (!base64DataUrl || typeof base64DataUrl !== 'string') {
      throw new Error('Data gambar tidak ditemukan.');
    }

    var match = base64DataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Format gambar harus berupa base64 data URL (PNG/JPG/SVG/WEBP).');
    }

    var mimeType = match[1];
    var rawB64 = match[2];
    var bytes = Utilities.base64Decode(rawB64);
    var safeName = Utils.sanitizeText(fileName || 'soal-' + (questionId || Utils.generateUUID()), 80);
    var ext = mimeType.split('/')[1].replace('svg+xml', 'svg');
    var blob = Utilities.newBlob(bytes, mimeType, safeName + '.' + ext);

    var folder = getTargetFolder_();
    var file = folder.createFile(blob);

    // Atur agar gambar dapat dilihat pada dokumen/editor
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {}

    var fileId = file.getId();
    var viewUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;

    return {
      image_file_id: fileId,
      image_url: viewUrl,
      file_name: file.getName(),
      mime_type: mimeType,
    };
  }

  function saveSvgMarkupToDrive(svgMarkup, caption, questionId) {
    var cleanSvg = Utils.sanitizeSvg(svgMarkup);
    if (!cleanSvg) throw new Error('Markup SVG tidak valid.');
    var blob = Utilities.newBlob(
      cleanSvg,
      'image/svg+xml',
      'diagram-' + (questionId || Utils.generateUUID()) + '.svg'
    );
    var folder = getTargetFolder_();
    var file = folder.createFile(blob);
    return {
      image_file_id: file.getId(),
      svg_markup: cleanSvg,
      visual_caption: Utils.sanitizeText(caption || 'Diagram pendukung soal', 180),
    };
  }

  function getImageBlobByFileId(fileId) {
    if (!fileId) return null;
    try {
      return DriveApp.getFileById(fileId).getBlob();
    } catch (e) {
      return null;
    }
  }

  return {
    getTargetFolder: getTargetFolder_,
    saveBase64ImageToDrive: saveBase64ImageToDrive,
    saveSvgMarkupToDrive: saveSvgMarkupToDrive,
    getImageBlobByFileId: getImageBlobByFileId,
  };
})();
