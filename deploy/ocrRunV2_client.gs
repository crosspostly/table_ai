// Standalone OCR runner (do not touch review.gs)
// Exported function to assign on a drawing button: ocrRun
/* eslint-disable max-len */

const OCR2_BATCH_LIMIT = 50;
const OCR2_CHUNK_SIZE = 8; // разовая порция картинок на один запрос к модели (уменьшает риск усечения ответа)

// eslint-disable-next-line no-unused-vars
function ocrRun() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('Отзывы');
  if (!sh) {
    ui.alert('Лист "Отзывы" не найден'); return;
  }

  let lastRow = Math.max(2, sh.getLastRow());
  let processed = 0; let empty = 0; let errors = 0; let skipped = 0;
  const overwrite = (typeof getOcrOverwrite_ === 'function') ? getOcrOverwrite_() : false;
  log_('▶️ V2 start: rows=' + lastRow + ', overwrite=' + overwrite + ', limit=' + OCR2_BATCH_LIMIT, 'INFO');

  for (let r = 2; r <= lastRow; r++) {
    try {
      const rangeA = sh.getRange(r, 1);
      const textVal = String(rangeA.getDisplayValue() || '').trim();
      const formula = String(rangeA.getFormula() || '');
      let rich = null; let richUrl = '';
      try {
        rich = rangeA.getRichTextValue(); richUrl = firstLinkFromRichV2_(rich);
      } catch (_) {}
      log_('V2 row ' + r + ': A-text="' + String(textVal).slice(0, 120) + '" richUrl="' + richUrl + '" formula="' + String(formula).slice(0, 120) + '"', 'DEBUG');

      if (!textVal && !formula && !richUrl) {
        empty++; continue;
      }

      const bVal = String(sh.getRange(r, 2).getDisplayValue() || '').trim();
      if (!overwrite && bVal) {
        skipped++; continue;
      }

      const sources = extractSourcesV2_(textVal, formula, richUrl);
      log_('V2 row ' + r + ': sources=' + (sources.map(function(s) {
        return s.kind+':' + (s.id||s.url||'');
      }).join(' | ') || 'none'), 'DEBUG');
      if (!sources.length) {
        log_('⚠️ V2: нет источников в A' + r, 'WARN'); empty++; continue;
      }

      const writeRow = bVal ? findNextWriteRowV2_(sh, r) : r;
      let remainingCap = OCR2_BATCH_LIMIT;
      let batchImages = [];
      let texts = [];

      for (let i = 0; i < sources.length && remainingCap > 0; i++) {
        const src = sources[i];
        log_('V2 row ' + r + ': collect kind=' + src.kind + ' key=' + (src.id||src.url||'') + ' cap=' + remainingCap, 'DEBUG');
        try {
          const part = collectFromSourceV2_(src, remainingCap);
          let addedText = 0;
          if (part.texts && part.texts.length) {
            texts = texts.concat(part.texts); addedText = part.texts.length;
          }
          remainingCap = Math.max(0, remainingCap - addedText);
          if (part.images && part.images.length) {
            const imageRoom = Math.max(0, OCR2_BATCH_LIMIT - texts.length - batchImages.length);
            if (imageRoom > 0) {
              const toTake = Math.min(imageRoom, part.images.length);
              batchImages = batchImages.concat(part.images.slice(0, toTake));
            }
          }
        } catch (e) {
          errors++; log_('❌ V2 collect error row ' + r + ': ' + e.message, 'ERROR');
        }
      }

      if (!texts.length && !batchImages.length) {
        log_('V2 row ' + r + ': nothing collected', 'DEBUG'); empty++; continue;
      }

      let remainingOut = Math.max(0, OCR2_BATCH_LIMIT - texts.length);
      if (batchImages.length && remainingOut > 0) {
        try {
          const imgs = batchImages.slice(0, remainingOut);
          for (let p = 0; p < imgs.length && remainingOut > 0; p += OCR2_CHUNK_SIZE) {
            const sub = imgs.slice(p, Math.min(p + OCR2_CHUNK_SIZE, imgs.length));
            const out = serverGmOcrBatchV2_(sub, 'ru');
            const arr = splitBySeparatorV2_(out);
            if (!arr || !arr.length) {
              // хард-фоллбек: по одному в чанке
              log_('V2 row ' + r + ': chunk ' + (p/OCR2_CHUNK_SIZE) + ' empty → fallback per-image (' + sub.length + ' imgs)', 'WARN');
              for (let si = 0; si < sub.length && remainingOut > 0; si++) {
                try {
                  const bb = Utilities.newBlob(Utilities.base64Decode(sub[si].data), sub[si].mimeType || 'image/png', 'img');
                  let tt = gmOcrFromBlobV2_(bb, 'ru');
                  tt = String(tt||'').trim();
                  if (tt) {
                    texts.push(tt); remainingOut--;
                  }
                } catch (e4) {
                  log_('V2 row ' + r + ': per-image fallback error: ' + e4.message, 'ERROR');
                }
              }
            } else {
              const take = Math.min(remainingOut, arr.length);
              texts = texts.concat(arr.slice(0, take));
              remainingOut -= take;
              log_('V2 row ' + r + ': chunk size=' + sub.length + ' → got ' + arr.length + ' parts, taken=' + take + ', cap left=' + remainingOut, 'DEBUG');
            }
          }
        } catch (e2) {
          errors++; log_('❌ V2 OCR batch error row ' + r + ': ' + e2.message, 'ERROR');
          // fallback по одному
          try {
            for (let j = 0; j < Math.min(remainingOut, batchImages.length); j++) {
              const b = Utilities.newBlob(Utilities.base64Decode(batchImages[j].data), batchImages[j].mimeType || 'image/png', 'img');
              const t = gmOcrFromBlobV2_(b, 'ru');
              if (t && String(t).trim()) texts.push(String(t).trim());
            }
          } catch (e3) {
            log_('❌ V2 OCR fallback error row ' + r + ': ' + e3.message, 'ERROR');
          }
        }
      }

      if (!texts.length) {
        log_('V2 row ' + r + ': texts empty after OCR', 'DEBUG'); empty++; continue;
      }

      if (texts.length > 1) {
        sh.insertRowsAfter(writeRow, texts.length - 1); lastRow += (texts.length - 1);
      }
      const matrix = texts.map(function(x) {
        return [x];
      });
      sh.getRange(writeRow, 2, texts.length, 1).setValues(matrix);
      if (texts.length > 1 && writeRow === r) {
        r += (texts.length - 1);
      }
      processed++;
      log_('V2 row ' + r + ': wrote ' + texts.length + ' lines to B, next start row calc ok', 'DEBUG');
      Utilities.sleep(120);
    } catch (e) {
      errors++; log_('❌ V2 row error ' + r + ': ' + e.message, 'ERROR');
    }
  }

  ui.alert('OCR V2 завершён', 'Строк обработано: ' + processed + '\nПропущено (B уже заполнено): ' + skipped + '\nПустых: ' + empty + '\nОшибок: ' + errors + '\n\nЛимит: ' + OCR2_BATCH_LIMIT + ' за запуск.', ui.ButtonSet.OK);
}

