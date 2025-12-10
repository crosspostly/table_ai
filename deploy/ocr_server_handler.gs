// ═══════════════════════════════════════════════════════════════
// ⭐ OCR SERVER HANDLER - Переработка картинок на сервере
// ═══════════════════════════════════════════════════════════════

/**
 * SERVER функция для OCR обработки изображений (вызывается с КЛИЕНТА)
 * Заменяет clientSide функции на serverSide
 * 
 * КЛИЕНТ делает:  (в ocrRunV2_client.gs)
 * - Собирает картинки из источников (VK, Drive, URL и т.д.)
 * - Конвертирует в base64
 * - Отправляет на СЕРВЕР массив { mimeType, data }
 * 
 * СЕРВЕР делает:  (этот файл)
 * - Получает картинки
 * - Вызывает Gemini Vision API (безопасно с сервера!)
 * - Возвращает транскрибированный текст обратно на КЛИЕНТ
 */

/**
 * ГЛАВНАЯ ФУНКЦИЯ для обработки OCR на сервере
 * 
 * @param {Array} images - Массив изображений [{mimeType, data}, ...]
 * @param {string} lang - Язык распознавания ('ru', 'en' и т.д.)
 * @param {string} apiKey - Gemini API key
 * @param {string} delimiter - Разделитель между изображениями
 * @return {string} Объединённый текст со всех изображений
 * 
 * ПРИМЕР ИСПОЛЬЗОВАНИЯ (с клиента):
 * 
 * const images = [
 *   { mimeType: 'image/jpeg', data: 'base64string1' },
 *   { mimeType: 'image/png', data: 'base64string2' }
 * ];
 * 
 * const result = serverOcrProcessImages_(images, 'ru', apiKey, '____');
 * // → "Текст с первого скрина\n____\nТекст со второго скрина"
 */
function serverOcrProcessImages_(images, lang, apiKey, delimiter) {
  Logger.log('╔════════════════════════════════════════════════════════╗');
  Logger.log('║ serverOcrProcessImages_ START                         ║');
  Logger.log('╚════════════════════════════════════════════════════════╝');
  
  Logger.log('📊 Параметры:');
  Logger.log('  • images: ' + images.length + ' шт');
  Logger.log('  • lang: ' + lang);
  Logger.log('  • apiKey: ' + (apiKey ? '✅ SET' : '❌ NOT SET'));
  Logger.log('  • delimiter: ' + (delimiter || 'NONE'));

  if (!Array.isArray(images) || images.length === 0) {
    Logger.log('❌ ERROR: No images provided');
    throw new Error('NO_IMAGES');
  }

  if (!apiKey || typeof apiKey !== 'string') {
    Logger.log('❌ ERROR: Invalid API key');
    throw new Error('NO_API_KEY');
  }

  // Валидация каждого изображения
  Logger.log('\n🔍 Валидация изображений:');
  const validImages = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!img || !img.mimeType || !img.data) {
      Logger.log(`  ⚠️ [${i}] Пропущено: некорректная структура`);
      continue;
    }
    Logger.log(`  ✅ [${i}] ${img.mimeType} - ${img.data.length} bytes`);
    validImages.push(img);
  }

  if (validImages.length === 0) {
    Logger.log('❌ ERROR: No valid images after validation');
    throw new Error('NO_VALID_IMAGES');
  }

  Logger.log(`\n📦 Готово к обработке: ${validImages.length} изображений\n`);

  try {
    // Строим промпт с инструкциями
    const instruction = ocrBuildInstruction_(lang, delimiter);
    Logger.log('📝 Инструкция Gemini: ' + instruction.substring(0, 100) + '...\n');

    // Строим части для Gemini Vision API
    const parts = [{text: instruction}];
    
    for (let i = 0; i < validImages.length; i++) {
      const img = validImages[i];
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data  // уже в base64!
        }
      });
    }

    Logger.log(`✅ Построена структура запроса Gemini: ${parts.length} частей`);
    Logger.log('');

    // Вызываем Gemini Vision API (через функцию из server.gs)
    const result = callGeminiVisionApi_(parts, apiKey);

    Logger.log('');
    Logger.log('✅ Gemini Vision API успешно обработал ' + validImages.length + ' изображений');
    Logger.log('📊 Результат: ' + result.length + ' символов');
    Logger.log('');

    Logger.log('╔════════════════════════════════════════════════════════╗');
    Logger.log('║ serverOcrProcessImages_ COMPLETED ✅                  ║');
    Logger.log('╚════════════════════════════════════════════════════════╝');

    return result;
  } catch (error) {
    Logger.log('❌ ERROR in serverOcrProcessImages_: ' + error.message);
    Logger.log('');
    Logger.log('╔════════════════════════════════════════════════════════╗');
    Logger.log('║ serverOcrProcessImages_ FAILED ❌                     ║');
    Logger.log('╚════════════════════════════════════════════════════════╝');
    throw error;
  }
}

