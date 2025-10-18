// ====== OCR отзывов (изображения/ссылки в A → текст в B) через Gemini (одного GEMINI_API_KEY достаточно) ======
const OCR_LANGUAGE = 'ru';
const MAX_FOLDER_IMAGES = 50; // для GDrive и локальных итераторов
const OCR_BATCH_LIMIT = 50; // общий лимит изображений/отзывов за один прогон по строке

function ocrGetStateKey_(row) {
  return 'OCRQ:row:' + row;
}
function ocrGetState_(row) {
  try {
    const s = PropertiesService.getScriptProperties().getProperty(ocrGetStateKey_(row));
    return s ? JSON.parse(s) : null;
  } catch (e) {
    return null;
  }
}
function ocrSetState_(row, state) {
  try {
    PropertiesService.getScriptProperties().setProperty(ocrGetStateKey_(row), JSON.stringify(state||{}));
  } catch (e) {}
}
function ocrClearState_(row) {
  try {
    PropertiesService.getScriptProperties().deleteProperty(ocrGetStateKey_(row));
  } catch (e) {}
}
function ocrSignature_(textVal, formula) {
  return String(textVal||'') + '|' + String(formula||'');
}

function ocrFindNextRow_(sh, r) {
  try {
    const last = Math.max(r, sh.getLastRow());
    let row = r;
    const b0 = String(sh.getRange(row, 2).getDisplayValue() || '').trim();
    if (!b0) return row;
    row++;
    while (row <= last) {
      const a = String(sh.getRange(row, 1).getDisplayValue() || '').trim();
      const b = String(sh.getRange(row, 2).getDisplayValue() || '').trim();
      if (a) break; // встретили следующую запись в A → предыдущий блок завершён
      if (b) row++; else break; // продолжаем, пока B занято и A пусто
    }
    return row; // первая пустая строка после блока
  } catch (e) {
    return r;
  }
}

