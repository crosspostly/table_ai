/**
 * Legacy stub: OCR UI теперь живёт в Main.gs (функция ocrRun).
 * Этот файл оставлен только для обратной совместимости и OTA-скриптов.
 */
/* exported ocrRunV2 */
function ocrRunV2() {
  if (typeof ocrRun === 'function') {
    ocrRun();
  } else {
    SpreadsheetApp.getUi().alert('Обновите Main.gs: функция ocrRun недоступна.');
  }
}
