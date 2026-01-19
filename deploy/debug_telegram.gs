function debugTelegram() {
  const url = 'https://t.me/s/dianik_travel';
  const resp = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
  const html = resp.getContentText();
  
  Logger.log('HTML Length: ' + html.length);
  
  // Check if specific posts exist in the HTML
  const has186 = html.indexOf('dianik_travel/186');
  const has180 = html.indexOf('dianik_travel/180');
  
  Logger.log('Has post 186? ' + (has186 !== -1));
  Logger.log('Has post 180? ' + (has180 !== -1));

  // Run the regex to see what is captured
  const posts = [];
  const count = 50;
  
  // Adjusted regex to match the main script
  const msgRegex = /<div class="tgme_widget_message_bubble">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
  let m;
  
  while ((m = msgRegex.exec(html)) !== null && posts.length < count) {
    const block = m[1];
    let text = '';
    const txtM = block.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i);
    if (txtM) text = cleanHtmlDebug(txtM[1]);
    
    let link = '';
    const linkM = block.match(/href="([^"]+)"/i);
    if (linkM) link = linkM[1];

    Logger.log(`Found post: ${link} | Text length: ${text.length}`);
    
    if (link.includes('186') || link.includes('180')) {
        Logger.log(`!!! Found target post ${link}. Text: "${text}"`);
    }
  }
}

function cleanHtmlDebug(html) {
  if (!html) return '';
  let t = html.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<[^>]*>/g, '');
  return t.trim();
}
