/**
 * ============================================================================
 * EXPORT TO DOCUMENT - Word/PDF Export Functionality v2.0
 * ============================================================================
 * Версия: 2.0.0
 *
 * Функционал экспорта листов Google Sheets в Word/PDF документы
 * с умной обработкой больших данных и текстовыми карточками
 * ============================================================================
 */

/**
 * Открывает боковую панель для экспорта
 */
// eslint-disable-next-line no-unused-vars
function openExportSidebar() {
  try {
    addLog('📄 Открытие панели экспорта', 'INFO');

    // ✅ ПРОВЕРКА РАЗРЕШЕНИЙ
    const authStatus = checkAuthStatus();

    if (!authStatus.authorized) {
      addLog('⚠️ Требуется авторизация', 'WARN');
      showAuthorizationDialog();
      return;
    }

    const html = HtmlService.createHtmlOutputFromFile('ExportToDocumentUI')
      .setTitle('📄 Экспорт в Word/PDF v2.0')
      .setWidth(400);

    SpreadsheetApp.getUi().showSidebar(html);

    addLog('✅ Панель экспорта открыта', 'SUCCESS');
  } catch (e) {
    addLog('❌ Ошибка открытия панели: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка открытия панели: ' + e.message);
  }
}

/**
 * Получает данные для инициализации UI
 * @return {Object} Объект с доступными листами
 */
// eslint-disable-next-line no-unused-vars
function getExportInitData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();

    const sheetList = sheets.map(function(sheet) {
      return {
        name: sheet.getName(),
        rowCount: sheet.getLastRow(),
        colCount: sheet.getLastColumn(),
      };
    });

    addLog('📊 Доступные листы: ' + sheetList.length, 'INFO');

    return {
      success: true,
      sheets: sheetList,
      currentSheet: ss.getActiveSheet().getName(),
    };
  } catch (e) {
    addLog('❌ Ошибка получения списка листов: ' + e.message, 'ERROR');
    return {
      success: false,
      error: e.message,
      sheets: [],
    };
  }
}

/**
 * Экспортирует лист в Word/PDF с улучшенной обработкой больших данных
 * Проверяет наличие необходимых разрешений
 * @return {Object} Статус авторизации
 */
// eslint-disable-next-line no-unused-vars
function checkAuthStatus() {
  try {
    // Пробуем выполнить операции, требующие разрешений

    // 1. Доступ к Google Sheets (уже есть по умолчанию)
    SpreadsheetApp.getActiveSpreadsheet().getName();

    // 2. Доступ к Google Drive
    DriveApp.getRootFolder().getName();

    // 3. Доступ к Google Docs
    // Создаём тестовый документ и сразу удаляем
    const testDoc = DocumentApp.create('_test_auth_' + new Date().getTime());
    const testDocId = testDoc.getId();
    DriveApp.getFileById(testDocId).setTrashed(true);

    addLog('✅ Все разрешения получены', 'SUCCESS');

    return {
      authorized: true,
      message: 'Авторизация успешна',
    };
  } catch (e) {
    addLog('⚠️ Требуется авторизация: ' + e.message, 'WARN');

    // Определяем какое разрешение отсутствует
    let missingScope = 'unknown';

    if (e.message.includes('Drive') || e.message.includes('drive')) {
      missingScope = 'drive';
    } else if (e.message.includes('Document') || e.message.includes('document')) {
      missingScope = 'documents';
    }

    return {
      authorized: false,
      missingScope: missingScope,
      error: e.message,
    };
  }
}

/**
 * Показывает диалог с инструкциями по авторизации
 */
function showAuthorizationDialog() {
  const ui = SpreadsheetApp.getUi();

  const response = ui.alert(
    '🔒 Требуется авторизация',
    '❗ Для работы экспорта нужны дополнительные разрешения:\n\n' +
    '✓ Доступ к Google Drive (создание файлов)\n' +
    '✓ Доступ к Google Docs (создание документов)\n\n' +
    '📌 Нажмите "Авторизовать" и разрешите доступ во всплывающем окне.',
    ui.ButtonSet.OK_CANCEL,
  );

  if (response === ui.Button.OK) {
    // Пользователь согласился
    requestAuthorization();
  } else {
    ui.alert(
      '⚠️ Авторизация отменена',
      'Экспорт недоступен без разрешений.\n\nПопробуйте позже через меню:\n🤖 Table AI → 📄 Экспорт в Word/PDF',
      ui.ButtonSet.OK,
    );
  }
}

