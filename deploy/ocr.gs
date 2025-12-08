/**
 * table_ai OCR microservice
 *
 * Этот скрипт развёртывается отдельно от клиента и сервера.
 * Сервер вызывает его через Web App (doPost → serverOcrProcess_).
 * Вся тяжёлая работа по извлечению ссылок, загрузке изображений и
 * распознаванию текста выполняется здесь.
 */
/* eslint-disable no-var, prefer-const, block-spacing, brace-style, quotes, max-len */

var GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
var DEFAULT_VK_PARSER_URL = 'https://script.google.com/macros/s/AKfycbzttbqz16EmmcXbEYCuYhNlXkCxAnCG77phspFL1_rTCi4xVqoorByJAPa4dI4iwT8/exec';
var OCR_SECRET_PROPERTY = 'OCR_SHARED_SECRET';

var OCR2_BATCH_LIMIT = 50;
var OCR2_CHUNK_SIZE = 8;
var OCR_LOG_BUFFER = [];

var MAX_OCR_LOGS = 500;
var DEFAULT_SOURCE_COLUMN = 'A';
var DEFAULT_TARGET_COLUMN = 'B';
var DEFAULT_SHEET = 'Отзывы';

function doGet() {
  return json_({ok: true, service: 'table_ai_ocr', time: new Date().toISOString()});
}

function doPost(e) {
  resetOcrLogs_();
  try {
    var body = parseBody_(e);
    var action = String(body.action || '').toLowerCase();
    if (action !== 'server_ocr_process') {
      return json_({ok: false, error: 'UNKNOWN_ACTION'}, 400);
    }

    var incomingSecret = body.secret || (body.params && body.params.secret);
    if (!isSecretOk_(incomingSecret)) {
      return json_({ok: false, error: 'UNAUTHORIZED'}, 403);
    }

    var params = body.params || body.data || body;
    if (params && params.secret) {
      delete params.secret; // не передаем дальше
    }

    var result = serverOcrProcess_(params || {});
    return json_({ok: true, data: result.summary, logs: result.logs});
  } catch (err) {
    var message = String(err && err.message || err);
    log_('❌ doPost error: ' + message, 'ERROR');
    return json_({ok: false, error: message, logs: getOcrLogs_()}, 500);
  }
}