// ---------- Helpers ----------
function log_(msg, level) {
  try {
    if (typeof addLog === 'function') addLog(msg, level || 'INFO'); else console.log((level||'INFO')+': '+msg);
  } catch (_) {}
}

function findNextWriteRowV2_(sh, r) {
  try {
    const last = Math.max(r, sh.getLastRow());
    let row = r;
    const b0 = String(sh.getRange(row, 2).getDisplayValue() || '').trim();
    if (!b0) return row; row++;
    while (row <= last) {
      const a = String(sh.getRange(row, 1).getDisplayValue() || '').trim();
      const b = String(sh.getRange(row, 2).getDisplayValue() || '').trim();
      if (a) break; if (b) row++; else break;
    }
    return row;
  } catch (e) {
    return r;
  }
}

function firstLinkFromRichV2_(rich) {
  try {
    if (!rich) return '';
    const idxs = rich.getTextStyleIndices();
    if (idxs && idxs.length) {
      for (let i = 0; i < idxs.length; i++) {
        const st = rich.getTextStyle(idxs[i]);
        const lu = st && st.getLinkUrl && st.getLinkUrl();
        if (lu) return String(lu).trim();
      }
    }
    const lu2 = rich.getLinkUrl && rich.getLinkUrl();
    if (lu2) return String(lu2).trim();
    const ts = rich.getTextStyle && rich.getTextStyle();
    const lu3 = ts && ts.getLinkUrl && ts.getLinkUrl();
    if (lu3) return String(lu3).trim();
  } catch (e) {}
  return '';
}