/**
 * Запрашивает авторизацию, выполняя операции
 */
// eslint-disable-next-line no-unused-vars
function requestAuthorization() {
  const ui = SpreadsheetApp.getUi();

  try {
    addLog('🔐 Запрос авторизации...', 'INFO');

    // Принудительно вызываем все API для запроса разрешений
    SpreadsheetApp.getActiveSpreadsheet().getName();
    DriveApp.getRootFolder().getName();

    // Создаём тестовый документ
    const testDoc = DocumentApp.create('_auth_test_' + new Date().getTime());
    const testDocId = testDoc.getId();

    // Сразу удаляем
    DriveApp.getFileById(testDocId).setTrashed(true);

    addLog('✅ Авторизация успешна!', 'SUCCESS');

    ui.alert(
      '✅ Авторизация успешна!',
      'Все разрешения получены.\n\nТеперь можете использовать экспорт.',
      ui.ButtonSet.OK,
    );

    // Открываем панель
    openExportSidebar();
  } catch (e) {
    addLog('❌ Ошибка авторизации: ' + e.message, 'ERROR');

    ui.alert(
      '❌ Ошибка авторизации',
      'Не удалось получить разрешения:\n\n' + e.message + '\n\n' +
      '📌 Попробуйте:\n' +
      '1. Обновить страницу\n' +
      '2. Выйти из Google аккаунта и войти снова\n' +
      '3. Обратиться к администратору',
      ui.ButtonSet.OK,
    );
  }
}

/**
 * Экспортирует лист в Word/PDF
 * @param {string} sheetName - Название листа
 * @param {string} format - Формат: 'word', 'pdf', или 'both'
 * @param {Object} _options - Дополнительные настройки форматирования
 * @return {Object} Результат с ссылками на файлы
 */