function serverOcrProcess_(params) {
  resetOcrLogs_();
  var started = Date.now();
  var cfg = buildOcrConfig_(params || {});
  var summary = {
    processed: 0,
    skipped: 0,
    empty: 0,
    errors: 0,
    limit: OCR2_BATCH_LIMIT,
    sheetName: cfg.sheetName,
    sourceColumn: cfg.sourceColumnLetter,
    targetColumn: cfg.targetColumnLetter,
    startRow: cfg.startRow,
  };

  log_('▶️ OCR-server start: sheet="' + cfg.sheetName + '", source=' + cfg.sourceColumnLetter + ', target=' + cfg.targetColumnLetter + ', overwrite=' + cfg.overwrite + ', perRowLimit=' + OCR2_BATCH_LIMIT, 'INFO');

  var ss = SpreadsheetApp.openById(cfg.spreadsheetId);
  var sh = ss.getSheetByName(cfg.sheetName);
  if (!sh) {
    throw new Error('SHEET_NOT_FOUND');
  }

  var lastRow = Math.max(cfg.startRow, sh.getLastRow());
  var inspected = 0;

  for (var r = cfg.startRow; r <= lastRow; r++) {
    if (cfg.maxRows && inspected >= cfg.maxRows) {
      log_('⏹️ Достигнут лимит строк (' + cfg.maxRows + '), останавливаемся', 'INFO');
      break;
    }
    inspected++;

    try {
      var rangeA = sh.getRange(r, cfg.sourceColumnIndex);
      var textVal = String(rangeA.getDisplayValue() || '').trim();
      var formula = String(rangeA.getFormula() || '');
      var richUrl = '';
      try {
        var rich = rangeA.getRichTextValue();
        richUrl = firstLinkFromRichV2_(rich);
      } catch (_) {}

      log_('V2 row ' + r + ': A-text="' + textVal.slice(0, 120) + '" richUrl="' + richUrl + '" formula="' + formula.slice(0, 120) + '"', 'DEBUG');

      if (!textVal && !formula && !richUrl) {
        summary.empty++;
        continue;
      }

      var targetValue = String(sh.getRange(r, cfg.targetColumnIndex).getDisplayValue() || '').trim();
      if (!cfg.overwrite && targetValue) {
        summary.skipped++;
        continue;
      }

      var sources = extractSourcesV2_(textVal, formula, richUrl);
      log_('V2 row ' + r + ': sources=' + (sources.map(function(s) { return s.kind + ':' + (s.id || s.url || ''); }).join(' | ') || 'none'), 'DEBUG');
      if (!sources.length) {
        log_('⚠️ V2: нет источников в ' + cfg.sourceColumnLetter + r, 'WARN');
        summary.empty++;
        continue;
      }

      var writeRow = targetValue ? findNextWriteRowV2_(sh, r, cfg.sourceColumnIndex, cfg.targetColumnIndex) : r;
      var remainingCap = OCR2_BATCH_LIMIT;
      var batchImages = [];
      var texts = [];

      for (var i = 0; i < sources.length && remainingCap > 0; i++) {
        var src = sources[i];
        log_('V2 row ' + r + ': collect kind=' + src.kind + ' key=' + (src.id || src.url || '') + ' cap=' + remainingCap, 'DEBUG');
        try {
          var part = collectFromSourceV2_(src, remainingCap);
          var addedText = 0;
          if (part.texts && part.texts.length) {
            texts = texts.concat(part.texts);
            addedText = part.texts.length;
          }
          remainingCap = Math.max(0, remainingCap - addedText);
          if (part.images && part.images.length) {
            var imageRoom = Math.max(0, OCR2_BATCH_LIMIT - texts.length - batchImages.length);
            if (imageRoom > 0) {
              var toTake = Math.min(imageRoom, part.images.length);
              batchImages = batchImages.concat(part.images.slice(0, toTake));
            }
          }
        } catch (collectErr) {
          summary.errors++;
          log_('❌ V2 collect error row ' + r + ': ' + collectErr.message, 'ERROR');
        }
      }

      if (!texts.length && !batchImages.length) {
        log_('V2 row ' + r + ': nothing collected', 'DEBUG');
        summary.empty++;
        continue;
      }

      var remainingOut = Math.max(0, OCR2_BATCH_LIMIT - texts.length);
      if (batchImages.length && remainingOut > 0) {
        try {
          var imgs = batchImages.slice(0, remainingOut);
          for (var p = 0; p < imgs.length && remainingOut > 0; p += OCR2_CHUNK_SIZE) {
            var sub = imgs.slice(p, Math.min(p + OCR2_CHUNK_SIZE, imgs.length));
            var out = serverGmOcrBatchV2_(sub, cfg.lang);
            var arr = splitBySeparatorV2_(out);
            if (!arr || !arr.length) {
              log_('V2 row ' + r + ': chunk ' + (p / OCR2_CHUNK_SIZE) + ' empty → fallback per-image (' + sub.length + ' imgs)', 'WARN');
              for (var si = 0; si < sub.length && remainingOut > 0; si++) {
                try {
                  var bb = Utilities.newBlob(Utilities.base64Decode(sub[si].data), sub[si].mimeType || 'image/png', 'img');
                  var tt = gmOcrFromBlobV2_(bb, cfg.lang);
                  tt = String(tt || '').trim();
                  if (tt) {
                    texts.push(tt);
                    remainingOut--;
                  }
                } catch (fallbackErr) {
                  log_('V2 row ' + r + ': per-image fallback error: ' + fallbackErr.message, 'ERROR');
                }
              }
            } else {
              var take = Math.min(remainingOut, arr.length);
              texts = texts.concat(arr.slice(0, take));
              remainingOut -= take;
              log_('V2 row ' + r + ': chunk size=' + sub.length + ' → got ' + arr.length + ' parts, taken=' + take + ', cap left=' + remainingOut, 'DEBUG');
            }
          }
        } catch (batchErr) {
          summary.errors++;
          log_('❌ V2 OCR batch error row ' + r + ': ' + batchErr.message, 'ERROR');
          try {
            for (var j = 0; j < Math.min(remainingOut, batchImages.length); j++) {
              var b = Utilities.newBlob(Utilities.base64Decode(batchImages[j].data), batchImages[j].mimeType || 'image/png', 'img');
              var t = gmOcrFromBlobV2_(b, cfg.lang);
              if (t && String(t).trim()) {
                texts.push(String(t).trim());
              }
            }
          } catch (batchFallbackErr) {
            log_('❌ V2 OCR fallback error row ' + r + ': ' + batchFallbackErr.message, 'ERROR');
          }
        }
      }

      if (!texts.length) {
        log_('V2 row ' + r + ': texts empty after OCR', 'DEBUG');
        summary.empty++;
        continue;
      }

      if (texts.length > 1) {
        sh.insertRowsAfter(writeRow, texts.length - 1);
        lastRow += (texts.length - 1);
      }
      var matrix = texts.map(function(x) { return [x]; });
      sh.getRange(writeRow, cfg.targetColumnIndex, texts.length, 1).setValues(matrix);
      if (texts.length > 1 && writeRow === r) {
        r += (texts.length - 1);
      }
      summary.processed++;
      log_('V2 row ' + r + ': wrote ' + texts.length + ' lines to ' + cfg.targetColumnLetter + writeRow, 'DEBUG');
      Utilities.sleep(120);
    } catch (rowErr) {
      summary.errors++;
      log_('❌ V2 row error ' + r + ': ' + rowErr.message, 'ERROR');
    }
  }

  summary.rowsVisited = inspected;
  summary.durationMs = Date.now() - started;
  log_('✅ OCR-server done: processed=' + summary.processed + ', skipped=' + summary.skipped + ', empty=' + summary.empty + ', errors=' + summary.errors, 'INFO');
  return {summary: summary, logs: getOcrLogs_()};
}

