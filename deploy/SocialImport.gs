/**
 * Social Import Module
 * Supports: VK (via Parser), Telegram (Direct Public), Instagram (via Bridge)
 */

function addLog(message, level) {
  Logger.log(`[${level || 'INFO'}] ${message}`);
  // Try to call global addLog if available from Main.gs
  try {
    if (typeof global !== 'undefined' && global.addLog) global.addLog(message, level);
  } catch (e) {}
}

/**
 * Main entry point for Social Import
 * Detects network based on input in "Посты!C1"
 */
function importSocialPosts() {
  addLog('→ Social Import Started', 'INFO');
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('Посты');

  if (!sheet) {
    SpreadsheetApp.getUi().alert('Ошибка', 'Лист "Посты" не найден!', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const input = String(sheet.getRange('C1').getValue() || '').trim();
  const count = sheet.getRange('E1').getValue() || 20;

  if (!input) {
    SpreadsheetApp.getUi().alert('Ошибка', 'Введите ссылку или ID в ячейку C1', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  let data = [];
  
  try {
    // 1. Telegram Strict Detection
    if (/(t\.me|telegram\.me)\\/i.test(input)) {
      addLog('Detected: Telegram (Link)', 'INFO');
      data = importTelegram(input, count);
      
    // 2. Instagram Strict Detection
    } else if (/(instagram\.com|instagr\.am)\\/i.test(input)) {
      addLog('Detected: Instagram (Link)', 'INFO');
      data = importInstagram(input, count);
      
    // 3. VK Strict Detection (URL)
    } else if (/(vk\.com|vk\.ru|m\.vk\.com)\\/i.test(input)) {
      addLog('Detected: VK (Link)', 'INFO');
      // Extract owner from link or pass full link if parser supports it
      // Our parser expects "owner" (id/slug), so let's try to extract it roughly or pass as is
      // Current logic: pass the input, let the external parser handle or extract ID locally?
      // Legacy "importVk" just passes 'owner' param. 
      // Let's assume the user inputs the ID/Slug for VK usually, but if they paste a link, we strip it.
      var vkOwner = input.replace(/^(?:https?:\/\/)?(?:www\.|m\.)?(?:vk\.com|vk\.ru)\\/i, '').replace(/^\/+|\/+$/g, '');
      data = importVk(vkOwner, count);
      
    // 4. VK Legacy (Plain ID/Slug) - Default for non-URL inputs
    } else if (!/[./:\\]/.test(input)) {
      addLog('Detected: VK (ID/Slug)', 'INFO');
      data = importVk(input, count);
      
    } else {
      throw new Error('Неизвестный источник. Используйте прямые ссылки (vk.com, t.me, instagram.com) или ID сообщества ВК.');
    }
  } catch (e) {
    addLog('❌ Import Failed: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка импорта: ' + e.message);
    return;
  }

  if (!data || !data.length) {
    SpreadsheetApp.getUi().alert('Ничего не найдено или ошибка парсинга.');
    return;
  }

  // Clear old data (Row 3+)
  const lastRow = sheet.getLastRow();
  if (lastRow > 2) {
    const lastCol = sheet.getLastColumn();
    sheet.getRange(3, 1, lastRow - 2, lastCol).clearContent().clearFormat();
  }

  // Write new data
  // Expected format: [Date, Link, Text, Number, ...]
  const out = data.map((item, i) => {
    return [
      item.date || '',
      item.link || '',
      item.text || '',
      i + 1, // Number
      '', '', '', '', '', '' // Placeholders
    ];
  });

  if (out.length > 0) {
    sheet.getRange(3, 1, out.length, 10).setValues(out);
  }

  // Re-apply filters
  if (typeof createStopWordsFormulas === 'function') {
    createStopWordsFormulas(sheet, out.length + 2);
  } else {
    createStopWordsFormulasLocal(sheet, out.length + 2);
  }

  addLog(`✅ Imported ${out.length} posts`, 'SUCCESS');
  SpreadsheetApp.getUi().alert(`Успешно импортировано: ${out.length} постов.`);
}

// Backward compatibility alias
function importVkPosts() {
  importSocialPosts();
}

/**
 * VK Import (Legacy via Parser)
 */
function importVk(owner, count) {
  // Use global VK_PARSER_URL if available, otherwise define it locally or fail
  let parserUrl = '';
  try { parserUrl = VK_PARSER_URL; } catch(e) {}
  
  if (!parserUrl) throw new Error('VK_PARSER_URL not defined in Main.gs');

  const url = parserUrl + '?owner=' + encodeURIComponent(owner) + '&count=' + encodeURIComponent(count);
  const resp = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
  if (resp.getResponseCode() !== 200) throw new Error('VK Parser HTTP ' + resp.getResponseCode());
  
  const json = JSON.parse(resp.getContentText());
  if (!Array.isArray(json)) throw new Error('Invalid JSON from VK Parser');
  
  return json.map(p => ({
    date: p.date,
    link: p.link,
    text: p.text
  }));
}

/**
 * Telegram Import (Direct Public Channel)
 */
function importTelegram(input, count) {
  // Convert t.me/durov -> t.me/s/durov
  let url = input;
  if (!/\/s\//i.test(url) && !/\/\d+$/.test(url)) {
    // Fixed regex: matches t.me/user or t.me/user/ (optional slash at end)
    url = url.replace(/(t\.me|telegram\.me)\/([^/]+)\/?$/, '$1/s/$2');
  }

  const resp = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
  if (resp.getResponseCode() >= 300) throw new Error('Telegram HTTP ' + resp.getResponseCode());
  
  const html = resp.getContentText();
  const posts = [];
  
  // Regex Parsing
  // <div class="tgme_widget_message ...">
  const msgRegex = /<div class="tgme_widget_message_bubble">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
  let m;
  
  while ((m = msgRegex.exec(html)) !== null && posts.length < count) {
    const block = m[1];
    
    // Text
    let text = '';
    const txtM = block.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i);
    if (txtM) text = cleanHtml(txtM[1]);
    
    // Date
    let date = '';
    const dateM = block.match(/<time datetime="([^"]+)"/i);
    if (dateM) date = dateM[1];
    
    // Link
    let link = '';
    const linkM = block.match(/href="([^"]+)"/i); // usually the date link
    if (linkM) link = linkM[1];

    if (text) {
        posts.push({ date, link, text });
    }
  }
  
  return posts;
}

/**
 * Instagram Import (via Picuki Bridge)
 */
function importInstagram(input, count) {
  // Extract username
  let username = input;
  const m = input.match(/(?:instagram\.com|instagr\.am)\/([^/?]+)/i);
  if (m) username = m[1];
  username = username.replace(/^ig:/i, '').trim();

  const bridgeUrl = 'https://www.picuki.com/profile/' + username;
  const resp = UrlFetchApp.fetch(bridgeUrl, {muteHttpExceptions: true});
  
  if (resp.getResponseCode() === 404) throw new Error('Instagram User Not Found (via Bridge)');
  if (resp.getResponseCode() >= 300) throw new Error('Bridge HTTP ' + resp.getResponseCode());

  const html = resp.getContentText();
  const posts = [];

  // Find posts
  // Picuki structure: <div class="box-photo"> ... <img src=\"...\"> ... <div class="photo-description">...</div>
  const boxRegex = /<div class="box-photo">([\s\S]*?)<div class="photo-description">([\s\S]*?)<\/div>/gi;
  let bm;

  while ((bm = boxRegex.exec(html)) !== null && posts.length < count) {
    const descHtml = bm[2];
    const text = cleanHtml(descHtml);
    
    // Link extraction is harder in Picuki list view, usually just relative
    // We can construct a fake link or try to find the <a> wrapping the image in bm[1]
    let link = 'https://instagram.com/' + username;
    const linkM = bm[1].match(/href="([^"]+)"/);
    if (linkM) {
        // Picuki links look like /media/12345...
        // We can just keep the picuki link or generic
        link = linkM[1];
        if (link.startsWith('/')) link = 'https://www.picuki.com' + link;
    }

    posts.push({
      date: new Date().toISOString().slice(0, 10), // Date is hard to parse relative "2h ago", using today
      link: link,
      text: text
    });
  }

  return posts;
}