function ocrReviews() {
  try {
    // Лицензия (если сервер недоступен — в DEV_MODE продолжаем)
    try {
      if (typeof serverStatus_ === 'function') {
        var st = serverStatus_();
        if (!st.ok && !(typeof DEV_MODE !== 'undefined' && DEV_MODE)) {
          SpreadsheetApp.getUi().alert('Лицензия', '❌ Лицензия не активна или сервер недоступен', SpreadsheetApp.getUi().ButtonSet.OK);
          return;
        }
      }
    } catch (e) {/* игнорируем в DEV */}

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('Отзывы');
    if (!sh) {
      SpreadsheetApp.getUi().alert('Лист "Отзывы" не найден'); return;
    }
    let lastRow = Math.max(2, sh.getLastRow());
    let processed = 0; let empty = 0; let errors = 0; let skipped = 0;
    const overwrite = getOcrOverwrite_();

    for (let r = 2; r <= lastRow; r++) {
      const rangeA = sh.getRange(r, 1);
      const textVal = String(rangeA.getDisplayValue() || '').trim();
      const formula = String(rangeA.getFormula() || '');
      let richUrl = '';
      try {
        const rich = rangeA.getRichTextValue();
        if (rich) {
          // 1) По сегментам
          const runs = rich.getRuns && rich.getRuns();
          if (runs && runs.length) {
            for (let ri = 0; ri < runs.length; ri++) {
              var st = runs[ri].getTextStyle && runs[ri].getTextStyle();
              const lu = st && st.getLinkUrl && st.getLinkUrl();
              if (lu) {
                richUrl = String(lu).trim(); break;
              }
            }
          }
          // 2) Ссылка на всю ячейку
          if (!richUrl && typeof rich.getLinkUrl === 'function') {
            const ru = rich.getLinkUrl();
            if (ru) richUrl = String(ru).trim();
          }
          // 3) Через стиль всей ячейки
          if (!richUrl && rich.getTextStyle) {
            const ts = rich.getTextStyle();
            const lu2 = ts && ts.getLinkUrl && ts.getLinkUrl();
            if (lu2) richUrl = String(lu2).trim();
          }
        }
      } catch (e) {}
      if (!textVal && !formula && !richUrl) {
        empty++; continue;
      }

      // Политика перезаписи: если B уже заполнено и overwrite=false — пропускаем строку,
      // но если есть активная очередь по этой строке (signature совпадает) — продолжаем
      const sig = ocrSignature_(textVal, formula);
      let state = ocrGetState_(r);
      const hasActiveQueue = !!(state && state.signature === sig);
      const bVal = String(sh.getRange(r, 2).getDisplayValue() || '').trim();
      if (!overwrite && bVal && !hasActiveQueue) {
        skipped++; continue;
      }

      const sources = parseSourcesFromCell_(textVal, formula, richUrl);
      if (!sources.length) {
        addLog('⚠️ Нет источников в A' + r + ': text="' + String(textVal).slice(0, 120) + '" formula="' + String(formula).slice(0, 120) + '" link="' + richUrl + '"', 'WARN');
        empty++;
        continue;
      }

      // Инициализация состояния очереди по строке
      if (!state || state.signature !== sig) {
        state = {signature: sig, sources: {}};
      }

      // Куда писать: если B уже есть (и мы не пересоздаём), дописываем ниже блока
      const writeRow = bVal ? ocrFindNextRow_(sh, r) : r;

      // Собираем изображения и тексты из источников с учётом offset и общего лимита по строке
      let batchImages = [];
      let collectedTexts = [];
      let remainingCap = OCR_BATCH_LIMIT;
      let hasMoreAny = false;
      for (let i = 0; i < sources.length && remainingCap > 0; i++) {
        const src = sources[i];
        const key = src.kind + ':' + (src.id || src.url || '');
        const srcState = state.sources[key] || {offset: 0, done: false};
        if (srcState.done) continue;
        let part = {images: [], texts: [], hasMore: false, nextOffset: srcState.offset};
        try {
          part = ocrSource_(src, OCR_LANGUAGE, srcState.offset, remainingCap) || part;
        } catch (e1) {
          errors++; addLog('❌ OCR parse error (row ' + r + '): ' + e1.message, 'ERROR');
        }
        let added = 0;
        if (part.texts && part.texts.length) {
          collectedTexts = collectedTexts.concat(part.texts); added += part.texts.length;
        }
        if (added < remainingCap && part.images && part.images.length) {
          batchImages = batchImages.concat(part.images); added += part.images.length;
        }
        remainingCap = Math.max(0, remainingCap - added);
        if (part.hasMore) {
          hasMoreAny = true; srcState.offset = part.nextOffset || (srcState.offset + added);
        } else {
          srcState.done = true; srcState.offset = part.nextOffset || srcState.offset;
        }
        state.sources[key] = srcState;
      }
      if (!batchImages.length && !collectedTexts.length) {
        empty++; continue;
      }

      let reviews = [];
      // Сначала используем тексты (если это обсуждение VK и т.п.)
      // Лимитируем общий выпуск по строке до OCR_BATCH_LIMIT
      if (collectedTexts.length) {
        reviews = collectedTexts.slice(0, OCR_BATCH_LIMIT);
      }
      const remaining = Math.max(0, OCR_BATCH_LIMIT - reviews.length);
      if (remaining > 0 && batchImages.length) {
        // Ограничим количество изображений
        const limitedImages = batchImages.slice(0, remaining);
        try {
          const out = serverGmOcrBatch_(limitedImages, OCR_LANGUAGE);
          let arr = splitNumberedReviews_(out);
          if (arr.length <= 1) {
            const alt = (out || '').split(/\n{2,}/).map(function(s) {
              return String(s||'').trim();
            }).filter(function(s) {
              return !!s;
            });
            arr = alt.length > 1 ? alt : [out];
          }
          reviews = reviews.concat(arr);
        } catch (e2) {
          errors++;
          addLog('❌ OCR batch error (row ' + r + '): ' + e2.message, 'ERROR');
          // fallback: по одному изображению
          try {
            for (let j = 0; j < limitedImages.length; j++) {
              const b = Utilities.newBlob(Utilities.base64Decode(limitedImages[j].data), limitedImages[j].mimeType || 'image/png', 'img');
              const t = gmOcrFromBlob_(b, OCR_LANGUAGE);
              if (t && String(t).trim()) reviews.push(String(t).trim());
            }
          } catch (e3) {
            addLog('❌ OCR fallback error (row ' + r + '): ' + e3.message, 'ERROR');
          }
        }
      }

      if (!reviews.length) {
        empty++; continue;
      }
      if (reviews.length > 1) {
        sh.insertRowsAfter(writeRow, reviews.length - 1);
        lastRow += (reviews.length - 1);
      }
      const matrix = reviews.map(function(x) {
        return [x];
      });
      sh.getRange(writeRow, 2, reviews.length, 1).setValues(matrix);
      if (reviews.length > 1 && writeRow === r) {
        r += (reviews.length - 1); // пропустим только что вставленные строки, если писали в текущую строку
      }

      // Сохраняем/очищаем состояние очереди
      if (hasMoreAny || remainingCap === 0) {
        ocrSetState_(r, state);
      } else {
        ocrClearState_(r);
      }

      processed++;
      Utilities.sleep(150); // чуть притормозим, чтобы не упереться в квоты
    }
    SpreadsheetApp.getUi().alert('OCR завершён', 'Строк обработано: ' + processed + '\nПропущено (B уже заполнено): ' + skipped + '\nПустых: ' + empty + '\nОшибок: ' + errors + '\n\nЛимит: ' + OCR_BATCH_LIMIT + ' за запуск. Если остались элементы — запустите ещё раз.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    addLog('❌ OCR авария: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка OCR: ' + e.message);
  }
}

function getOcrOverwrite_() {
  try {
    let v = PropertiesService.getScriptProperties().getProperty('OCR_OVERWRITE');
    if (!v) return false; // по умолчанию НЕ перезаписываем
    v = String(v).toLowerCase().trim();
    return v === '1' || v === 'true' || v === 'yes' || v === 'да';
  } catch (e) {
    return false;
  }
}

function parseSourcesFromCell_(textVal, formula, richUrl) {
  let arr = [];
  // 0) Гиперссылка на ячейке
  if (richUrl) {
    const norm = normalizeUrl_(richUrl);
    if (norm) arr.push(classifyUrlSource_(norm));
  }
  // 1) IMAGE("...")
  const urlFromImage = parseImageFormulaUrl_(formula);
  if (urlFromImage) arr.push(classifyUrlSource_(normalizeUrl_(urlFromImage)));
  // 1.1) HYPERLINK("...")
  const urlFromHyper = parseHyperlinkFormulaUrl_(formula);
  if (urlFromHyper) arr.push(classifyUrlSource_(normalizeUrl_(urlFromHyper)));

  // 2) Явные ссылки в тексте (может быть несколько через перевод строки/пробел)
  let urls = [];
  try {
    // a) http/https
    (textVal.match(/https?:\/\/\S+/g) || []).forEach(function(s) {
      urls.push(s);
    });
    // b) без схемы (vk.com/…, drive.google.com/…, yadi.sk/…, disk.yandex.ru/…, dropbox.com/…)
    (textVal.match(/(?:^|\s)(?:vk\.com|drive\.google\.com|yadi\.sk|disk\.yandex\.(?:ru|com)|dropbox\.com)\/\S+/gi) || [])
      .forEach(function(s) {
        urls.push(s.trim());
      });
  } catch (e) {}
  urls = urls.map(function(s) {
    return normalizeUrl_(s.replace(/[),.;]+$/, ''));
  });
  urls.forEach(function(u) {
    arr.push(classifyUrlSource_(u));
  });

  // Уникализируем источники
  const seen = {};
  arr = arr.filter(function(s) {
    const k = s.kind + ':' + (s.url || s.id);
    if (seen[k]) return false; seen[k] = true; return true;
  });
  return arr;
}