// ---------- Configuration helpers ----------
function buildOcrConfig_(params) {
  var spreadsheetId = String(params.spreadsheetId || '').trim();
  if (!spreadsheetId) {
    throw new Error('NO_SPREADSHEET_ID');
  }

  var sheetName = String(params.sheetName || DEFAULT_SHEET).trim();
  if (!sheetName) {
    sheetName = DEFAULT_SHEET;
  }

  var sourceColumnLetter = String(params.sourceColumn || DEFAULT_SOURCE_COLUMN).trim().toUpperCase();
  var targetColumnLetter = String(params.targetColumn || DEFAULT_TARGET_COLUMN).trim().toUpperCase();
  var sourceColumnIndex = columnLetterToIndex_(sourceColumnLetter);
  var targetColumnIndex = columnLetterToIndex_(targetColumnLetter);

  var overwrite = params.overwrite === true;
  var limit = params.limit != null ? parseInt(params.limit, 10) : OCR2_BATCH_LIMIT;
  if (isNaN(limit) || limit <= 0) {
    limit = OCR2_BATCH_LIMIT;
  }
  OCR2_BATCH_LIMIT = clamp_(limit, 1, 200);

  if (params.chunkSize != null) {
    var chunkSize = parseInt(params.chunkSize, 10);
    if (!isNaN(chunkSize) && chunkSize > 0) {
      OCR2_CHUNK_SIZE = clamp_(chunkSize, 1, 20);
    }
  }

  var startRow = params.startRow ? Math.max(2, parseInt(params.startRow, 10)) : 2;
  if (isNaN(startRow) || startRow < 2) {
    startRow = 2;
  }

  var maxRows = params.maxRows ? parseInt(params.maxRows, 10) : null;
  if (maxRows && maxRows < 0) {
    maxRows = null;
  }

  var lang = String(params.lang || 'ru').trim() || 'ru';

  return {
    spreadsheetId: spreadsheetId,
    sheetName: sheetName,
    sourceColumnLetter: sourceColumnLetter,
    targetColumnLetter: targetColumnLetter,
    sourceColumnIndex: sourceColumnIndex,
    targetColumnIndex: targetColumnIndex,
    overwrite: overwrite,
    startRow: startRow,
    maxRows: maxRows,
    lang: lang,
  };
}

// ---------- Logging helpers ----------
function log_(msg, level) {
  var entry = {
    timestamp: new Date().toISOString(),
    level: level || 'INFO',
    message: msg,
  };
  OCR_LOG_BUFFER.push(entry);
  if (OCR_LOG_BUFFER.length > MAX_OCR_LOGS) {
    OCR_LOG_BUFFER.shift();
  }
  try {
    Logger.log('[' + entry.level + '] ' + entry.message);
  } catch (_) {}
}

function resetOcrLogs_() {
  OCR_LOG_BUFFER = [];
}

function getOcrLogs_() {
  return OCR_LOG_BUFFER.slice();
}

function isSecretOk_(incoming) {
  try {
    var secret = PropertiesService.getScriptProperties().getProperty(OCR_SECRET_PROPERTY);
    if (!secret) {
      return true;
    }
    return String(incoming || '') === secret;
  } catch (_) {
    return false;
  }
}

// ---------- Helpers copied from прежнего клиента ----------
function findNextWriteRowV2_(sh, r, sourceCol, targetCol) {
  try {
    var last = Math.max(r, sh.getLastRow());
    var row = r;
    var b0 = String(sh.getRange(row, targetCol).getDisplayValue() || '').trim();
    if (!b0) {
      return row;
    }
    row++;
    while (row <= last) {
      var a = String(sh.getRange(row, sourceCol).getDisplayValue() || '').trim();
      var b = String(sh.getRange(row, targetCol).getDisplayValue() || '').trim();
      if (a) {
        break;
      }
      if (b) {
        row++;
      } else {
        break;
      }
    }
    return row;
  } catch (e) {
    log_('findNextWriteRowV2_ error: ' + e.message, 'WARN');
    return r;
  }
}

function columnLetterToIndex_(letters) {
  var s = String(letters || '').trim().toUpperCase();
  if (!s) {
    throw new Error('INVALID_COLUMN_LETTER');
  }
  var col = 0;
  for (var i = 0; i < s.length; i++) {
    var code = s.charCodeAt(i);
    if (code < 65 || code > 90) {
      throw new Error('INVALID_COLUMN_LETTER');
    }
    col = col * 26 + (code - 64);
  }
  return col;
}