// eslint-disable-next-line no-unused-vars
function exportSheetToDocument(sheetName, format, _options) {
  const startTime = Date.now();

  try {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
    addLog('📄 НАЧАЛО ЭКСПОРТА v2.0', 'INFO');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
    addLog('📋 Лист: ' + sheetName, 'INFO');
    addLog('📦 Формат: ' + format, 'INFO');

    // === ВАЛИДАЦИЯ ПАРАМЕТРОВ ===
    // ✅ ПРОВЕРКА РАЗРЕШЕНИЙ
    const authStatus = checkAuthStatus();

    if (!authStatus.authorized) {
      throw new Error(
        'Отсутствуют необходимые разрешения. ' +
        'Закройте панель и откройте снова для авторизации.',
      );
    }

    addLog('✅ Разрешения проверены', 'SUCCESS');

    // Валидация параметров
    if (!sheetName || !format) {
      throw new Error('Не указаны обязательные параметры!');
    }

    // Получаем лист
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Лист "' + sheetName + '" не найден!');
    }

    // === ЧТЕНИЕ ДАННЫХ И ОПРЕДЕЛЕНИЕ СТРАТЕГИИ ===
    addLog('📖 Анализ размера данных...', 'INFO');
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow === 0 || lastCol === 0) {
      throw new Error('Лист пустой!');
    }

    // ✅ ПРОВЕРКА ПУСТЫХ СТРОК
    addLog('🔍 Проверка пустых строк...', 'INFO');
    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    let nonEmptyRows = 0;

    // Считаем непустые строки (строки считаются пустыми, если ВСЕ ячейки пустые)
    for (let i = 1; i < data.length; i++) { // Пропускаем заголовок
      const row = data[i];
      const hasData = row.some((cell) => cell !== null && cell !== '' && String(cell).trim() !== '');
      if (hasData) {
        nonEmptyRows++;
      }
    }

    addLog('📊 Размер листа: ' + lastRow + ' строк × ' + lastCol + ' колонок', 'INFO');
    addLog('📊 Всего строк: ' + (lastRow - 1), 'INFO');
    addLog('📊 Непустых строк: ' + nonEmptyRows, 'INFO');

    if (nonEmptyRows === 0) {
      throw new Error('На листе нет данных для экспорта!');
    }

    const totalRows = nonEmptyRows; // ✅ ИСПОЛЬЗУЕМ КОЛИЧЕСТВО НЕПУСТЫХ СТРОК

    // Определяем стратегию обработки
    let strategy;
    let maxRows;
    let batchSize;
    if (totalRows <= 100) {
      strategy = 'FULL';
      maxRows = totalRows;
      addLog('✅ Стратегия: ПОЛНЫЙ ЭКСПОРТ (≤100 строк, ~20-30 сек)', 'INFO');
    } else if (totalRows <= 500) {
      strategy = 'BATCHES';
      maxRows = totalRows;
      batchSize = 50;
      addLog('⚡ Стратегия: БАТЧИ (101-500 строк, ~2-4 мин)', 'INFO');
      addLog('📦 Размер батча: ' + batchSize + ' строк', 'INFO');
    } else {
      strategy = 'LIMITED';
      maxRows = 100;
      addLog('⚠️ Стратегия: ОГРАНИЧЕНИЕ (>500 строк)', 'WARN');
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'WARN');
      addLog('⚠️ ВНИМАНИЕ: Таблица слишком большая!', 'WARN');
      addLog('⚠️ Всего строк: ' + totalRows, 'WARN');
      addLog('⚠️ Будет экспортировано: ' + maxRows, 'WARN');
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'WARN');
      addLog('💡 Рекомендации:', 'INFO');
      addLog('   1. Используйте фильтр в Google Sheets', 'INFO');
      addLog('   2. Экспортируйте несколько частей отдельно', 'INFO');
      addLog('   3. Для полного экспорта используйте Excel', 'INFO');
    }

    // === ПОДГОТОВКА ДАННЫХ ===
    addLog('📖 Подготовка данных для экспорта...', 'INFO');

    // ✅ УЖЕ ПРОЧИТАНЫ ДАННЫЕ ВЫШЕ, ИСПОЛЬЗУЕМ ИХ
    const headers = data[0];

    // Фильтруем непустые строки для обработки
    const filteredData = [headers]; // Заголовки всегда включаем
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const hasData = row.some((cell) => cell !== null && cell !== '' && String(cell).trim() !== '');
      if (hasData && filteredData.length <= maxRows) {
        filteredData.push(row);
      }
    }

    addLog('✅ Данные подготовлены: ' + filteredData.length + ' строк (включая заголовок)', 'INFO');

    // === СОЗДАНИЕ ДОКУМЕНТА ===
    addLog('📝 Создание Google Docs документа...', 'INFO');
    const docName = 'Экспорт из ' + sheetName + ' (' + new Date().toLocaleString('ru-RU') + ')';
    let doc = DocumentApp.create(docName);
    let body = doc.getBody();

    // === ЗАГОЛОВОК ДОКУМЕНТА ===
    addLog('🎨 Форматирование заголовка...', 'INFO');
    const title = body.appendParagraph(sheetName);
    title.setHeading(DocumentApp.ParagraphHeading.HEADING1);
    title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    const subtitle = body.appendParagraph('Экспорт данных');
    subtitle.setFontSize(14);
    subtitle.setItalic(true);
    subtitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    const timestamp = body.appendParagraph('Дата: ' + new Date().toLocaleString('ru-RU'));
    timestamp.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    timestamp.setFontSize(10);

    const stats = body.appendParagraph(`Записей: ${filteredData.length - 1} из ${totalRows}`);
    stats.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    stats.setFontSize(10);

    body.appendHorizontalRule();
    body.appendParagraph('');

    // === СОЗДАНИЕ КАРТОЧЕК ДАННЫХ ===
    addLog('📝 Создание текстовых карточек...', 'INFO');
    const cardCreationStart = Date.now();
    let processedRows = 0;
    let skippedRows = 0;
    let totalFields = 0;
    let skippedFields = 0;
    const PROGRESS_INTERVAL = 25;

    if (strategy === 'BATCHES') {
      // Обработка батчами с промежуточным сохранением
      let batchNum = 1;
      for (let batchStart = 1; batchStart < filteredData.length; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, filteredData.length);
        addLog(`📦 Батч ${batchNum}: строки ${batchStart}-${batchEnd - 1}`, 'INFO');

        // Обрабатываем батч
        for (let r = batchStart; r < batchEnd; r++) {
          const result = processCard(body, filteredData[r], r, headers);
          if (result.processed) {
            processedRows++;
            totalFields += result.fieldCount;
          } else {
            skippedRows++;
          }
          skippedFields += result.skippedFields;
        }

        // Промежуточное сохранение после батча (кроме последнего)
        if (batchEnd < filteredData.length) {
          addLog('   💾 Сохранение прогресса...', 'INFO');
          doc.saveAndClose();
          Utilities.sleep(1000);

          // Переоткрываем документ
          doc = DocumentApp.openById(doc.getId());
          body = doc.getBody();
          addLog('   ✅ Прогресс сохранён', 'SUCCESS');
        }

        batchNum++;
      }
    } else {
      // Обычная обработка (FULL или LIMITED)
      for (let r = 1; r < filteredData.length; r++) {
        const result = processCard(body, filteredData[r], r, headers);
        if (result.processed) {
          processedRows++;
          totalFields += result.fieldCount;
        } else {
          skippedRows++;
        }
        skippedFields += result.skippedFields;

        // Прогресс-индикатор
        if (processedRows % PROGRESS_INTERVAL === 0) {
          const progress = Math.round((processedRows / (filteredData.length - 1)) * 100);
          addLog(`   ⏳ Прогресс: ${processedRows}/${filteredData.length - 1} (${progress}%)`, 'INFO');
        }
      }
    }

    const cardCreationTime = Math.round((Date.now() - cardCreationStart) / 1000);
    addLog(`✅ Создано карточек: ${processedRows}`, 'SUCCESS');
    addLog(`⏭️ Пропущено строк: ${skippedRows}`, 'INFO');
    addLog(`📊 Всего полей: ${totalFields}`, 'INFO');
    addLog(`⏭️ Пропущено полей: ${skippedFields}`, 'INFO');
    addLog(`⏱️ Время создания карточек: ${cardCreationTime} сек`, 'INFO');

    // === ОБЯЗАТЕЛЬНОЕ СОХРАНЕНИЕ ДО ЭКСПОРТА ===
    addLog('💾 Сохранение документа на сервер Google...', 'INFO');
    const docId = doc.getId(); // ✅ Определяем docId ДО сохранения
    doc.saveAndClose();
    Utilities.sleep(3000); // Увеличена задержка до 3 секунд

    // Проверка доступности документа
    try {
      DocumentApp.openById(docId).getBody().getText();
      addLog('✅ Документ готов к экспорту', 'SUCCESS');
    } catch (e) {
      addLog('⏳ Ждём ещё немного...', 'WARN');
      Utilities.sleep(2000);
    }

    addLog('✅ Документ сохранён на сервер', 'SUCCESS');

    // === ЭКСПОРТ В ФАЙЛЫ ===
    const exportStart = Date.now();
    const docFile = DriveApp.getFileById(docId);
    const folder = getOrCreateExportFolder();
    addLog('📁 Папка для сохранения: ' + folder.getName(), 'INFO');

    const result = {
      success: true,
      docId: docId,
      docName: docName,
      strategy: strategy,
      processedRows: processedRows,
      totalRows: totalRows,
      folderUrl: folder.getUrl(), // ✅ ДОБАВЛЕНО
      folderId: folder.getId(), // ✅ ДОБАВЛЕНО
    };

    // Экспорт в Word
    if (format === 'word' || format === 'both') {
      addLog('📄 Экспорт в Word...', 'INFO');
      try {
        const wordBlob = exportWithRetry(docId, 'docx', 3);
        const wordFile = folder.createFile(wordBlob);
        wordFile.setName(sheetName + '_export.docx');
        result.wordUrl = wordFile.getUrl();
        result.wordId = wordFile.getId();
        result.wordSize = wordBlob.getBytes().length;
        addLog(`✅ Word создан: ${Math.round(result.wordSize / 1024)} KB`, 'SUCCESS');
      } catch (e) {
        addLog('⚠️ Word ошибка: ' + e.message, 'WARN');
        result.wordError = e.message;
      }
    }

    // Экспорт в PDF
    if (format === 'pdf' || format === 'both') {
      addLog('📄 Экспорт в PDF...', 'INFO');
      try {
        const pdfBlob = docFile.getAs('application/pdf');
        const pdfFile = folder.createFile(pdfBlob);
        pdfFile.setName(sheetName + '_export.pdf');
        result.pdfUrl = pdfFile.getUrl();
        result.pdfId = pdfFile.getId();
        result.pdfSize = pdfBlob.getBytes().length;
        addLog(`✅ PDF создан: ${Math.round(result.pdfSize / 1024)} KB`, 'SUCCESS');
      } catch (e) {
        addLog('⚠️ PDF ошибка: ' + e.message, 'WARN');
        result.pdfError = e.message;
      }
    }

    // ✅ УДАЛЯЕМ временный Google Docs
    addLog('🗑️ Удаление временного документа...', 'INFO');
    docFile.setTrashed(true);
    addLog('✅ Временный документ удалён', 'SUCCESS');

    const exportTime = Math.round((Date.now() - exportStart) / 1000);
    addLog(`⏱️ Время экспорта файлов: ${exportTime} сек`, 'INFO');

    // === ИТОГОВАЯ СТАТИСТИКА ===
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
    addLog('📊 СТАТИСТИКА ЭКСПОРТА:', 'INFO');
    addLog(`   Стратегия: ${strategy}`, 'INFO');
    addLog(`   Всего строк: ${totalRows}`, 'INFO');
    addLog(`   Обработано: ${processedRows}`, 'INFO');
    addLog(`   Пропущено: ${skippedRows}`, 'INFO');
    addLog(`   Полей создано: ${totalFields}`, 'INFO');
    addLog(`   Полей пропущено: ${skippedFields}`, 'INFO');
    if (result.wordSize) {
      addLog(`   Word файл: ${Math.round(result.wordSize / 1024)} KB`, 'INFO');
    }
    if (result.pdfSize) {
      addLog(`   PDF файл: ${Math.round(result.pdfSize / 1024)} KB`, 'INFO');
    }
    addLog(`⏱️ Время создания карточек: ${cardCreationTime} сек`, 'INFO');
    addLog(`⏱️ Время экспорта файлов: ${exportTime} сек`, 'INFO');
    addLog(`⏱️ Общее время выполнения: ${elapsed} сек`, 'INFO');

    // Эффективность обработки
    if (processedRows > 0) {
      const avgTimePerRow = Math.round((elapsed / processedRows) * 100) / 100;
      addLog(`📈 Среднее время на строку: ${avgTimePerRow} сек`, 'INFO');
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
    addLog('✅ ЭКСПОРТ ЗАВЕРШЕН!', 'SUCCESS');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');

    return result;
  } catch (e) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    addLog(`❌ ОШИБКА на ${elapsed} сек: ${e.message}`, 'ERROR');
    addLog('Stack: ' + e.stack, 'ERROR');
    return {
      success: false,
      error: e.message,
      elapsed: elapsed,
    };
  }
}