/**
 * Helper: Clean HTML entities and tags
 */
function cleanHtml(html) {
  if (!html) return '';
  let t = html.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<[^>]*>/g, '');
  t = t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return t.trim();
}

/**
 * Local version of stop words formula creation if not found globally
 */
function createStopWordsFormulasLocal(sheet, totalRows) {
  try {
    const stopWordsRange = '$E$3:$E$100';
    const positiveWordsRange = '$H$3:$H$100';
    const formulas = [];

    for (let row = 3; row <= totalRows; row++) {
      // Build formula strings in parts for safety and readability
      const searchStop = 'ISNUMBER(SEARCH(' + stopWordsRange + ', C' + row + '))';
      const checkStop = '(' + stopWordsRange + '<>""")';
      const formulaF = '=IF(SUMPRODUCT(--(' + searchStop + ')*' + checkStop + ') > 0, "", C' + row + ')';
      
      const formulaG = '=IF(F' + row + '<>"", COUNTA(F$3:F' + row + '), "")';
      
      const searchPos = 'ISNUMBER(SEARCH(' + positiveWordsRange + ', C' + row + '))';
      const checkPos = '(' + positiveWordsRange + '<>""")';
      const formulaI = '=IF(SUMPRODUCT(--(' + searchPos + ')*' + checkPos + ') > 0, C' + row + ', "")';
      
      const formulaJ = '=IF(I' + row + '<>"", COUNTA(I$3:I' + row + '), "")';
      
      formulas.push([formulaF, formulaG, '', formulaI, formulaJ]);
    }

    if (formulas.length > 0) {
      sheet.getRange(3, 6, formulas.length, 5).setFormulas(formulas);
    }
  } catch (e) {
    addLog('❌ Filter error: ' + e.message, 'ERROR');
  }
}
