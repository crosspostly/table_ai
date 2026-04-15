/**
 * Social Media Import Logic for Cloudflare Workers
 * Ported from Google Apps Script (SocialImport.gs)
 */

export interface ImportedPost {
  date: string;
  link: string;
  text: string;
}

/**
 * Main dispatcher for social imports
 */
export async function fetchSocialPosts(source: string, url: string, count: number): Promise<ImportedPost[]> {
  console.log(`[social] Starting import from ${source}: ${url} (count: ${count})`);
  
  if (source === 'telegram' || url.includes('t.me/')) {
    return await importTelegram(url, count);
  } else if (source === 'instagram' || url.includes('instagram.com')) {
    return await importInstagram(url, count);
  } else if (source === 'vk' || url.includes('vk.com')) {
    // В текущей реализации Sheets VK парсится через внешний URL-сервис (VK_PARSER_URL)
    // Мы можем либо внедрить прямой парсинг, либо использовать аналогичный подход.
    // Пока реализуем через базовый fetch, если это публичная страница.
    return await importVk(url, count);
  }
  
  throw new Error(`Unsupported source: ${source}`);
}

async function importTelegram(input: string, count: number): Promise<ImportedPost[]> {
  let url = input;
  // Convert t.me/username -> t.me/s/username for public preview
  if (!/\/s\//i.test(url) && !/\/\d+$/.test(url)) {
    url = url.replace(/(t\.me|telegram\.me)\/([^/]+)\/?$/, '$1/s/$2');
  }

  const posts: ImportedPost[] = [];
  let pageIterations = 0;
  const MAX_PAGES = 5; 

  while (posts.length < count && url && pageIterations < MAX_PAGES) {
    console.log(`[social/tg] Fetching: ${url}`);
    
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    
    if (!resp.ok) break;
    
    const html = await resp.text();
    // Regex matches the message bubble in T.me/s/ preview
    const msgRegex = /<div class="tgme_widget_message_bubble">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
    let m;
    
    while ((m = msgRegex.exec(html)) !== null) {
      if (posts.length >= count) break;

      const block = m[1];
      let text = '';
      const txtM = block.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i);
      if (txtM) text = cleanHtml(txtM[1]);
      
      let date = '';
      const dateM = block.match(/<time datetime="([^"]+)"/i);
      if (dateM) date = dateM[1];
      
      let link = '';
      const dateLinkM = block.match(/<a[^>]*class="[^"]*tgme_widget_message_date[^"]*"[^>]*href="([^"]+)"/i);
      if (dateLinkM) {
        link = dateLinkM[1];
      }

      if (text) {
        posts.push({ date, link, text });
      }
    }

    if (posts.length >= count) break;

    // Pagination
    const moreLinkMatch = html.match(/<a[^>]*class="[^"]*tme_messages_more[^"]*"[^>]*href="([^"]+)"/i);
    if (moreLinkMatch) {
      const nextPath = moreLinkMatch[1];
      url = nextPath.startsWith('/') ? 'https://t.me' + nextPath : nextPath;
      pageIterations++;
    } else {
      url = '';
    }
  }
  
  return posts;
}

async function importInstagram(input: string, count: number): Promise<ImportedPost[]> {
  let username = input;
  const m = input.match(/(?:instagram\.com|instagr\.am)\/([^/?]+)/i);
  if (m) username = m[1];
  username = username.replace(/^ig:/i, '').trim();

  // Using Picuki as a bridge (same as in Sheets)
  const bridgeUrl = 'https://www.picuki.com/profile/' + username;
  console.log(`[social/ig] Fetching via Picuki: ${bridgeUrl}`);
  
  const resp = await fetch(bridgeUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  
  if (!resp.ok) throw new Error(`Instagram bridge failed: ${resp.status}`);

  const html = await resp.text();
  const posts: ImportedPost[] = [];
  const boxRegex = /<div class="box-photo">([\s\S]*?)<div class="photo-description">([\s\S]*?)<\/div>/gi;
  let bm;

  while ((bm = boxRegex.exec(html)) !== null && posts.length < count) {
    const descHtml = bm[2];
    const text = cleanHtml(descHtml);
    
    let link = 'https://instagram.com/' + username;
    const linkM = bm[1].match(/href="([^"]+)"/);
    if (linkM) {
        let pLink = linkM[1];
        if (pLink.startsWith('/')) pLink = 'https://www.picuki.com' + pLink;
        link = pLink; 
    }

    posts.push({
      date: new Date().toISOString(),
      link: link,
      text: text
    });
  }

  return posts;
}

async function importVk(url: string, count: number): Promise<ImportedPost[]> {
    // Для VK в Cloudflare Workers сложнее из-за CORS и защиты VK. 
    // Если есть VK_PARSER_URL, лучше использовать его. 
    // Но попробуем базовый скрапинг публичной страницы m.vk.com (мобильная версия проще)
    let mobileUrl = url.replace('vk.com', 'm.vk.com');
    console.log(`[social/vk] Fetching: ${mobileUrl}`);
    
    const resp = await fetch(mobileUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36' }
    });
    
    if (!resp.ok) throw new Error(`VK fetch failed: ${resp.status}`);
    const html = await resp.text();
    const posts: ImportedPost[] = [];
    
    // Очень упрощенный парсинг для m.vk.com
    const postRegex = /<div class="pi_text">([\s\S]*?)<\/div>/gi;
    let pm;
    while ((pm = postRegex.exec(html)) !== null && posts.length < count) {
        posts.push({
            date: new Date().toISOString(),
            link: url,
            text: cleanHtml(pm[1])
        });
    }
    
    return posts;
}

function cleanHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
