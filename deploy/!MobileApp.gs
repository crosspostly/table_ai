/**
 * Mobile Web App Entry Point
 */
function doGet(e) {
  const key = e.parameter.key || '';
  const email = e.parameter.email || '';
  const page = e.parameter.page || 'home';
  const tableId = e.parameter.tableId || '';
  
  // Нет ключа → показываем форму входа
  if (!key || !email) {
    return HtmlService.createHtmlOutputFromFile('MobileLogin')
      .setTitle('Table AI Mobile')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
  }
  
  // Проверяем лицензию
  const lic = checkLicense_(key, email, tableId);
  
  if (!lic.ok) {
    return showMobileError(lic.error, lic.message || '');
  }
  
  // Лицензия ОК → показываем приложение
  const template = HtmlService.createTemplateFromFile('MobileMain');
  template.key = key;
  template.email = email;
  template.page = page;
  template.tableId = tableId;
  template.licenseInfo = lic;
  
  return template.evaluate()
    .setTitle('Table AI Mobile')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}

function showMobileError(error, message) {
  let errorText = '';
  let errorDetails = message;
  
  switch(error) {
    case 'INACTIVE':
      errorText = '❌ Лицензия неактивна';
      errorDetails = errorDetails || 'Обратитесь к создателю: https://vk.com/daoqub';
      break;
    case 'EXPIRED':
      errorText = '❌ Лицензия истекла';
      errorDetails = errorDetails || 'Обратитесь к создателю: https://vk.com/daoqub';
      break;
    case 'NO_QUOTA_LEFT':
      errorText = '❌ Исчерпана квота';
      break;
    case 'SHEET_BOUND_TO_OTHER':
      errorText = '❌ Таблица привязана к другому аккаунту';
      break;
    case 'NOT_FOUND':
      errorText = '❌ Неверный ключ или email';
      break;
    default:
      errorText = '❌ Ошибка: ' + error;
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          margin: 0;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f5f7fa;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .card {
          background: white;
          padding: 32px;
          border-radius: 16px;
          max-width: 400px;
          text-align: center;
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        }
        h1 { font-size: 48px; margin: 0 0 16px; }
        h2 { font-size: 20px; margin: 0 0 12px; color: #c53030; }
        p { color: #718096; font-size: 14px; line-height: 1.6; }
        a {
          display: inline-block;
          margin-top: 16px;
          padding: 12px 24px;
          background: #667eea;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🔒</h1>
        <h2>${errorText}</h2>
        <p>${errorDetails}</p>
        <a href="?">← Попробовать снова</a>
      </div>
    </body>
    </html>
  `;
  
  return HtmlService.createHtmlOutput(html);
}

// Вспомогательные функции для Mobile App
function getMobileSpreadsheets() {
  try {
    const files = DriveApp.searchFiles(
      'mimeType="application/vnd.google-apps.spreadsheet" and trashed=false'
    );
    
    const sheets = [];
    while (files.hasNext() && sheets.length < 50) {
      const file = files.next();
      sheets.push({
        id: file.getId(),
        name: file.getName(),
        url: file.getUrl()
      });
    }
    
    return {success: true, sheets: sheets};
  } catch (e) {
    return {success: false, error: e.message};
  }
}