/**
 * Построить инструкцию для Gemini Vision API
 * @param {string} lang - Язык ('ru', 'en', etc)
 * @param {string} delimiter - Разделитель между изображениями
 * @return {string} Инструкция для Gemini
 */
function ocrBuildInstruction_(lang, delimiter) {
  let instruction = 'Задача: транскрибируй текст на каждом изображении БЕЗ добавления от себя. Верни только чистый текст. ';
  
  if (delimiter && delimiter.length > 0) {
    instruction += 'Если изображений несколько — разделяй каждое изображение строкой с разделителем: ' + delimiter + ' (на отдельной строке). ';
  } else {
    instruction += 'Если изображений несколько — разделяй нумерацией (1., 2., 3., ...). ';
  }
  
  if (lang) {
    instruction += 'Язык исходного текста: ' + lang + '. ';
  }
  
  instruction += 'Ничего не добавляй, не интерпретируй, не переводи!';
  
  return instruction;
}

/**
 * Вызвать Gemini Vision API для распознавания текста на изображениях
 * @param {Array} parts - Части запроса (текст + изображения)
 * @param {string} apiKey - Gemini API key
 * @return {string} Распознанный текст
 */
function callGeminiVisionApi_(parts, apiKey) {
  Logger.log('🌐 Отправка запроса к Gemini Vision API (Wrapped)...');

  const modelConfig = {
    model: 'gemini-2.0-flash',
    apiKey: apiKey,
    maxTokens: 4096,
    temperature: 0
  };
  
  const promptObj = {
      contents: [{parts: parts}]
  };
  
  // Use Rate Limited Executor (defined in server.gs)
  const result = executeGeminiWithRateLimit(modelConfig, promptObj, {maxRetries: 3});
  
  if (!result.success) {
      throw new Error('GEMINI_API_ERROR: ' + result.error);
  }
  
  return result.data;
}

/**
 * Разбить результат по разделителю
 * @param {string} text - Текст с разделителями
 * @return {Array} Массив отдельных результатов
 */
function ocrSplitByDelimiter_(text) {
  const s = String(text || '').trim();
  if (!s) return [];

  // Основной способ: маркер ____ (четыре и более подчёркиваний)
  const parts = s.split(/\n?_{4,}\n?/g)
    .map(function(x) { return String(x || '').trim(); })
    .filter(Boolean);

  if (parts.length > 1) {
    Logger.log('✅ Разбито по разделителю: ' + parts.length + ' частей');
    return parts;
  }

  // Запасной способ: параграфы (2+ пустых строк)
  const parts2 = s.split(/\n{2,}/g)
    .map(function(x) { return String(x || '').trim(); })
    .filter(Boolean);

  if (parts2.length > 1) {
    Logger.log('✅ Разбито по параграфам: ' + parts2.length + ' частей');
    return parts2;
  }

  Logger.log('⚠️ Не удалось разбить, возвращаю как один результат');
  return [s];
}

/**
 * Единственное OCR изображение (удобство для простых случаев)
 * @param {Object} image - {mimeType, data}
 * @param {string} lang - Язык
 * @param {string} apiKey - Gemini API key
 * @return {string} Распознанный текст
 */
function serverOcrSingleImage_(image, lang, apiKey) {
  Logger.log('serverOcrSingleImage_: Processing single image...');
  
  if (!image || !image.mimeType || !image.data) {
    throw new Error('INVALID_IMAGE');
  }

  const result = serverOcrProcessImages_([image], lang, apiKey, null);
  return result ? result.trim() : '';
}