/**
 * Обрабатывает одну строку данных и создаёт карточку
 * @param {Body} body - Тело документа
 * @param {Array} row - Данные строки
 * @param {number} rowIndex - Индекс строки
 * @param {Array} headers - Заголовки колонок
 * @return {Object} Статистика обработки
 */
function processCard(body, row, rowIndex, headers) {
  const result = {
    processed: false,
    fieldCount: 0,
    skippedFields: 0,
  };

  // Пропускаем пустые строки
  if (row.every((cell) => !cell || cell.toString().trim() === '')) {
    return result;
  }

  // Заголовок карточки
  const cardTitle = body.appendParagraph('📌 Запись #' + rowIndex);
  cardTitle.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  cardTitle.setForegroundColor('#4285f4');

  // Поля карточки
  for (let c = 0; c < headers.length; c++) {
    const fieldName = headers[c] ? headers[c].toString().trim() : '';
    const fieldValue = row[c] ? row[c].toString().trim() : '';

    // Пропускаем пустые заголовки или значения
    if (!fieldName || !fieldValue) {
      result.skippedFields++;
      continue;
    }

    // Создаем абзац для поля
    const fieldPara = body.appendParagraph('');

    // Название поля (жирное)
    const nameText = fieldPara.appendText(fieldName + ': ');
    nameText.setBold(true);
    nameText.setForegroundColor('#333333');

    // Значение поля (обычное)
    const valueText = fieldPara.appendText(fieldValue);
    valueText.setBold(false);
    valueText.setForegroundColor('#000000');

    // Добавляем отступ для красоты
    fieldPara.setIndentStart(20);
    fieldPara.setSpacingBefore(3);
    fieldPara.setSpacingAfter(3);

    result.fieldCount++;
  }

  // Разделитель между карточками
  body.appendParagraph('');
  body.appendHorizontalRule();
  body.appendParagraph('');

  result.processed = true;
  return result;
}