function clamp_(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function firstLinkFromRichV2_(rich) {
  try {
    if (!rich) return '';
    var idxs = rich.getTextStyleIndices();
    if (idxs && idxs.length) {
      for (var i = 0; i < idxs.length; i++) {
        var st = rich.getTextStyle(idxs[i]);
        var lu = st && st.getLinkUrl && st.getLinkUrl();
        if (lu) return String(lu).trim();
      }
    }
    var lu2 = rich.getLinkUrl && rich.getLinkUrl();
    if (lu2) return String(lu2).trim();
    var ts = rich.getTextStyle && rich.getTextStyle();
    var lu3 = ts && ts.getLinkUrl && ts.getLinkUrl();
    if (lu3) return String(lu3).trim();
  } catch (e) {}
  return '';
}

function extractSourcesV2_(textVal, formula, richUrl) {
  var list = [];
  function push(u) {
    if (!u) return;
    var n = normalizeUrlV2_(u);
    if (!n) return;
    list.push(classifyV2_(n));
  }

  if (richUrl) push(richUrl);

  if (formula) {
    var f = String(formula).trim();
    var mImg = f.match(/^=\s*(?:IMAGE|ИЗОБРАЖЕНИЕ)\s*\(\s*(["'])([^"']+)\1/i);
    if (mImg) push(mImg[2]);
    var mHyp = f.match(/^=\s*(?:HYPERLINK|ГИПЕРССЫЛКА)\s*\(\s*(["'])([^"']+)\1/i);
    if (mHyp) push(mHyp[2]);
  }

  try {
    var cleaned = cleanTextForUrlsV2_(String(textVal || ''));
    (cleaned.match(/https?:\/\/[\S]+/g) || []).forEach(function(s) {
      push(s.replace(/[),.;]+$/, ''));
    });
    (cleaned.match(/(?:^|\s)(?:vk\.com|drive\.google\.com|docs\.google\.com|yadi\.sk|disk\.yandex\.(?:ru|com)|dropbox\.com|script\.google\.com|script\.googleusercontent\.com)\/[\S]+/gi) || [])
      .forEach(function(s) { push(String(s).trim()); });
  } catch (e) {
    log_('V2 extract: text scan error: ' + e.message, 'WARN');
  }

  var seen = {};
  list = list.filter(function(s) {
    var k = s.kind + ':' + (s.url || s.id);
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });
  return list;
}

function normalizeUrlV2_(u) {
  try {
    var s = String(u || '').trim();
    if (!s) return '';
    s = cleanTextForUrlsV2_(s);
    s = s.replace(/^<+|>+$/g, '');
    if (/^https?:\/\//i.test(s)) return s;
    if (/^www\./i.test(s)) return 'https://' + s;
    if (/^(vk\.com|drive\.google\.com|yadi\.sk|disk\.yandex\.(?:ru|com)|dropbox\.com|script\.google\.com|script\.googleusercontent\.com)\//i.test(s)) return 'https://' + s;
    return s;
  } catch (e) {
    return String(u || '');
  }
}

function classifyV2_(u) {
  if (/vk\.com\/reviews-\d+/i.test(u)) return {kind: 'vk-reviews', url: u};
  if (/vk\.com\/album-?\d+_\d+/i.test(u)) return {kind: 'vk-album', url: u};
  if (/vk\.com\/topic-?\d+_\d+/i.test(u)) return {kind: 'vk-topic', url: u};
  if (/script\.google(?:usercontent)?\.com\//i.test(u)) {
    var act = getParamV2_(u, 'action');
    var inner = getParamV2_(u, 'url');
    if (act && inner) {
      var innerUrl = decodeURIComponent(inner);
      if (/^parseAlbum$/i.test(act)) return {kind: 'vk-album', url: innerUrl};
      if (/^parseDiscussion$/i.test(act)) return {kind: 'vk-topic', url: innerUrl};
      if (/^parseReviews$/i.test(act)) return {kind: 'vk-reviews', url: innerUrl};
    }
    return {kind: 'vk-webjson', url: u};
  }
  var gd = detectDriveLinkV2_(u);
  if (gd && gd.type === 'folder') return {kind: 'drive-folder', id: gd.id};
  if (gd && gd.type === 'file') return {kind: 'drive-file', id: gd.id};
  if (/yadi\.sk\//i.test(u) || /disk\.yandex\.(ru|com)\//i.test(u)) return {kind: 'yadisk', url: u};
  if (/dropbox\.com\//i.test(u)) return {kind: 'dropbox-file', url: u};
  return {kind: 'url', url: u};
}

function getParamV2_(url, name) {
  try {
    var re = new RegExp('[?&]' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^&#]*)', 'i');
    var m = String(url).match(re);
    return m ? m[1] : '';
  } catch (e) {
    return '';
  }
}

function detectDriveLinkV2_(url) {
  try {
    var u = String(url || '');
    var m1 = u.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
    if (m1) return {type: 'folder', id: m1[1]};
    var m2 = u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m2) return {type: 'file', id: m2[1]};
    var m3 = u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m3) return {type: 'file', id: m3[1]};
    if (/docs\.google\.com\//i.test(u)) {
      var md = u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (md) return {type: 'file', id: md[1]};
    }
    return null;
  } catch (e) {
    return null;
  }
}

function collectFromSourceV2_(src, cap) {
  if (src.kind === 'vk-webjson') return collectVkWebJsonV2_(src.url, cap);
  if (src.kind === 'vk-album') return collectVkAlbumViaWebV2_(src.url, 0, cap);
  if (src.kind === 'vk-topic') return collectVkDiscussionViaWebV2_(src.url, 0, cap);
  if (src.kind === 'vk-reviews') return collectVkReviewsViaWebV2_(src.url, 0, cap);
  if (src.kind === 'drive-folder') return enumerateDriveFolderImagesV2_(src.id, 0, cap);
  if (src.kind === 'drive-file') {
    try {
      var file = DriveApp.getFileById(src.id);
      var blob = file.getBlob();
      var mt = String(blob.getContentType() || '').toLowerCase();
      if (mt.indexOf('image/') !== 0) {
        log_('V2 drive-file not image, contentType=' + mt, 'WARN');
        return {images: [], texts: [], hasMore: false, nextOffset: 1};
      }
      return {images: [{mimeType: blob.getContentType() || 'image/png', data: Utilities.base64Encode(blob.getBytes())}], texts: [], hasMore: false, nextOffset: 1};
    } catch (e) {
      throw new Error('Drive file error: ' + e.message);
    }
  }
  if (src.kind === 'yadisk') return collectYandexPublicV2_(src.url, 0, cap);
  if (src.kind === 'dropbox-file') {
    var dl = toDropboxDirectV2_(src.url);
    var resp = UrlFetchApp.fetch(dl, {muteHttpExceptions: true, followRedirects: true});
    if (resp.getResponseCode() >= 300) throw new Error('Dropbox HTTP ' + resp.getResponseCode());
    var bb = resp.getBlob();
    return {images: [{mimeType: bb.getContentType() || 'image/png', data: Utilities.base64Encode(bb.getBytes())}], texts: [], hasMore: false, nextOffset: 1};
  }
  if (src.kind === 'url') {
    var bl = fetchImageToBlobWithHeadersV2_(src.url);
    if (!bl) throw new Error('HTTP_FETCH_FAILED');
    var mtUrl = String(bl.getContentType() || '').toLowerCase();
    if (mtUrl.indexOf('image/') !== 0) {
      log_('V2 url not image, contentType=' + mtUrl + ' url=' + src.url.slice(0, 80), 'DEBUG');
      return {images: [], texts: [], hasMore: false, nextOffset: 0};
    }
    return {images: [{mimeType: bl.getContentType() || 'image/png', data: Utilities.base64Encode(bl.getBytes())}], texts: [], hasMore: false, nextOffset: 1};
  }
  return {images: [], texts: [], hasMore: false, nextOffset: 0};
}

function collectVkWebJsonV2_(url, cap) {
  var resp = UrlFetchApp.fetch(url, {muteHttpExceptions: true, followRedirects: true});
  var code = resp.getResponseCode();
  if (code >= 300) throw new Error('VK webjson HTTP ' + code);
  var data = null;
  try {
    data = JSON.parse(resp.getContentText());
  } catch (e) {
    throw new Error('VK webjson parse');
  }
  var images = [];
  var texts = [];
  if (data && data.images && data.images.length) {
    for (var i = 0; i < data.images.length && images.length < cap; i++) {
      try {
        var u = data.images[i].url || data.images[i];
        var b = fetchImageToBlobWithHeadersV2_(u);
        if (!b) {
          log_('V2 VK webjson image fetch failed for url=' + String(u).slice(0, 160), 'WARN');
          continue;
        }
        var mt = String(b.getContentType() || '').toLowerCase();
        if (mt.indexOf('image/') !== 0) {
          log_('V2 VK webjson non-image contentType=' + mt, 'WARN');
          continue;
        }
        images.push({mimeType: b.getContentType() || 'image/jpeg', data: Utilities.base64Encode(b.getBytes())});
      } catch (_) {}
    }
  }
  if (data && data.texts && data.texts.length) {
    texts = data.texts.map(function(t) { return String(t || '').trim(); }).filter(Boolean).slice(0, cap);
  }
  return {images: images, texts: texts, hasMore: false, nextOffset: 0};
}

function getVkParserBaseV2_() {
  try {
    var propUrl = PropertiesService.getScriptProperties().getProperty('VK_PARSER_URL');
    if (propUrl) return String(propUrl).replace(/\/$/, '');
  } catch (_) {}
  try {
    if (typeof VK_PARSER_URL !== 'undefined' && VK_PARSER_URL) return String(VK_PARSER_URL).replace(/\/$/, '');
  } catch (_) {}
  if (DEFAULT_VK_PARSER_URL) return String(DEFAULT_VK_PARSER_URL).replace(/\/$/, '');
  throw new Error('Не задан VK_PARSER_URL');
}

function collectVkAlbumViaWebV2_(albumUrl, offset, limit) {
  var base = getVkParserBaseV2_();
  var take = Math.max(1, Math.min(OCR2_BATCH_LIMIT, limit || OCR2_BATCH_LIMIT));
  var req = base + '?action=parseAlbum&url=' + encodeURIComponent(albumUrl) + '&limit=' + take + '&offset=' + (offset || 0);
  log_('V2 VK album request: ' + req, 'DEBUG');
  var resp = UrlFetchApp.fetch(req, {muteHttpExceptions: true, followRedirects: true});
  var code = resp.getResponseCode();
  if (code >= 300) throw new Error('VK album HTTP ' + code);
  var data = JSON.parse(resp.getContentText());
  var imgs = [];
  if (data && data.images && data.images.length) {
    for (var i = 0; i < data.images.length && imgs.length < take; i++) {
      try {
        var u = data.images[i].url || data.images[i];
        if (i < 3) log_('V2 VK album image[' + i + '] url=' + String(u).slice(0, 200), 'DEBUG');
        var b = fetchImageToBlobWithHeadersV2_(u);
        if (!b) {
          log_('V2 VK album image fetch failed for url=' + String(u).slice(0, 200), 'WARN');
          continue;
        }
        var mt = String(b.getContentType() || '').toLowerCase();
        if (mt.indexOf('image/') !== 0) {
          log_('V2 VK album non-image contentType=' + mt, 'WARN');
          continue;
        }
        imgs.push({mimeType: b.getContentType() || 'image/jpeg', data: Utilities.base64Encode(b.getBytes())});
      } catch (ei) {
        log_('V2 VK album image error: ' + ei.message, 'WARN');
      }
    }
  } else {
    log_('V2 VK album: 0 images from web-app for url=' + albumUrl, 'WARN');
  }
  return {images: imgs, texts: [], hasMore: !!(data && data.hasMore), nextOffset: (data && data.nextOffset != null) ? data.nextOffset : 0};
}

function collectVkDiscussionViaWebV2_(topicUrl, offset, limit) {
  var base = getVkParserBaseV2_();
  var take = Math.max(1, Math.min(OCR2_BATCH_LIMIT, limit || OCR2_BATCH_LIMIT));
  var req = base + '?action=parseDiscussion&url=' + encodeURIComponent(topicUrl) + '&limit=' + take + '&offset=' + (offset || 0);
  log_('V2 VK topic request: ' + req, 'DEBUG');
  var resp = UrlFetchApp.fetch(req, {muteHttpExceptions: true, followRedirects: true});
  var code = resp.getResponseCode();
  if (code >= 300) throw new Error('VK topic HTTP ' + code);
  var data = JSON.parse(resp.getContentText());
  var texts = (data && data.texts) || [];
  texts = texts.map(function(t) { return String(t || '').trim(); }).filter(Boolean).slice(0, take);
  if (!texts.length) log_('V2 VK topic: 0 texts from web-app for url=' + topicUrl, 'WARN');
  return {images: [], texts: texts, hasMore: !!(data && data.hasMore), nextOffset: (data && data.nextOffset != null) ? data.nextOffset : 0};
}

function collectVkReviewsViaWebV2_(reviewsUrl, offset, limit) {
  var base = getVkParserBaseV2_();
  var take = Math.max(1, Math.min(OCR2_BATCH_LIMIT, limit || OCR2_BATCH_LIMIT));
  var req = base + '?action=parseReviews&url=' + encodeURIComponent(reviewsUrl) + '&limit=' + take + '&offset=' + (offset || 0);
  log_('V2 VK reviews request: ' + req, 'DEBUG');
  var resp = UrlFetchApp.fetch(req, {muteHttpExceptions: true, followRedirects: true});
  var code = resp.getResponseCode();
  if (code >= 300) throw new Error('VK reviews HTTP ' + code);
  var data = JSON.parse(resp.getContentText());
  var texts = (data && data.texts) || [];
  texts = texts.map(function(t) { return String(t || '').trim(); }).filter(Boolean).slice(0, take);
  if (!texts.length) log_('V2 VK reviews: 0 texts from web-app for url=' + reviewsUrl, 'WARN');
  return {images: [], texts: texts, hasMore: !!(data && data.hasMore), nextOffset: (data && data.nextOffset != null) ? data.nextOffset : 0};
}

function enumerateDriveFolderImagesV2_(folderId, offset, limit) {
  var folder = DriveApp.getFolderById(folderId);
  var it = folder.getFiles();
  var images = [];
  var imgIndex = 0;
  while (it.hasNext()) {
    var f = it.next();
    var mt = String(f.getMimeType() || '').toLowerCase();
    if (mt.indexOf('image/') !== 0) continue;
    if (imgIndex < (offset || 0)) {
      imgIndex++;
      continue;
    }
    var blob = f.getBlob();
    images.push({mimeType: blob.getContentType() || 'image/png', data: Utilities.base64Encode(blob.getBytes())});
    imgIndex++;
    if (images.length >= limit) break;
  }
  var hasMore = it.hasNext();
  var nextOffset = (offset || 0) + images.length;
  log_('V2 Drive folder: collected ' + images.length + ' images (offset=' + (offset || 0) + ', limit=' + limit + ')', 'DEBUG');
  return {images: images, texts: [], hasMore: hasMore, nextOffset: nextOffset};
}

function collectYandexPublicV2_(publicUrl, offset, limit) {
  var base = 'https://cloud-api.yandex.net/v1/disk/public/resources';
  var download = 'https://cloud-api.yandex.net/v1/disk/public/resources/download';
  var images = [];
  try {
    var res = UrlFetchApp.fetch(base + '?public_key=' + encodeURIComponent(publicUrl), {muteHttpExceptions: true, followRedirects: true});
    var code = res.getResponseCode();
    var data = JSON.parse(res.getContentText());
    if (code >= 300) throw new Error('Yandex meta HTTP ' + code);
    if (data && data.type === 'file') {
      if (offset && offset > 0) return {images: [], texts: [], hasMore: false, nextOffset: offset};
      var dl = UrlFetchApp.fetch(download + '?public_key=' + encodeURIComponent(publicUrl)).getContentText();
      var link = JSON.parse(dl).href;
      var f = UrlFetchApp.fetch(link, {muteHttpExceptions: true, followRedirects: true});
      var blob = f.getBlob();
      images.push({mimeType: blob.getContentType() || 'image/png', data: Utilities.base64Encode(blob.getBytes())});
      return {images: images, texts: [], hasMore: false, nextOffset: 1};
    }
    if (data && data.type === 'dir') {
      var pageOffset = 0;
      var imgSeen = 0;
      var take = Math.max(0, limit || OCR2_BATCH_LIMIT);
      while (images.length < take) {
        var meta = UrlFetchApp.fetch(base + '?public_key=' + encodeURIComponent(publicUrl) + '&limit=200&offset=' + pageOffset, {muteHttpExceptions: true, followRedirects: true});
        var md = JSON.parse(meta.getContentText());
        var items = (md && md._embedded && md._embedded.items) || [];
        if (!items.length) break;
        for (var i = 0; i < items.length && images.length < take; i++) {
          var itItem = items[i];
          if (itItem.type !== 'file') continue;
          var mime = String(itItem.mime_type || '').toLowerCase();
          if (mime.indexOf('image/') !== 0) continue;
          if (imgSeen < (offset || 0)) {
            imgSeen++;
            continue;
          }
          var dl2 = UrlFetchApp.fetch(download + '?public_key=' + encodeURIComponent(publicUrl) + '&path=' + encodeURIComponent(itItem.path)).getContentText();
          var link2 = JSON.parse(dl2).href;
          var f2 = UrlFetchApp.fetch(link2, {muteHttpExceptions: true, followRedirects: true});
          var blob2 = f2.getBlob();
          images.push({mimeType: blob2.getContentType() || 'image/png', data: Utilities.base64Encode(blob2.getBytes())});
          imgSeen++;
        }
        pageOffset += items.length;
        if (items.length < 200) break;
      }
      var hasMore = images.length >= take;
      var nextOffset = (offset || 0) + images.length;
      return {images: images, texts: [], hasMore: hasMore, nextOffset: nextOffset};
    }
  } catch (e) {
    log_('⚠️ Yandex error: ' + e.message, 'WARN');
  }
  return {images: images, texts: [], hasMore: false, nextOffset: (offset || 0) + images.length};
}

function toDropboxDirectV2_(u) {
  try {
    var url = u.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    if (url.indexOf('?dl=0') >= 0) url = url.replace('?dl=0', '?dl=1');
    if (url.indexOf('?dl=1') < 0 && url.indexOf('?') < 0) url += '?dl=1';
    return url;
  } catch (e) {
    return u;
  }
}

function gmOcrFromBlobV2_(blob, lang) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Не задан GEMINI_API_KEY');
  var mime = blob.getContentType() || 'image/png';
  var b64 = Utilities.base64Encode(blob.getBytes());
  var instruction = 'Транскрибируй текст на изображении БЕЗ добавления от себя. Верни только чистый текст. Если изображений несколько — разделяй отзывы строкой из четырёх подчёркиваний: ____ .' + (lang ? (' Язык: ' + lang + '.') : '');
  var body = {contents: [{parts: [{text: instruction}, {inlineData: {mimeType: mime, data: b64}}]}], generationConfig: {maxOutputTokens: 2048, temperature: 0}};
  var resp = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, {method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true});
  var code = resp.getResponseCode();
  var data = JSON.parse(resp.getContentText());
  if (code !== 200) {
    var msg = (data && data.error && data.error.message) || ('HTTP_' + code);
    throw new Error('Gemini OCR: ' + msg);
  }
  var cand = data.candidates && data.candidates[0];
  var part = cand && cand.content && cand.content.parts && cand.content.parts[0];
  var text = part && part.text ? part.text : '';
  return processGeminiResponse(text);
}

function serverGmOcrBatchV2_(images, lang) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Не задан GEMINI_API_KEY');
  if (!Array.isArray(images) || !images.length) throw new Error('NO_IMAGES');

  var delimiter = '____';
  var instruction = 'Транскрибируй текст на каждом изображении БЕЗ добавления от себя. Верни только чистый текст. Если изображений несколько — разделяй отзывы строкой: ' + delimiter + '.' + (lang ? (' Язык: ' + lang + '.') : '');
  var parts = [{text: instruction}];
  for (var i = 0; i < images.length; i++) {
    var it = images[i] || {};
    var mt = String(it.mimeType || 'image/png');
    var dt = String(it.data || '');
    if (!dt) continue;
    parts.push({inlineData: {mimeType: mt, data: dt}});
  }
  if (parts.length <= 1) throw new Error('NO_VALID_IMAGES');

  var body = {contents: [{parts: parts}], generationConfig: {maxOutputTokens: 4096, temperature: 0}};
  var resp = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, {method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true});
  var code = resp.getResponseCode();
  var data = JSON.parse(resp.getContentText());
  if (code !== 200) {
    var msg = (data && data.error && data.error.message) || ('HTTP_' + code);
    throw new Error('Gemini OCR: ' + msg);
  }
  var candidate = data.candidates && data.candidates[0];
  var content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
  var text = content && content.text ? content.text : '';
  return processGeminiResponse(text);
}

function splitBySeparatorV2_(text) {
  var s = String(text || '').trim();
  if (!s) return [];
  var parts = s.split(/\n?_{4,}\n?/g).map(function(x) { return String(x || '').trim(); }).filter(Boolean);
  if (parts.length > 1) return parts;
  var parts2 = s.split(/\n{2,}/g).map(function(x) { return String(x || '').trim(); }).filter(Boolean);
  return parts2.length > 1 ? parts2 : [s];
}

function cleanTextForUrlsV2_(s) {
  try {
    var t = String(s || '');
    t = t.replace(/<[^>]*>/g, ' ');
    t = t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    return t;
  } catch (e) {
    return String(s || '');
  }
}

function fetchImageToBlobWithHeadersV2_(url) {
  try {
    var opts = {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Referer': 'https://vk.com/',
      },
    };
    var res = UrlFetchApp.fetch(url, opts);
    var code = res.getResponseCode();
    if (code >= 300) return null;
    return res.getBlob();
  } catch (e) {
    return null;
  }
}

// ---------- Markdown helpers (копия из Main.gs, но без addLog) ----------
function processGeminiResponse(response) {
  if (!response) return response;
  if (isMarkdownText(response)) {
    return convertMarkdownToReadableText(response);
  }
  return response;
}

function convertMarkdownToReadableText(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') return markdownText;
  var text = markdownText;
  try {
    text = text.replace(/```[\w]*\n?([\s\S]*?)\n?```/g, function(_m, code) {
      return '\n' + String(code || '').trim() + '\n';
    });
    text = text.replace(/`([^`]+)`/g, '$1');
    text = text.replace(/\*\*([^*]+)\*\*/g, function(_m, c) { return String(c || '').toUpperCase(); });
    text = text.replace(/\*([^*]+)\*/g, '$1');
    text = text.replace(/^#{1,6}\s+(.+)$/gm, function(_m, h) { return '\n' + String(h || '').toUpperCase() + ':\n'; });
    var lines = text.split('\n');
    var inList = false;
    var listCounter = 0;
    lines = lines.map(function(line) {
      var t = line.trim();
      if (/^[-*+]\s+/.test(t)) {
        if (!inList) {
          listCounter = 0;
          inList = true;
        }
        listCounter++;
        return line.replace(/^(\s*)[-*+]\s+/, '$1' + listCounter + '. ');
      } else if (t === '') {
        inList = false;
        return line;
      }
      inList = false;
      return line;
    });
    text = lines.join('\n');
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    return text;
  } catch (e) {
    return markdownText;
  }
}

function isMarkdownText(text) {
  if (!text || typeof text !== 'string') return false;
  var patterns = [
    /\*\*[^*]+\*\*/, /\*[^*]+\*/, /^#{1,6}\s+/m,
    /^[-*+]\s+/m, /\[.+\]\(.+\)/, /```[\s\S]*?```/, /`[^`]+`/,
  ];
  return patterns.some(function(p) { return p.test(text); });
}

// ---------- JSON helpers ----------
function parseBody_(e) {
  try {
    var raw = e && e.postData && e.postData.contents;
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

function json_(obj, status) {
  var out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  if (status && out.setResponseCode) out.setResponseCode(status);
  return out;
}
