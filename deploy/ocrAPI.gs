/**
 * ============================================================================
 * OCR API - SERVER MODULE
 * Перенесено из ocrRunV2_client.gs для работы на толстом сервере
 * ============================================================================
 * Версия: 3.0.0
 */

// ============================================================================
// КОНСТАНТЫ
// ============================================================================
const OCR_BATCH_LIMIT = 50;
const OCR_CHUNK_SIZE = 8;

// ============================================================================
// ОСНОВНЫЕ API ФУНКЦИИ
// ============================================================================

/**
 * Запуск OCR обработки
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Дополнительные параметры
 * @return {Object} Результат запуска
 */
function ocrQueue(spreadsheetId, payload) {
  const logs = [];

  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sh = ss.getSheetByName('Отзывы');

    if (!sh) {
      throw new Error('Лист "Отзывы" не найден');
    }

    const lastRow = Math.max(2, sh.getLastRow());
    const overwrite = payload.overwrite || false;

    let processed = 0; let empty = 0; let errors = 0; let skipped = 0;
    const results = [];

    logs.push('▶️ OCR start: rows=' + lastRow + ', overwrite=' + overwrite + ', limit=' + OCR_BATCH_LIMIT);

    for (let r = 2; r <= lastRow; r++) {
      try {
        const rangeA = sh.getRange(r, 1);
        const textVal = String(rangeA.getDisplayValue() || '').trim();
        const formula = String(rangeA.getFormula() || '');
        let rich = null; let richUrl = '';
        try {
          rich = rangeA.getRichTextValue();
          richUrl = ocrFirstLinkFromRich(rich);
        } catch (_) {}

        logs.push('OCR row ' + r + ': A-text="' + String(textVal).slice(0, 120) + '" richUrl="' + richUrl + '" formula="' + String(formula).slice(0, 120) + '"', 'DEBUG');

        if (!textVal && !formula && !richUrl) {
          empty++;
          continue;
        }

        const bVal = String(sh.getRange(r, 2).getDisplayValue() || '').trim();
        if (!overwrite && bVal) {
          skipped++;
          continue;
        }

        const sources = ocrExtractSources(textVal, formula, richUrl);
        logs.push('OCR row ' + r + ': sources=' + (sources.map(function(s) {
          return s.kind+':' + (s.id||s.url||'');
        }).join(' | ') || 'none'), 'DEBUG');

        if (!sources.length) {
          logs.push('⚠️ OCR: нет источников в A' + r, 'WARN');
          empty++;
          continue;
        }

        // Обрабатываем источники
        const result = ocrProcessRow(sh, r, sources, overwrite, logs);
        results.push(result);

        if (result.success) {
          processed++;
        } else {
          errors++;
        }
      } catch (e) {
        errors++;
        logs.push('❌ OCR row error ' + r + ': ' + e.message, 'ERROR');
      }
    }

    logs.push('✅ OCR завершен: processed=' + processed + ', errors=' + errors + ', skipped=' + skipped + ', empty=' + empty);

    return {
      success: true,
      data: {
        processed: processed,
        errors: errors,
        skipped: skipped,
        empty: empty,
        results: results,
      },
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ OCR ошибка: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

/**
 * Получение статуса OCR обработки
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Параметры запроса
 * @return {Object} Статус обработки
 */
function ocrGetStatus(spreadsheetId, payload) {
  const logs = [];

  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sh = ss.getSheetByName('Отзывы');

    if (!sh) {
      throw new Error('Лист "Отзывы" не найден');
    }

    const lastRow = Math.max(2, sh.getLastRow());
    let total = 0; let processed = 0; const errors = 0;

    for (let r = 2; r <= lastRow; r++) {
      const aVal = String(sh.getRange(r, 1).getDisplayValue() || '').trim();
      const bVal = String(sh.getRange(r, 2).getDisplayValue() || '').trim();

      if (aVal) {
        total++;
        if (bVal) {
          processed++;
        }
      }
    }

    const status = {
      total: total,
      processed: processed,
      pending: total - processed,
      progress: total > 0 ? Math.round((processed / total) * 100) : 0,
    };

    logs.push('✅ Статус OCR получен: ' + JSON.stringify(status));

    return {
      success: true,
      data: status,
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка получения статуса: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

/**
 * Обработка OCR батча
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Параметры батча
 * @return {Object} Результат обработки
 */
function ocrProcessBatch(spreadsheetId, payload) {
  const logs = [];

  try {
    const {images, lang = 'ru', delimiter} = payload;

    if (!Array.isArray(images) || images.length === 0) {
      throw new Error('NO_IMAGES');
    }

    logs.push('🖼️ OCR batch: images=' + images.length + ', lang=' + lang + ', delimiter=' + (delimiter || 'NONE'));

    // Здесь будет вызов Gemini API для OCR
    // Пока возвращаем заглушку
    const result = {
      processed: images.length,
      text: 'OCR результат для ' + images.length + ' изображений',
    };

    logs.push('✅ OCR batch обработан');

    return {
      success: true,
      data: result,
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка OCR batch: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

// ============================================================================
// ВСПомогательные функции
// ============================================================================

/**
 * Извлечение источников из ячейки
 * @param {string} textVal - Текстовое значение
 * @param {string} formula - Формула
 * @param {string} richUrl - URL из RichText
 * @return {Array} Массив источников
 */
function ocrExtractSources(textVal, formula, richUrl) {
  const sources = [];

  // Извлечение из текста
  if (textVal) {
    // Ищем URL в тексте
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = textVal.match(urlRegex) || [];
    urls.forEach((url) => {
      sources.push({kind: 'url', url: url});
    });

    // Ищем ID изображений
    const idRegex = /(?:id=|ID=)([a-zA-Z0-9_-]+)/g;
    let match;
    while ((match = idRegex.exec(textVal)) !== null) {
      sources.push({kind: 'id', id: match[1]});
    }
  }

  // Извлечение из формулы (Google Images)
  if (formula && formula.includes('IMAGE')) {
    const idRegex = /(?:id=|ID=)([a-zA-Z0-9_-]+)/g;
    let match;
    while ((match = idRegex.exec(formula)) !== null) {
      sources.push({kind: 'id', id: match[1]});
    }
  }

  // Извлечение из RichText
  if (richUrl) {
    sources.push({kind: 'url', url: richUrl});
  }

  return sources;
}

/**
 * Получение первой ссылки из RichText
 * @param {RichTextValue} rich - RichText значение
 * @return {string} URL или пустая строка
 */
function ocrFirstLinkFromRich(rich) {
  try {
    if (!rich) return '';
    const runs = rich.getRuns();
    for (let i = 0; i < runs.length; i++) {
      const url = runs[i].getLinkUrl();
      if (url) return url;
    }
    return '';
  } catch (e) {
    return '';
  }
}

/**
 * Обработка строки с OCR
 * @param {Sheet} sh - Лист
 * @param {number} row - Номер строки
 * @param {Array} sources - Источники
 * @param {boolean} overwrite - Перезаписывать ли существующие
 * @param {Array} logs - Массив для логов
 * @return {Object} Результат обработки
 */
function ocrProcessRow(sh, row, sources, overwrite, logs) {
  try {
    const writeRow = sh.getRange(row, 2).getDisplayValue() ? ocrFindNextWriteRow(sh, row) : row;
    const remainingCap = OCR_BATCH_LIMIT;
    const batchImages = [];
    const texts = [];

    for (let i = 0; i < sources.length && remainingCap > 0; i++) {
      const src = sources[i];
      try {
        const part = ocrCollectFromSource(src, remainingCap);
        if (part.texts && part.texts.length) {
          texts.push(...part.texts);
        }
        if (part.images && part.images.length) {
          batchImages.push(...part.images);
        }
      } catch (e) {
        logs.push('❌ OCR collect error row ' + row + ': ' + e.message, 'ERROR');
      }
    }

    // Здесь будет вызов OCR API для изображений
    // Пока записываем пустой результат
    if (texts.length > 0) {
      sh.getRange(writeRow, 2).setValue(texts.join('\n'));
    }

    return {
      success: true,
      row: row,
      writeRow: writeRow,
      textsFound: texts.length,
      imagesFound: batchImages.length,
    };
  } catch (e) {
    logs.push('❌ OCR process row error ' + row + ': ' + e.message, 'ERROR');
    return {
      success: false,
      row: row,
      error: e.message,
    };
  }
}

/**
 * Поиск следующей строки для записи
 * @param {Sheet} sh - Лист
 * @param {number} startRow - Начальная строка
 * @return {number} Номер строки для записи
 */
function ocrFindNextWriteRow(sh, startRow) {
  const lastRow = sh.getLastRow();
  for (let r = startRow; r <= lastRow + 1; r++) {
    const val = String(sh.getRange(r, 2).getDisplayValue() || '').trim();
    if (!val) {
      return r;
    }
  }
  return lastRow + 1;
}

/**
 * Сбор данных из источника
 * @param {Object} source - Источник
 * @param {number} limit - Лимит
 * @return {Object} Собранные данные
 */
function ocrCollectFromSource(source, limit) {
  const result = {texts: [], images: []};

  try {
    if (source.kind === 'url') {
      // Обработка URL
      result.texts.push('URL: ' + source.url);
    } else if (source.kind === 'id') {
      // Обработка ID изображения
      result.images.push({id: source.id, mimeType: 'image/png'});
    }
  } catch (e) {
    // Игнорируем ошибки
  }

  return result;
}