/**
 * Экспортирует документ с улучшенным retry механизмом и проверкой размера
 * @param {string} docId - ID документа
 * @param {string} format - Формат ('docx' или 'pdf')
 * @param {number} maxRetries - Максимальное количество попыток
 * @return {Blob} Blob файла
 */
function exportWithRetry(docId, format, maxRetries) {
  let attempt = 0;
  let bestBlob = null;
  let bestSize = 0;

  while (attempt < maxRetries) {
    try {
      attempt++;
      addLog(`   Попытка ${attempt}/${maxRetries}...`, 'INFO');

      let blob;
      if (format === 'docx') {
        // Word экспорт через URL с улучшенными параметрами
        const docUrl = 'https://docs.google.com/document/d/' + docId + '/export?format=docx';
        const response = UrlFetchApp.fetch(docUrl, {
          headers: {
            'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
          },
          muteHttpExceptions: true, // Не бросать исключения при HTTP ошибках
        });

        const responseCode = response.getResponseCode();
        if (responseCode !== 200) {
          throw new Error(`HTTP ${responseCode}: ${response.getContentText()}`);
        }

        blob = response.getBlob();
      } else {
        // PDF экспорт через getAs с обработкой ошибок
        try {
          const docFile = DriveApp.getFileById(docId);
          blob = docFile.getAs('application/pdf');
        } catch (pdfError) {
          throw new Error('PDF экспорт недоступен: ' + pdfError.message);
        }
      }

      const size = blob.getBytes().length;
      addLog(`   Blob получен: ${size} байт`, 'INFO');

      // Улучшенная проверка размера
      const MIN_EXPECTED_SIZE = format === 'docx' ? 2000 : 1000; // Word обычно больше
      if (size < MIN_EXPECTED_SIZE) {
        addLog(`⚠️ Blob подозрительно маленький (${size} байт < ${MIN_EXPECTED_SIZE})`, 'WARN');

        // Сохраняем как лучший, если он больше предыдущего
        if (size > bestSize) {
          bestBlob = blob;
          bestSize = size;
          addLog(`   Сохраняем как лучший кандидат: ${size} байт`, 'INFO');
        }

        if (attempt < maxRetries) {
          const waitTime = attempt * 2000; // Экспоненциальная задержка
          addLog(`   Ожидание ${waitTime/1000} сек перед повторной попыткой...`, 'INFO');
          Utilities.sleep(waitTime);
          continue;
        } else {
          addLog('⚠️ Все попытки исчерпаны, используем лучший blob', 'WARN');
          return bestBlob || blob;
        }
      }

      addLog(`   ✅ Успешно: ${size} байт`, 'SUCCESS');
      return blob;
    } catch (e) {
      addLog(`   ⚠️ Попытка ${attempt} не удалась: ${e.message}`, 'WARN');

      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // Экспоненциальная задержка
        addLog(`   Ожидание ${waitTime/1000} сек...`, 'INFO');
        Utilities.sleep(waitTime);
      } else {
        // Если есть лучший blob, используем его
        if (bestBlob && bestSize > 0) {
          addLog(`⚠️ Используем лучший сохраненный blob: ${bestSize} байт`, 'WARN');
          return bestBlob;
        }
        throw new Error(`Не удалось экспортировать документ после ${maxRetries} попыток. Последняя ошибка: ${e.message}`);
      }
    }
  }

  // Если все попытки неудачны, бросаем последнюю ошибку
  throw new Error(`Не удалось экспортировать документ после ${maxRetries} попыток`);
}

