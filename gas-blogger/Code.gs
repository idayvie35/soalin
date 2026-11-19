/**
 * Code.gs — Entry Point Utama Google Apps Script Web App SIT PLUS CORDOVA (SD–SMA)
 *
 * Untuk koneksi Live index.html Standalone:
 *   Cukup tambahkan GEMINI_API_KEY (dari Google AI Studio) di Script Properties lalu Deploy sebagai Web App!
 * Untuk mode lengkap Blogger + Google Sheets:
 *   Isi GEMINI_API_KEY, SPREADSHEET_ID, AUTH_SECRET, ADMIN_EMAIL lalu jalankan setupSitCordova().
 */

function doGet(e) {
  return Router.handle(e, 'GET');
}

function doPost(e) {
  return Router.handle(e, 'POST');
}

function setupSitCordova() {
  var result = Config.initializeApp();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function setupSoalinAI() {
  return setupSitCordova();
}

/**
 * Jalankan fungsi ini dari Editor GAS untuk menguji koneksi Google AI Studio (Gemini API) & Sheets.
 */
function testDatabaseAndGemini() {
  var ai = Config.checkAIConnection();
  var db = Config.getConfig().SPREADSHEET_ID ? Config.checkDatabase() : { skipped: 'SPREADSHEET_ID opsional untuk mode standalone' };
  var report = { geminiAIStudio: ai, database: db };
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

/**
 * Trigger latar belakang untuk menyelesaikan antrian Job generasi soal.
 */
function processPendingJobTrigger() {
  JobService.processPendingJobsInBackground();
}