function classifyUrlSource_(u) {
  // VK album/topic
  const vk = detectVkLink_(u);
  if (vk) return vk; // { kind: 'vk-album'|'vk-topic', url }
  // Google Drive
  const g = detectDriveLink_(u);
  if (g && g.type === 'folder') return {kind: 'drive-folder', id: g.id};
  if (g && g.type === 'file') return {kind: 'drive-file', id: g.id};
  // Yandex Disk (public)
  if (isYandexPublic_(u)) return {kind: 'yadisk', url: u};
  // Dropbox file share
  if (isDropboxLink_(u)) return {kind: 'dropbox-file', url: u};
  // Generic URL (пытаемся скачать как картинку)
  return {kind: 'url', url: u};
}

function parseImageFormulaUrl_(formula) {
  if (!formula) return '';
  const f = String(formula).trim();
  // Поддержка локализованных имён функций: IMAGE / ИЗОБРАЖЕНИЕ; кавычки ' или "
  const m = f.match(/^=\s*(?:IMAGE|ИЗОБРАЖЕНИЕ)\s*\(\s*(["'])([^"']+)\1/i);
  return m ? m[2] : '';
}

function parseHyperlinkFormulaUrl_(formula) {
  if (!formula) return '';
  const f = String(formula).trim();
  // Поддержка локализованных имён функций: HYPERLINK / ГИПЕРССЫЛКА; кавычки ' или "
  const m = f.match(/^=\s*(?:HYPERLINK|ГИПЕРССЫЛКА)\s*\(\s*(["'])([^"']+)\1/i);
  return m ? m[2] : '';
}

function normalizeUrl_(u) {
  try {
    let s = String(u || '').trim();
    if (!s) return '';
    // если завернут в <...> — уберём
    s = s.replace(/^<+|>+$/g, '');
    if (/^https?:\/\//i.test(s)) return s;
    if (/^www\./i.test(s)) return 'https://' + s;
    if (/^(vk\.com|drive\.google\.com|yadi\.sk|disk\.yandex\.(?:ru|com)|dropbox\.com)\//i.test(s)) return 'https://' + s;
    return s;
  } catch (e) {
    return String(u || '');
  }
}

function detectDriveLink_(url) {
  try {
    const u = String(url || '');
    const m1 = u.match(/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/);
    if (m1) return {type: 'folder', id: m1[1]};
    const m2 = u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m2) return {type: 'file', id: m2[1]};
    const m3 = u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m3) return {type: 'file', id: m3[1]};
    return null;
  } catch (e) {
    return null;
  }
}

function ocrSource_(src, lang, offset, limit) {
  // Возвращаем объект { images: [inlineData...], texts: [ ... ] }
  if (src.kind === 'drive-folder') {
    return enumerateDriveFolderImages_(src.id, offset || 0, Math.max(0, limit || OCR_BATCH_LIMIT));
  } else if (src.kind === 'drive-file') {
    const file = DriveApp.getFileById(src.id);
    if (offset && offset > 0) return {images: [], texts: [], hasMore: false, nextOffset: offset};
    return {images: [{mimeType: file.getBlob().getContentType() || 'image/png', data: Utilities.base64Encode(file.getBlob().getBytes())}], texts: [], hasMore: false, nextOffset: 1};
  } else if (src.kind === 'url') {
    const resp = UrlFetchApp.fetch(src.url, {muteHttpExceptions: true, followRedirects: true});
    if (resp.getResponseCode() >= 300) throw new Error('HTTP ' + resp.getResponseCode() + ' по URL');
    const blob = resp.getBlob();
    if (offset && offset > 0) return {images: [], texts: [], hasMore: false, nextOffset: offset};
    return {images: [{mimeType: blob.getContentType() || 'image/png', data: Utilities.base64Encode(blob.getBytes())}], texts: [], hasMore: false, nextOffset: 1};
  } else if (src.kind === 'yadisk') {
    return collectYandexPublic_(src.url, offset || 0, Math.max(0, limit || OCR_BATCH_LIMIT));
  } else if (src.kind === 'dropbox-file') {
    const dl = toDropboxDirect_(src.url);
    const resp2 = UrlFetchApp.fetch(dl, {muteHttpExceptions: true, followRedirects: true});
    if (resp2.getResponseCode() >= 300) throw new Error('Dropbox HTTP ' + resp2.getResponseCode());
    const blob2 = resp2.getBlob();
    if (offset && offset > 0) return {images: [], texts: [], hasMore: false, nextOffset: offset};
    return {images: [{mimeType: blob2.getContentType() || 'image/png', data: Utilities.base64Encode(blob2.getBytes())}], texts: [], hasMore: false, nextOffset: 1};
  } else if (src.kind === 'vk-album') {
    return collectVkAlbum_(src.url, offset || 0, Math.max(0, limit || OCR_BATCH_LIMIT));
  } else if (src.kind === 'vk-topic') {
    return collectVkDiscussion_(src.url, offset || 0, Math.max(0, limit || OCR_BATCH_LIMIT));
  } else if (src.kind === 'vk-reviews') {
    return collectVkReviews_(src.url, offset || 0, Math.max(0, limit || OCR_BATCH_LIMIT));
  }
  return {images: [], texts: [], hasMore: false, nextOffset: offset || 0};
}

function ocrDriveFolder_(folderId, lang) {
  const folder = DriveApp.getFolderById(folderId);
  const texts = [];
  const it = folder.getFiles();
  let n = 0;
  while (it.hasNext()) {
    const f = it.next();
    // фильтруем по типу
    const mt = String(f.getMimeType() || '').toLowerCase();
    if (mt.indexOf('image/') !== 0) continue;
    try {
      const blob = f.getBlob();
      const t = gmOcrFromBlob_(blob, lang);
      if (t && String(t).trim()) texts.push(String(t).trim());
    } catch (e) {
      addLog('⚠️ OCR по файлу из папки: ' + f.getName() + ' → ' + e.message, 'WARN');
    }
    n++; if (n >= MAX_FOLDER_IMAGES) break;
    Utilities.sleep(150);
  }
  return texts.join('\n\n');
}

function collectDriveFolderImages_(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const list = [];
  const it = folder.getFiles();
  let n = 0;
  while (it.hasNext()) {
    const f = it.next();
    const mt = String(f.getMimeType() || '').toLowerCase();
    if (mt.indexOf('image/') !== 0) continue;
    const blob = f.getBlob();
    list.push({mimeType: blob.getContentType() || 'image/png', data: Utilities.base64Encode(blob.getBytes())});
    n++; if (n >= MAX_FOLDER_IMAGES) break;
  }
  return list;
}

function enumerateDriveFolderImages_(folderId, offset, limit) {
  const folder = DriveApp.getFolderById(folderId);
  const it = folder.getFiles();
  const images = [];
  let imgIndex = 0;
  while (it.hasNext()) {
    const f = it.next();
    const mt = String(f.getMimeType() || '').toLowerCase();
    if (mt.indexOf('image/') !== 0) continue;
    if (imgIndex < offset) {
      imgIndex++; continue;
    }
    const blob = f.getBlob();
    images.push({mimeType: blob.getContentType() || 'image/png', data: Utilities.base64Encode(blob.getBytes())});
    imgIndex++;
    if (images.length >= limit) break;
  }
  const hasMore = it.hasNext();
  const nextOffset = offset + images.length;
  return {images: images, texts: [], hasMore: hasMore, nextOffset: nextOffset};
}

function gmOcrFromBlob_(blob, lang) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Не задан GEMINI_API_KEY');
  const mime = blob.getContentType() || 'image/png';
  const b64 = Utilities.base64Encode(blob.getBytes());
  const instruction = 'Задача: транскрибируй текст на изображении БЕЗ добавления от себя. Верни только чистый текст. Если на вход подается несколько изображений — разделяй отзывы нумерацией (1., 2., 3.).' + (lang ? ' Язык исходного текста: ' + lang + '.' : '');
  const body = {
    contents: [{
      parts: [
        {text: instruction},
        {inlineData: {mimeType: mime, data: b64}},
      ],
    }],
    generationConfig: {maxOutputTokens: 2048, temperature: 0},
  };
  const resp = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  const data = JSON.parse(resp.getContentText());
  if (code !== 200) {
    const msg = (data && data.error && data.error.message) || ('HTTP_' + code);
    throw new Error('Gemini OCR: ' + msg);
  }
  const candidate = data.candidates && data.candidates[0];
  const content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
  const text = content && content.text ? content.text : '';
  if (typeof processGeminiResponse === 'function') {
    return processGeminiResponse(text);
  }
  return text;
}

function serverGmOcrBatch_(images, lang) {
  const email = (typeof getLicenseEmail === 'function') ? getLicenseEmail() : '';
  const token = (typeof getLicenseToken === 'function') ? getLicenseToken() : '';
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const payload = {action: 'gm_image', email: email, token: token, apiKey: apiKey, images: images, lang: lang || 'ru'};
  const resp = UrlFetchApp.fetch(SERVER_URL, {method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true});
  const code = resp.getResponseCode();
  const data = JSON.parse(resp.getContentText());
  if (code !== 200 || !data || !data.ok) throw new Error((data && data.error) || ('HTTP_' + code));
  return data.data || '';
}

function splitNumberedReviews_(text) {
  const s = String(text || '').trim();
  if (!s) return [];
  // Ищем паттерн нумерации 1. ... 2. ... 3. ... (в начале строки)
  let parts = s.split(/\n\s*(?=\d+\.)/g).map(function(x) {
    return String(x||'').trim();
  }).filter(function(x) {
    return !!x;
  });
  // Если первая часть не начинается с "1.", не считаем это нумерацией
  if (!/^\d+\.\s/.test(parts[0])) return [s];
  // Убираем префиксы "N."
  parts = parts.map(function(x) {
    return x.replace(/^\d+\.\s*/, '');
  });
  return parts;
}

// ===== Провайдеры: Yandex Disk (публичный), Dropbox-file, VK (album/topic через ваше веб-приложение) =====
function isYandexPublic_(u) {
  return /yadi\.sk\//i.test(u) || /disk\.yandex\.(ru|com)\//i.test(u);
}
function isDropboxLink_(u) {
  return /dropbox\.com\//i.test(u);
}
function toDropboxDirect_(u) {
  try {
    let url = u.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    if (url.indexOf('?dl=0') >= 0) url = url.replace('?dl=0', '?dl=1');
    if (url.indexOf('?dl=1') < 0 && url.indexOf('?') < 0) url += '?dl=1';
    return url;
  } catch (e) {
    return u;
  }
}

function collectYandexPublic_(publicUrl, offset, limit) {
  // public/resources может отдавать как файл, так и папку. Для папки пройдёмся children и возьмём только image/* (до OCR_BATCH_LIMIT)
  const base = 'https://cloud-api.yandex.net/v1/disk/public/resources';
  const download = 'https://cloud-api.yandex.net/v1/disk/public/resources/download';
  const images = [];
  try {
    const res = UrlFetchApp.fetch(base + '?public_key=' + encodeURIComponent(publicUrl), {muteHttpExceptions: true, followRedirects: true});
    const code = res.getResponseCode();
    const data = JSON.parse(res.getContentText());
    if (code >= 300) throw new Error('Yandex public meta HTTP ' + code);
    if (data && data.type === 'file') {
      if (offset && offset > 0) return {images: [], texts: [], hasMore: false, nextOffset: offset};
      const dl = UrlFetchApp.fetch(download + '?public_key=' + encodeURIComponent(publicUrl)).getContentText();
      const link = JSON.parse(dl).href;
      const f = UrlFetchApp.fetch(link, {muteHttpExceptions: true, followRedirects: true});
      const blob = f.getBlob();
      images.push({mimeType: blob.getContentType() || 'image/png', data: Utilities.base64Encode(blob.getBytes())});
      return {images: images, texts: [], hasMore: false, nextOffset: 1};
    } else if (data && data.type === 'dir') {
      // Скан по страницам до набора limit изображений, учитывая image-offset
      let pageOffset = 0;
      let imgSeen = 0;
      const takeLimit = Math.max(0, limit || OCR_BATCH_LIMIT);
      while (images.length < takeLimit) {
        const meta = UrlFetchApp.fetch(base + '?public_key=' + encodeURIComponent(publicUrl) + '&limit=200&offset=' + pageOffset, {muteHttpExceptions: true, followRedirects: true});
        const md = JSON.parse(meta.getContentText());
        const items = (md && md._embedded && md._embedded.items) || [];
        if (!items.length) break;
        for (let i = 0; i < items.length && images.length < takeLimit; i++) {
          const it = items[i];
          if (it.type !== 'file') continue;
          const mime = String(it.mime_type || '').toLowerCase();
          if (mime.indexOf('image/') !== 0) continue;
          if (imgSeen < (offset || 0)) {
            imgSeen++; continue;
          }
          const dl2 = UrlFetchApp.fetch(download + '?public_key=' + encodeURIComponent(publicUrl) + '&path=' + encodeURIComponent(it.path)).getContentText();
          const link2 = JSON.parse(dl2).href;
          const f2 = UrlFetchApp.fetch(link2, {muteHttpExceptions: true, followRedirects: true});
          const blob2 = f2.getBlob();
          images.push({mimeType: blob2.getContentType() || 'image/png', data: Utilities.base64Encode(blob2.getBytes())});
          imgSeen++;
        }
        pageOffset += items.length;
        if (items.length < 200) break;
      }
      const hasMore = images.length >= takeLimit; // грубая оценка
      const nextOffset = (offset || 0) + images.length;
      return {images: images, texts: [], hasMore: hasMore, nextOffset: nextOffset};
    }
  } catch (e) {
    addLog('⚠️ Yandex public error: ' + e.message, 'WARN');
  }
  return {images: images, texts: [], hasMore: false, nextOffset: (offset || 0) + images.length};
}

function detectVkLink_(u) {
  const s = String(u||'');
  // album-123_456 или album123_456
  if (/vk\.com\/(reviews-?\d+)/i.test(s)) return {kind: 'vk-reviews', url: u};
  if (/vk\.com\/(album-?\d+_\d+)/i.test(s)) return {kind: 'vk-album', url: u};
  if (/vk\.com\/(topic-?\d+_\d+)/i.test(s)) return {kind: 'vk-topic', url: u};
  return null;
}

function getVkWebAppUrl_() {
  if (typeof VK_PARSER_URL === 'undefined' || !VK_PARSER_URL) {
    throw new Error('Не задан VK_PARSER_URL');
  }
  return String(VK_PARSER_URL).replace(/\/$/, '');
}

function getVkTokenLocal_() {
  return PropertiesService.getScriptProperties().getProperty('VK_TOKEN') || '';
}

function collectVkAlbum_(albumUrl, offset, limit) {
  const base = getVkWebAppUrl_();
  const take = Math.max(0, limit || OCR_BATCH_LIMIT);
  const url = base + '?action=parseAlbum&url=' + encodeURIComponent(albumUrl) + '&limit=' + take + '&offset=' + (offset || 0);
  const resp = UrlFetchApp.fetch(url, {muteHttpExceptions: true, followRedirects: true});
  const code = resp.getResponseCode();
  let data = null;
  try {
    data = JSON.parse(resp.getContentText());
  } catch (e) {}
  if (code >= 300 || (data && data.error)) {
    addLog('VK album via web-app failed: HTTP ' + code + (data && data.error ? ('; error=' + data.error) : ''), 'WARN');
    const hasLocalToken = !!getVkTokenLocal_();
    if (hasLocalToken) {
      addLog('Attempt direct photos.get fallback (local VK_TOKEN present)', 'INFO');
      return fetchVkAlbumDirect_(albumUrl, offset || 0, take);
    } else {
      addLog('Skip direct fallback: VK_TOKEN not set in this script — web app is authoritative', 'INFO');
      return {images: [], texts: [], hasMore: false, nextOffset: offset || 0};
    }
  }
  const imgs = [];
  if (data && data.images && data.images.length) {
    for (let i = 0; i < data.images.length && imgs.length < take; i++) {
      try {
        const u = data.images[i].url || data.images[i];
        const f = UrlFetchApp.fetch(u, {muteHttpExceptions: true, followRedirects: true});
        if (f.getResponseCode() >= 300) continue;
        const b = f.getBlob();
        imgs.push({mimeType: b.getContentType() || 'image/jpeg', data: Utilities.base64Encode(b.getBytes())});
      } catch (e) {}
    }
  }
  const hasMore = !!(data && data.hasMore);
  const nextOffset = (data && data.nextOffset != null) ? data.nextOffset : ((offset || 0) + (data && data.images ? data.images.length : 0));
  return {images: imgs, texts: [], hasMore: hasMore, nextOffset: nextOffset};
}

function fetchVkAlbumDirect_(albumUrl, offset, limit) {
  const token = getVkTokenLocal_();
  if (!token) {
    addLog('VK album direct fallback requires VK_TOKEN in Script Properties', 'ERROR');
    return {images: [], texts: [], hasMore: false, nextOffset: offset};
  }
  const m = String(albumUrl).match(/vk\.com\/album(-?\d+)_([0-9]+)/i);
  if (!m) {
    addLog('VK album URL parse failed: ' + albumUrl, 'ERROR'); return {images: [], texts: [], hasMore: false, nextOffset: offset};
  }
  const ownerId = parseInt(m[1], 10);
  const albumId = parseInt(m[2], 10);
  const v = '5.131';
  const take = Math.max(1, Math.min(1000, limit || OCR_BATCH_LIMIT));
  const api = 'https://api.vk.com/method/photos.get' +
    '?owner_id=' + ownerId +
    '&album_id=' + albumId +
    '&count=' + take +
    '&offset=' + Math.max(0, offset || 0) +
    '&photo_sizes=1' +
    '&access_token=' + encodeURIComponent(token) +
    '&v=' + v;
  try {
    const r = UrlFetchApp.fetch(api, {muteHttpExceptions: true});
    const code = r.getResponseCode();
    const js = JSON.parse(r.getContentText());
    if (code !== 200 || js.error) {
      addLog('VK photos.get error: HTTP ' + code + (js && js.error ? ('; ' + js.error.error_msg) : ''), 'ERROR');
      return {images: [], texts: [], hasMore: false, nextOffset: offset};
    }
    const resp = js.response || {};
    const items = resp.items || [];
    const total = resp.count || (offset + items.length);
    const images = [];
    for (let i = 0; i < items.length && images.length < take; i++) {
      const ph = items[i];
      const sizes = ph.sizes || [];
      let best = null;
      for (let k = 0; k < sizes.length; k++) {
        const s = sizes[k];
        if (!best || (s.width * s.height > best.width * best.height)) best = s;
      }
      if (best && best.url) {
        try {
          const f = UrlFetchApp.fetch(best.url, {muteHttpExceptions: true, followRedirects: true});
          if (f.getResponseCode() >= 300) continue;
          const b = f.getBlob();
          images.push({mimeType: b.getContentType() || 'image/jpeg', data: Utilities.base64Encode(b.getBytes())});
        } catch (e) {}
      }
    }
    const hasMore = (offset + items.length) < total;
    const nextOffset = (offset || 0) + items.length;
    return {images: images, texts: [], hasMore: hasMore, nextOffset: nextOffset};
  } catch (e) {
    addLog('VK album direct fallback exception: ' + e.message, 'ERROR');
    return {images: [], texts: [], hasMore: false, nextOffset: offset};
  }
}

function collectVkDiscussion_(topicUrl, offset, limit) {
  const base = getVkWebAppUrl_();
  const take = Math.max(0, limit || OCR_BATCH_LIMIT);
  const resp = UrlFetchApp.fetch(base + '?action=parseDiscussion&url=' + encodeURIComponent(topicUrl) + '&limit=' + take + '&offset=' + (offset || 0), {muteHttpExceptions: true, followRedirects: true});
  const code = resp.getResponseCode();
  if (code >= 300) {
    addLog('VK topic HTTP ' + code, 'WARN'); return {images: [], texts: [], hasMore: false, nextOffset: offset || 0};
  }
  const data = JSON.parse(resp.getContentText());
  let texts = (data && data.texts) || [];
  texts = texts.map(function(t) {
    return String(t||'').trim();
  }).filter(function(t) {
    return !!t;
  }).slice(0, take);
  const hasMore = !!(data && data.hasMore);
  const nextOffset = (data && data.nextOffset != null) ? data.nextOffset : ((offset || 0) + texts.length);
  return {images: [], texts: texts, hasMore: hasMore, nextOffset: nextOffset};
}

function collectVkReviews_(reviewsUrl, offset, limit) {
  const base = getVkWebAppUrl_();
  const take = Math.max(0, limit || OCR_BATCH_LIMIT);
  const resp = UrlFetchApp.fetch(base + '?action=parseReviews&url=' + encodeURIComponent(reviewsUrl) + '&limit=' + take + '&offset=' + (offset || 0), {muteHttpExceptions: true, followRedirects: true});
  const code = resp.getResponseCode();
  if (code >= 300) {
    addLog('VK reviews HTTP ' + code, 'WARN'); return {images: [], texts: [], hasMore: false, nextOffset: offset || 0};
  }
  const data = JSON.parse(resp.getContentText());
  let texts = (data && data.texts) || [];
  texts = texts.map(function(t) {
    return String(t||'').trim();
  }).filter(function(t) {
    return !!t;
  }).slice(0, take);
  const hasMore = !!(data && data.hasMore);
  const nextOffset = (data && data.nextOffset != null) ? data.nextOffset : ((offset || 0) + texts.length);
  return {images: [], texts: texts, hasMore: hasMore, nextOffset: nextOffset};
}