/**
 * Создает или находит папку для экспортов
 * @return {Folder} Папка Google Drive
 */
function getOrCreateExportFolder() {
  try {
    const folderName = 'Table AI Exports';
    const folders = DriveApp.getFoldersByName(folderName);

    if (folders.hasNext()) {
      return folders.next();
    }
    const newFolder = DriveApp.createFolder(folderName);
    addLog('📁 Создана новая папка: ' + folderName, 'INFO');
    return newFolder;
  } catch (e) {
    addLog('⚠️ Не удалось создать папку, используем корневую: ' + e.message, 'WARN');
    return DriveApp.getRootFolder();
  }
}

/**
 * Получает превью данных листа (первые 3 строки)
 * @param {string} sheetName - Название листа
 * @return {Object} Объект с превью данных
 */
// eslint-disable-next-line no-unused-vars
function getSheetPreview(sheetName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return {success: false, error: 'Лист не найден'};
    }

    const lastRow = Math.min(4, sheet.getLastRow()); // Заголовок + 3 строки
    const lastCol = sheet.getLastColumn();

    if (lastRow === 0 || lastCol === 0) {
      return {success: false, error: 'Лист пустой'};
    }

    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();

    return {
      success: true,
      data: data,
      totalRows: sheet.getLastRow(),
      totalCols: sheet.getLastColumn(),
    };
  } catch (e) {
    return {success: false, error: e.message};
  }
}