function extractSourcesV2_(textVal, formula, richUrl) {
  let list = [];
  function push(u) {
    if (!u) return; const n = normalizeUrlV2_(u); if (!n) return; list.push(classifyV2_(n));
  }

  if (richUrl) push(richUrl);

  if (formula) {
    const f = String(formula).trim();
    const mImg = f.match(/^=\s*(?:IMAGE|ИЗОБРАЖЕНИЕ)\s*\(\s*(["'])([^"']+)\1/i);
    if (mImg) push(mImg[2]);
    const mHyp = f.match(/^=\s*(?:HYPERLINK|ГИПЕРССЫЛКА)\s*\(\s*(["'])([^"']+)\1/i);
    if (mHyp) push(mHyp[2]);
  }

  try {
    const cleaned = cleanTextForUrlsV2_(String(textVal||''));
    (cleaned.match(/https?:\/\/[^\s<>\)\]"]+/g) || []).forEach(function(s) {
      push(s.replace(/[),.;]+$/, ''));
    });
    (cleaned.match(/(?:^|\s)(?:vk\.com|drive\.google\.com|docs\.google\.com|yadi\.sk|disk\.yandex\.(?:ru|com)|dropbox\.com|script\.google\.com|script\.googleusercontent\.com)\/[^\s<>\)\]"]+/gi) || [])
      .forEach(function(s) {
        push(String(s).trim());
      });
  } catch (e) {
    log_('V2 extract: text scan error: ' + e.message, 'WARN');
  }

  // uniq
  const seen = {};
  list = list.filter(function(s) {
    const k = s.kind+':' + (s.url||s.id); if (seen[k]) return false; seen[k]=true; return true;
  });
  return list;
}

function normalizeUrlV2_(u) {
  try {
    let s = String(u||'').trim(); if (!s) return '';
    // убрать любые html-теги, если затесались
    s = cleanTextForUrlsV2_(s);
    // убрать явные угловые скобки по краям
    s = s.replace(/^<+|>+$/g, '');
    if (/^https?:\/\//i.test(s)) return s;
    if (/^www\./i.test(s)) return 'https://'+s;
    if (/^(vk\.com|drive\.google\.com|yadi\.sk|disk\.yandex\.(?:ru|com)|dropbox\.com|script\.google\.com|script\.googleusercontent\.com)\//i.test(s)) return 'https://'+s;
    return s;
  } catch (e) {
    return String(u||'');
  }
}

function classifyV2_(u) {
  // direct VK
  if (/vk\.com\/reviews-\d+/i.test(u)) return {kind: 'vk-reviews', url: u};
  if (/vk\.com\/album-?\d+_\d+/i.test(u)) return {kind: 'vk-album', url: u};
  if (/vk\.com\/topic-?\d+_\d+/i.test(u)) return {kind: 'vk-topic', url: u};
  // parser webapp URLs
  if (/script\.google(?:usercontent)?\.com\//i.test(u)) {
    const act = getParamV2_(u, 'action');
    const inner = getParamV2_(u, 'url');
    if (act && inner) {
      const innerUrl = decodeURIComponent(inner);
      if (/^parseAlbum$/i.test(act)) return {kind: 'vk-album', url: innerUrl};
      if (/^parseDiscussion$/i.test(act)) return {kind: 'vk-topic', url: innerUrl};
      if (/^parseReviews$/i.test(act)) return {kind: 'vk-reviews', url: innerUrl};
    }
    // иначе попробуем забрать JSON как готовый результат
    return {kind: 'vk-webjson', url: u};
  }
  // Google Drive
  const gd = detectDriveLinkV2_(u);
  if (gd && gd.type === 'folder') return {kind: 'drive-folder', id: gd.id};
  if (gd && gd.type === 'file') return {kind: 'drive-file', id: gd.id};
  // Yandex / Dropbox
  if (/yadi\.sk\//i.test(u) || /disk\.yandex\.(ru|com)\//i.test(u)) return {kind: 'yadisk', url: u};
  if (/dropbox\.com\//i.test(u)) return {kind: 'dropbox-file', url: u};
  return {kind: 'url', url: u};
}

function getParamV2_(url, name) {
  try {
    const re = new RegExp('[?&]'+name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')+'=([^&#]*)', 'i'); const m = String(url).match(re); return m?m[1]:'';
  } catch (e) {
    return '';
  }
}

function detectDriveLinkV2_(url) {
  try {
    const u = String(url||'');
    const m1 = u.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/); if (m1) return {type: 'folder', id: m1[1]};
    const m2 = u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/); if (m2) return {type: 'file', id: m2[1]};
    const m3 = u.match(/[?&]id=([a-zA-Z0-9_-]+)/); if (m3) return {type: 'file', id: m3[1]};
    // docs.google.com/uc?export=download&id=... или open?id=...
    if (/docs\.google\.com\//i.test(u)) {
      const md = u.match(/[?&]id=([a-zA-Z0-9_-]+)/); if (md) return {type: 'file', id: md[1]};
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
      const file = DriveApp.getFileById(src.id);
      const blob = file.getBlob();
      const mt = String(blob.getContentType()||'').toLowerCase();
      if (mt.indexOf('image/') !== 0) {
        log_('V2 drive-file not image, contentType=' + mt, 'WARN'); return {images: [], texts: [], hasMore: false, nextOffset: 1};
      }
      return {images: [{mimeType: blob.getContentType()||'image/png', data: Utilities.base64Encode(blob.getBytes())}], texts: [], hasMore: false, nextOffset: 1};
    } catch (e) {
      throw new Error('Drive file error: ' + e.message);
    }
  }
  if (src.kind === 'yadisk') return collectYandexPublicV2_(src.url, 0, cap);
  if (src.kind === 'dropbox-file') {
    const dl = toDropboxDirectV2_(src.url); const resp = UrlFetchApp.fetch(dl, {muteHttpExceptions: true, followRedirects: true});
    if (resp.getResponseCode() >= 300) throw new Error('Dropbox HTTP ' + resp.getResponseCode());
    const bb = resp.getBlob();
    return {images: [{mimeType: bb.getContentType()||'image/png', data: Utilities.base64Encode(bb.getBytes())}], texts: [], hasMore: false, nextOffset: 1};
  }
  if (src.kind === 'url') {
    const bl = fetchImageToBlobWithHeadersV2_(src.url);
    if (!bl) throw new Error('HTTP_FETCH_FAILED');
    const mt = String(bl.getContentType()||'').toLowerCase();
    if (mt.indexOf('image/') !== 0) {
      log_('V2 url not image, contentType=' + mt + ' url=' + src.url.slice(0, 80), 'DEBUG'); return {images: [], texts: [], hasMore: false, nextOffset: 0};
    }
    return {images: [{mimeType: bl.getContentType()||'image/png', data: Utilities.base64Encode(bl.getBytes())}], texts: [], hasMore: false, nextOffset: 1};
  }
  return {images: [], texts: [], hasMore: false, nextOffset: 0};
}

// ----- VK via Web JSON (direct link to web-app/echo)
function collectVkWebJsonV2_(url, cap) {
  const resp = UrlFetchApp.fetch(url, {muteHttpExceptions: true, followRedirects: true});
  const code = resp.getResponseCode(); if (code >= 300) throw new Error('VK webjson HTTP '+code);
  const respText = resp.getContentText();
  if (respText.trim().startsWith('<!DOCTYPE') || respText.trim().startsWith('<html')) throw new Error('VK webjson returned HTML');
  let data = null; try {
    data = JSON.parse(respText);
  } catch (e) {
    throw new Error('VK webjson parse');
  }
  const images = []; let texts = [];
  if (data && data.images && data.images.length) {
    for (let i=0; i<data.images.length && images.length<cap; i++) {
      try {
        const u = data.images[i].url || data.images[i];
        const b = fetchImageToBlobWithHeadersV2_(u);
        if (!b) {
          log_('V2 VK webjson image fetch failed for url=' + String(u).slice(0, 160), 'WARN'); continue;
        }
        const mt = String(b.getContentType()||'').toLowerCase();
        if (mt.indexOf('image/') !== 0) {
          log_('V2 VK webjson non-image contentType=' + mt, 'WARN'); continue;
        }
        images.push({mimeType: b.getContentType()||'image/jpeg', data: Utilities.base64Encode(b.getBytes())});
      } catch (_) {}
    }
  }
  if (data && data.texts && data.texts.length) {
    texts = data.texts.map(function(t) {
      return String(t||'').trim();
    }).filter(Boolean).slice(0, cap);
  }
  return {images: images, texts: texts, hasMore: false, nextOffset: 0};
}

function getVkParserBaseV2_() {
  try {
    if (typeof getVkParserUrl_ === 'function') return String(getVkParserUrl_()).replace(/\/$/, '');
  } catch (e) {}
  try {
    if (typeof VK_PARSER_URL !== 'undefined' && VK_PARSER_URL) return String(VK_PARSER_URL).replace(/\/$/, '');
  } catch (e) {}
  throw new Error('Не задан VK_PARSER_URL');
}
function collectVkAlbumViaWebV2_(albumUrl, offset, limit) {
  const base = getVkParserBaseV2_(); const take = Math.max(1, Math.min(OCR2_BATCH_LIMIT, limit||OCR2_BATCH_LIMIT));
  const req = base + '?action=parseAlbum&url=' + encodeURIComponent(albumUrl) + '&limit=' + take + '&offset=' + (offset||0);
  log_('V2 VK album request: ' + req, 'DEBUG');
  const resp = UrlFetchApp.fetch(req, {muteHttpExceptions: true, followRedirects: true});
  const code = resp.getResponseCode(); if (code >= 300) throw new Error('VK album HTTP '+code);
  const respText = resp.getContentText();
  if (respText.trim().startsWith('<!DOCTYPE') || respText.trim().startsWith('<html')) throw new Error('VK album returned HTML');
  const data = JSON.parse(respText);
  const imgs = [];
  if (data && data.images && data.images.length) {
    for (let i=0; i<data.images.length && imgs.length<take; i++) {
      try {
        const u = data.images[i].url || data.images[i];
        if (i < 3) log_('V2 VK album image['+i+'] url=' + String(u).slice(0, 200), 'DEBUG');
        const b = fetchImageToBlobWithHeadersV2_(u);
        if (!b) {
          log_('V2 VK album image fetch failed for url=' + String(u).slice(0, 200), 'WARN'); continue;
        }
        const mt = String(b.getContentType()||'').toLowerCase();
        if (mt.indexOf('image/') !== 0) {
          log_('V2 VK album non-image contentType=' + mt, 'WARN'); continue;
        }
        imgs.push({mimeType: b.getContentType()||'image/jpeg', data: Utilities.base64Encode(b.getBytes())});
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
  const base = getVkParserBaseV2_(); const take = Math.max(1, Math.min(OCR2_BATCH_LIMIT, limit||OCR2_BATCH_LIMIT));
  const req = base + '?action=parseDiscussion&url=' + encodeURIComponent(topicUrl) + '&limit=' + take + '&offset=' + (offset||0);
  log_('V2 VK topic request: ' + req, 'DEBUG');
  const resp = UrlFetchApp.fetch(req, {muteHttpExceptions: true, followRedirects: true});
  const code = resp.getResponseCode(); if (code >= 300) throw new Error('VK topic HTTP '+code);
  const respText = resp.getContentText();
  if (respText.trim().startsWith('<!DOCTYPE') || respText.trim().startsWith('<html')) throw new Error('VK topic returned HTML');
  const data = JSON.parse(respText);
  let texts = (data && data.texts) || [];
  texts = texts.map(function(t) {
    return String(t||'').trim();
  }).filter(Boolean).slice(0, take);
  if (!texts.length) log_('V2 VK topic: 0 texts from web-app for url=' + topicUrl, 'WARN');
  return {images: [], texts: texts, hasMore: !!(data && data.hasMore), nextOffset: (data && data.nextOffset != null) ? data.nextOffset : 0};
}
function collectVkReviewsViaWebV2_(reviewsUrl, offset, limit) {
  const base = getVkParserBaseV2_(); const take = Math.max(1, Math.min(OCR2_BATCH_LIMIT, limit||OCR2_BATCH_LIMIT));
  const req = base + '?action=parseReviews&url=' + encodeURIComponent(reviewsUrl) + '&limit=' + take + '&offset=' + (offset||0);
  log_('V2 VK reviews request: ' + req, 'DEBUG');
  const resp = UrlFetchApp.fetch(req, {muteHttpExceptions: true, followRedirects: true});
  const code = resp.getResponseCode(); if (code >= 300) throw new Error('VK reviews HTTP '+code);
  const respText = resp.getContentText();
  if (respText.trim().startsWith('<!DOCTYPE') || respText.trim().startsWith('<html')) throw new Error('VK reviews returned HTML');
  const data = JSON.parse(respText);
  let texts = (data && data.texts) || [];
  texts = texts.map(function(t) {
    return String(t||'').trim();
  }).filter(Boolean).slice(0, take);
  if (!texts.length) log_('V2 VK reviews: 0 texts from web-app for url=' + reviewsUrl, 'WARN');
  return {images: [], texts: texts, hasMore: !!(data && data.hasMore), nextOffset: (data && data.nextOffset != null) ? data.nextOffset : 0};
}

// ----- Drive helpers (local)
function enumerateDriveFolderImagesV2_(folderId, offset, limit) {
  const folder = DriveApp.getFolderById(folderId); const it = folder.getFiles();
  const images = []; let imgIndex = 0;
  while (it.hasNext()) {
    const f = it.next(); const mt = String(f.getMimeType()||'').toLowerCase(); if (mt.indexOf('image/') !== 0) continue; if (imgIndex < (offset||0)) {
      imgIndex++; continue;
    } const blob=f.getBlob(); images.push({mimeType: blob.getContentType()||'image/png', data: Utilities.base64Encode(blob.getBytes())}); imgIndex++; if (images.length >= limit) break;
  }
  const hasMore = it.hasNext(); const nextOffset = (offset||0) + images.length; log_('V2 Drive folder: collected ' + images.length + ' images (offset='+(offset||0)+', limit='+limit+')', 'DEBUG'); return {images: images, texts: [], hasMore: hasMore, nextOffset: nextOffset};
}

// ----- Yandex / Dropbox helpers (local)
function collectYandexPublicV2_(publicUrl, offset, limit) {
  const base='https://cloud-api.yandex.net/v1/disk/public/resources'; const download='https://cloud-api.yandex.net/v1/disk/public/resources/download'; const images=[];
  try {
    const res = UrlFetchApp.fetch(base+'?public_key='+encodeURIComponent(publicUrl), {muteHttpExceptions: true, followRedirects: true}); const code = res.getResponseCode(); const data = JSON.parse(res.getContentText()); if (code >= 300) throw new Error('Yandex meta HTTP '+code);
    if (data && data.type==='file') {
      if (offset && offset>0) return {images: [], texts: [], hasMore: false, nextOffset: offset}; const dl=UrlFetchApp.fetch(download+'?public_key='+encodeURIComponent(publicUrl)).getContentText(); const link=JSON.parse(dl).href; const f=UrlFetchApp.fetch(link, {muteHttpExceptions: true, followRedirects: true}); const blob=f.getBlob(); images.push({mimeType: blob.getContentType()||'image/png', data: Utilities.base64Encode(blob.getBytes())}); return {images: images, texts: [], hasMore: false, nextOffset: 1};
    }
    if (data && data.type==='dir') {
      let pageOffset=0; let imgSeen=0; const take=Math.max(0, limit||OCR2_BATCH_LIMIT); while (images.length<take) {
        const meta=UrlFetchApp.fetch(base+'?public_key='+encodeURIComponent(publicUrl)+'&limit=200&offset='+pageOffset, {muteHttpExceptions: true, followRedirects: true}); const md=JSON.parse(meta.getContentText()); const items=(md && md._embedded && md._embedded.items)||[]; if (!items.length) break; for (let i=0; i<items.length && images.length<take; i++) {
          const it=items[i]; if (it.type!=='file') continue; const mime=String(it.mime_type||'').toLowerCase(); if (mime.indexOf('image/')!==0) continue; if (imgSeen < (offset||0)) {
            imgSeen++; continue;
          } const dl2=UrlFetchApp.fetch(download+'?public_key='+encodeURIComponent(publicUrl)+'&path='+encodeURIComponent(it.path)).getContentText(); const link2=JSON.parse(dl2).href; const f2=UrlFetchApp.fetch(link2, {muteHttpExceptions: true, followRedirects: true}); const blob2=f2.getBlob(); images.push({mimeType: blob2.getContentType()||'image/png', data: Utilities.base64Encode(blob2.getBytes())}); imgSeen++;
        } pageOffset += items.length; if (items.length<200) break;
      } const hasMore = images.length >= take; const nextOffset = (offset||0) + images.length; return {images: images, texts: [], hasMore: hasMore, nextOffset: nextOffset};
    }
  } catch (e) {
    log_('⚠️ Yandex error: ' + e.message, 'WARN');
  }
  return {images: images, texts: [], hasMore: false, nextOffset: (offset||0)+images.length};
}
function toDropboxDirectV2_(u) {
  try {
    let url = u.replace('www.dropbox.com', 'dl.dropboxusercontent.com'); if (url.indexOf('?dl=0')>=0) url=url.replace('?dl=0', '?dl=1'); if (url.indexOf('?dl=1')<0 && url.indexOf('?')<0) url += '?dl=1'; return url;
  } catch (e) {
    return u;
  }
}

// ----- Local OCR fallbacks
function gmOcrFromBlobV2_(blob, lang) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'); if (!apiKey) throw new Error('Не задан GEMINI_API_KEY');
  const mime = blob.getContentType()||'image/png'; const b64 = Utilities.base64Encode(blob.getBytes());
  const instruction = 'Транскрибируй текст на изображении БЕЗ добавления от себя. Верни только чистый текст. Если изображений несколько — разделяй отзывы строкой из четырёх подчёркиваний: ____ .'+(lang?(' Язык: '+lang+'.'):'');
  const body = {contents: [{parts: [{text: instruction}, {inlineData: {mimeType: mime, data: b64}}]}], generationConfig: {maxOutputTokens: 2048, temperature: 0}};
  const resp = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, {method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true});
  const code = resp.getResponseCode(); const respText = resp.getContentText(); if (respText.trim().startsWith('<!DOCTYPE') || respText.trim().startsWith('<html')) throw new Error('Gemini OCR returned HTML'); const data = JSON.parse(respText); if (code !== 200) {
    const msg=(data&&data.error&&data.error.message)||('HTTP_'+ code); throw new Error('Gemini OCR: '+msg);
  }
  const cand = data.candidates && data.candidates[0]; const part = cand && cand.content && cand.content.parts && cand.content.parts[0]; const text = part && part.text ? part.text : '';
  return (typeof processGeminiResponse === 'function') ? processGeminiResponse(text) : text;
}
function splitBySeparatorV2_(text) {
  const s = String(text||'').trim(); if (!s) return [];
  // основной способ: маркер ____ (четыре и более подчёркиваний) отдельной строкой или в тексте
  const parts = s.split(/\n?_{4,}\n?/g).map(function(x) {
    return String(x||'').trim();
  }).filter(Boolean);
  if (parts.length > 1) return parts;
  // запасной: параграфы
  const parts2 = s.split(/\n{2,}/g).map(function(x) {
    return String(x||'').trim();
  }).filter(Boolean);
  return parts2.length > 1 ? parts2 : [s];
}

function cleanTextForUrlsV2_(s) {
  try {
    let t = String(s||'');
    // убрать все теги вида <...>
    t = t.replace(/<[^>]*>/g, ' ');
    // простая декодировка HTML-сущностей для популярных случаев
    t = t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'');
    return t;
  } catch (e) {
    return String(s||'');
  }
}

// Локальная версия server OCR call с делимитером "____" (не затрагивает review.gs)
function serverGmOcrBatchV2_(images, lang) {
  const email = (typeof getLicenseEmail === 'function') ? getLicenseEmail() : '';
  const token = (typeof getLicenseToken === 'function') ? getLicenseToken() : '';
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const payload = {action: 'gm_image', email: email, token: token, apiKey: apiKey, images: images, lang: lang || 'ru', delimiter: '____'};
  const resp = UrlFetchApp.fetch(SERVER_URL, {method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true});
  const code = resp.getResponseCode();
  const respText = resp.getContentText();
  if (respText.trim().startsWith('<!DOCTYPE') || respText.trim().startsWith('<html')) throw new Error('Server returned HTML instead of JSON');
  const data = JSON.parse(respText);
  if (code !== 200 || !data || !data.ok) throw new Error((data && data.error) || ('HTTP_' + code));
  return data.data || '';
}

// Fetch image with browser-like headers to preserve query string semantics (VK CDN)
function fetchImageToBlobWithHeadersV2_(url) {
  try {
    const opts = {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Referer': 'https://vk.com/',
      },
    };
    const res = UrlFetchApp.fetch(url, opts);
    const code = res.getResponseCode();
    if (code >= 300) return null;
    return res.getBlob();
  } catch (e) {
    return null;
  }
}