/**
 * Получает информацию о размере листа для UI
 * @param {string} sheetName - Название листа
 * @return {Object} Информация о размере листа
 */
// eslint-disable-next-line no-unused-vars
function getSheetSizeInfo(sheetName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return {success: false, error: 'Лист не найден'};
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const totalRows = Math.max(0, lastRow - 1); // Без заголовков

    // Определяем стратегию
    let strategy;
    let estimatedTime;
    if (totalRows <= 100) {
      strategy = 'FULL';
      estimatedTime = '20-30 секунд';
    } else if (totalRows <= 500) {
      strategy = 'BATCHES';
      estimatedTime = '2-4 минуты';
    } else {
      strategy = 'LIMITED';
      estimatedTime = '20-30 секунд (только 100 строк)';
    }

    return {
      success: true,
      totalRows: totalRows,
      totalCols: lastCol,
      strategy: strategy,
      estimatedTime: estimatedTime,
      warning: totalRows > 100,
    };
  } catch (e) {
    return {success: false, error: e.message};
  }
}

/**
 * Получает количество НЕПУСТЫХ строк для листа (без заголовков)
 * @param {string} sheetName - Название листа
 * @return {number} Количество непустых строк данных
 */
// eslint-disable-next-line no-unused-vars
function getNonEmptyRowCount(sheetName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return 0;
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow <= 1 || lastCol === 0) {
      return 0;
    }

    // Читаем все данные и считаем непустые строки
    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    let nonEmptyCount = 0;

    for (let i = 1; i < data.length; i++) { // Пропускаем заголовок
      const row = data[i];
      const hasData = row.some((cell) => cell !== null && cell !== '' && String(cell).trim() !== '');
      if (hasData) {
        nonEmptyCount++;
      }
    }

    addLog(`📊 Лист "${sheetName}": всего ${lastRow - 1} строк, непустых ${nonEmptyCount}`, 'INFO');
    return nonEmptyCount;
  } catch (e) {
    addLog('Ошибка получения количества непустых строк: ' + e.message, 'ERROR');
    return 0;
  }
}

/**
 * Получает количество строк для листа (без заголовков)
 * @param {string} sheetName - Название листа
 * @return {number} Количество строк данных
 */
// eslint-disable-next-line no-unused-vars
function getTotalRowsForSheet(sheetName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return 0;
    }

    const lastRow = sheet.getLastRow();
    return Math.max(0, lastRow - 1); // Без заголовков
  } catch (e) {
    addLog('Ошибка получения количества строк: ' + e.message, 'ERROR');
    return 0;
  }
}
