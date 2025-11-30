// ═══════════════════════════════════════════════════════════════
// ⭐ OTA_UPDATES.GS - SERVER-SIDE OTA MODULE
// Вся логика обновлений работает здесь!
// ЭТОТ ФАЙЛ ТОЛЬКО НА СЕРВЕРЕ! НЕ В КЛИЕНТЕ!
// ═══════════════════════════════════════════════════════════════

// eslint-disable-next-line no-unused-vars
const OTA_CONFIG = {
  REPO: 'crosspostly/table_ai',
  BRANCH: 'main',
  DEPLOY_PATH: 'deploy/',
  CLIENT_FILES: [
    'Main.gs',
    'CollectConfig.gs',
    'TemplateService.gs',
    'UnpackingViewer.gs',
    'VK.gs',
    'ocrRunV2_client.gs',
    'reniewcell.gs',
    'CollectConfigUi.html',
    'SettingsUI.html',
    'UnpackingViewerUI.html',
    'logging_system.html',
    'appsscript.json',
  ],
};

// ═══════════════════════════════════════════════════════════════
// GITHUB PAT (ТОЛЬКО НА СЕРВЕРЕ!)
// ═══════════════════════════════════════════════════════════════

/**
 * Установить GitHub PAT (администратор вызывает один раз)
 *
 * ВЫЗЫВАЕТСЯ ТОЛЬКО НА СЕРВЕРЕ!
 * Extensions → server.gs → Console
 * setGithubPAT_('ghp_...')
 *
 * @param {string} pat - GitHub Personal Access Token
 * @return {boolean}
 */
// eslint-disable-next-line no-unused-vars
function setGithubPAT_(pat) {
  try {
    if (!pat || pat.length < 20) {
      Logger.log('❌ Invalid PAT');
      return false;
    }

    const props = PropertiesService.getScriptProperties();
    props.setProperty('GITHUB_PAT', pat);

    Logger.log('✅ GitHub PAT set: ' + pat.substring(0, 10) + '...');
    return true;
  } catch (e) {
    Logger.log('❌ Error: ' + e.message);
    return false;
  }
}

/**
 * Получить GitHub PAT (ТОЛЬКО СЕРВЕР!)
 * КЛИЕНТ НИКОГДА не должен получить PAT!
 *
 * @return {string|null}
 */
function getGithubPAT_() {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('GITHUB_PAT') || null;
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// DOWNLOAD FILES (ТОЛЬКО НА СЕРВЕРЕ!)
// ═══════════════════════════════════════════════════════════════

/**
 * Скачать файл с GitHub
 *
 * ВЫЗЫВАЕТСЯ ТОЛЬКО НА СЕРВЕРЕ!
 *
 * @param {string} fileName
 * @param {boolean} isPublicRepo
 * @return {string|null}
 */
function downloadFileFromGithub_(fileName, isPublicRepo) {
  try {
    Logger.log('🔽 Downloading: ' + fileName);
    Logger.log('   🔓 Using: ' + (isPublicRepo ? 'PUBLIC repo' : 'PRIVATE repo'));

    if (isPublicRepo) {
      return downloadFromPublicRepo_(fileName);
    } else {
      return downloadFromPrivateRepo_(fileName);
    }
  } catch (e) {
    Logger.log('❌ downloadFileFromGithub_ ERROR: ' + e.message);
    Logger.log('   Stack: ' + (e.stack || 'no stack'));
    return null;
  }
}

/**
 * Скачать из ПУБЛИЧНОГО репо (raw.githubusercontent.com)
 * @param {string} fileName
 * @return {string|null}
 */
function downloadFromPublicRepo_(fileName) {
  try {
    const url = 'https://raw.githubusercontent.com/' + OTA_CONFIG.REPO + '/' + OTA_CONFIG.BRANCH + '/' + OTA_CONFIG.DEPLOY_PATH + fileName;
    Logger.log('      🌐 URL: ' + url);

    const resp = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
    });

    const respCode = resp.getResponseCode();
    Logger.log('      ✉️ HTTP ' + respCode);

    if (respCode !== 200) {
      Logger.log('      ❌ HTTP ERROR ' + respCode);
      const body = resp.getContentText();
      Logger.log('      📋 Response: ' + body.substring(0, 200));
      return null;
    }

    const content = resp.getContentText();
    Logger.log('      ✅ Downloaded: ' + content.length + ' bytes');
    return content;
  } catch (e) {
    Logger.log('      ❌ downloadFromPublicRepo_ Exception: ' + e.message);
    Logger.log('      Stack: ' + (e.stack || 'no stack'));
    return null;
  }
}

/**
 * Скачать из ПРИВАТНОГО репо (GitHub API + PAT)
 *
 * ⭐ ТОЛЬКО СЕРВЕР знает PAT!
 * ⭐ КЛИЕНТ никогда не вызывает эту функцию!
 *
 * @param {string} fileName
 * @return {string|null}
 */
function downloadFromPrivateRepo_(fileName) {
  try {
    const pat = getGithubPAT_();

    if (!pat) {
      Logger.log('      ❌ No GitHub PAT configured');
      Logger.log('      💡 Use: setGithubPAT_(\'ghp_...\') to configure');
      return null;
    }

    Logger.log('      🔐 GitHub PAT: SET (length: ' + pat.length + ')');

    const url = 'https://api.github.com/repos/' + OTA_CONFIG.REPO + '/contents/' + OTA_CONFIG.DEPLOY_PATH + fileName + '?ref=' + OTA_CONFIG.BRANCH;
    Logger.log('      🌐 URL: ' + url);

    const resp = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        'Authorization': 'token ' + pat, // ⭐ PAT ТОЛЬКО ЗДЕСЬ!
        'Accept': 'application/vnd.github.v3.raw',
        'User-Agent': 'TableAI-OTA',
      },
      muteHttpExceptions: true,
    });

    const respCode = resp.getResponseCode();
    Logger.log('      ✉️ HTTP ' + respCode);

    if (respCode === 401 || respCode === 403) {
      Logger.log('      ❌ GitHub authentication FAILED (401/403)');
      Logger.log('      💡 Check your PAT is valid and has access to this repo');
      const body = resp.getContentText();
      Logger.log('      📋 Response: ' + body.substring(0, 200));
      return null;
    }

    if (respCode !== 200) {
      Logger.log('      ❌ HTTP ERROR ' + respCode);
      const body = resp.getContentText();
      Logger.log('      📋 Response: ' + body.substring(0, 200));
      return null;
    }

    const content = resp.getContentText();
    Logger.log('      ✅ Downloaded: ' + content.length + ' bytes');
    return content;
  } catch (e) {
    Logger.log('      ❌ downloadFromPrivateRepo_ Exception: ' + e.message);
    Logger.log('      Stack: ' + (e.stack || 'no stack'));
    return null;
  }
}

/**
 * Скачать ВСЕ файлы (ТОЛЬКО СЕРВЕР!)
 * @param {boolean} isPublicRepo
 * @return {Array|null}
 */
function downloadAllClientFiles_(isPublicRepo) {
  try {
    Logger.log('\n📥 Starting download of all client files');
    Logger.log('   🌐 Repo: ' + OTA_CONFIG.REPO);
    Logger.log('   🌳 Branch: ' + OTA_CONFIG.BRANCH);
    Logger.log('   📁 Path: ' + OTA_CONFIG.DEPLOY_PATH);
    Logger.log('   🔓 Public repo: ' + isPublicRepo);
    Logger.log('   📦 Files to download: ' + OTA_CONFIG.CLIENT_FILES.length);

    const files = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < OTA_CONFIG.CLIENT_FILES.length; i++) {
      const fileName = OTA_CONFIG.CLIENT_FILES[i];
      Logger.log('\n   [' + (i + 1) + '/' + OTA_CONFIG.CLIENT_FILES.length + '] ' + fileName + '...');

      const content = downloadFileFromGithub_(fileName, isPublicRepo);

      if (!content) {
        Logger.log('      ❌ Download FAILED');
        failCount++;
        return null;
      }

      let type = 'SERVER_JS';
      if (fileName.endsWith('.html')) type = 'HTML';
      if (fileName === 'appsscript.json') type = 'JSON';

      Logger.log('      ✅ Downloaded: ' + content.length + ' bytes (' + type + ')');

      files.push({
        name: fileName,
        type: type,
        source: content,
      });

      successCount++;
    }

    Logger.log('\n✅ All files downloaded successfully!');
    Logger.log('   ✅ Success: ' + successCount);
    Logger.log('   ❌ Failed: ' + failCount);
    Logger.log('   📦 Total files: ' + files.length);
    return files;
  } catch (e) {
    Logger.log('❌ downloadAllClientFiles_ ERROR: ' + e.message);
    Logger.log('   Stack: ' + (e.stack || 'no stack'));
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// UPDATE CLIENT SCRIPT (ТОЛЬКО СЕРВЕР обновляет клиента!)
// ═══════════════════════════════════════════════════════════════

/**
 * Обновить клиентский скрипт
 *
 * ВЫЗЫВАЕТСЯ ТОЛЬКО НА СЕРВЕРЕ!
 * КЛИЕНТ НИ ЧТО не обновляет!
 *
 * @param {string} clientScriptId
 * @param {Array} files
 * @return {boolean}
 */
function updateClientScript_(clientScriptId, files) {
  try {
    Logger.log('🔧 Updating client script...');
    Logger.log('   📄 Client Script ID: ' + clientScriptId.substring(0, 12) + '...');
    Logger.log('   📦 Files to update: ' + files.length);

    files.forEach((f, i) => {
      Logger.log('      [' + (i + 1) + '] ' + f.name + ' (' + f.type + ')');
    });

    const apiUrl = 'https://script.googleapis.com/v1/projects/' + clientScriptId + '/content';
    Logger.log('   🌐 API URL: ' + apiUrl);

    const oauthToken = ScriptApp.getOAuthToken();
    Logger.log('   🔐 OAuth token: ' + (oauthToken ? 'SET (length: ' + oauthToken.length + ')' : 'NOT SET'));

    const payload = JSON.stringify({files: files});
    Logger.log('   📨 Payload size: ' + payload.length + ' bytes');

    const resp = UrlFetchApp.fetch(apiUrl, {
      method: 'put',
      headers: {
        'Authorization': 'Bearer ' + oauthToken,
        'Content-Type': 'application/json',
      },
      payload: payload,
      muteHttpExceptions: true,
    });

    const respCode = resp.getResponseCode();
    Logger.log('   ✉️ Response code: ' + respCode);

    const respBody = resp.getContentText();
    Logger.log('   📦 Response body length: ' + respBody.length);
    if (respBody.length < 500) {
      Logger.log('   📋 Response body: ' + respBody);
    }

    if (respCode !== 200) {
      Logger.log('❌ HTTP ERROR ' + respCode);
      Logger.log('   Response: ' + respBody.substring(0, 300));
      return false;
    }

    Logger.log('✅ Client script updated successfully!');
    return true;
  } catch (e) {
    Logger.log('❌ updateClientScript_ ERROR: ' + e.message);
    Logger.log('   Stack: ' + (e.stack || 'no stack'));
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// CHECK VERSION
// ═══════════════════════════════════════════════════════════════

/**
 * Проверить есть ли обновления (СЕРВЕР отвечает КЛИЕНТУ)
 * @param {string} clientVersion
 * @param {string} serverVersion
 * @return {Object}
 */
// eslint-disable-next-line no-unused-vars
function checkForUpdates_(clientVersion, serverVersion) {
  return {
    ok: true,
    updateAvailable: serverVersion !== clientVersion,
    clientVersion: clientVersion,
    serverVersion: serverVersion,
  };
}

// ═══════════════════════════════════════════════════════════════
// MAIN FUNCTION: СЕРВЕР ОБНОВЛЯЕТ КЛИЕНТА
// ═══════════════════════════════════════════════════════════════

/**
 * 🚀 ГЛАВНАЯ ФУНКЦИЯ: СЕРВЕР ПОЛНОСТЬЮ ОБНОВЛЯЕТ КЛИЕНТА
 *
 * ВЫЗЫВАЕТСЯ ТОЛЬКО НА СЕРВЕРЕ!
 * КЛИЕНТ НЕ УЧАСТВУЕТ!
 *
 * Процесс:
 * 1. Проверить лицензию
 * 2. Скачать файлы с GitHub (сервер знает как!)
 * 3. Обновить клиентский скрипт (сервер имеет права!)
 * 4. Логировать
 *
 * @param {string} token - токен клиента
 * @param {string} email - email клиента
 * @param {string} clientScriptId - скрипт клиента
 * @param {string} spreadsheetId - таблица клиента
 * @param {boolean} isPublicRepo - конфиг сервера
 * @return {Object}
 */
// eslint-disable-next-line no-unused-vars
function applyUpdatesToClient_(token, email, clientScriptId, spreadsheetId, isPublicRepo) {
  const startTime = new Date().getTime();
  try {
    Logger.log('═══════════════════════════════════════════════════════════════');
    Logger.log('🚀 СЕРВЕР ОБНОВЛЯЕТ КЛИЕНТА');
    Logger.log('═══════════════════════════════════════════════════════════════');
    Logger.log('⏱️  Started at: ' + new Date().toISOString());
    Logger.log('📋 Parameters:');
    Logger.log('   📧 Email: ' + (email ? 'SET' : 'NOT SET'));
    Logger.log('   🔑 Token: ' + (token ? 'SET (length: ' + token.length + ')' : 'NOT SET'));
    Logger.log('   📄 ClientScriptId: ' + (clientScriptId ? clientScriptId.substring(0, 12) + '...' : 'NOT SET'));
    Logger.log('   📊 SpreadsheetId: ' + (spreadsheetId ? 'SET' : 'NOT SET'));
    Logger.log('   🔓 Public repo: ' + isPublicRepo);
    Logger.log('═══════════════════════════════════════════════════════════════');

    // ШАГ 1: СЕРВЕР проверяет лицензию
    Logger.log('\n📌 STEP 1: Validating license...');
    const licStartTime = new Date().getTime();

    const lic = checkLicense_(token, email, clientScriptId, spreadsheetId);
    const licTime = new Date().getTime() - licStartTime;

    Logger.log('   ✅ License check completed in ' + licTime + 'ms');
    Logger.log('   📋 License result: ' + JSON.stringify(lic));

    if (!lic.ok) {
      Logger.log('❌ License validation FAILED');
      Logger.log('   Error: ' + lic.error);
      return {ok: false, error: 'LICENSE_FAILED: ' + lic.error};
    }

    Logger.log('✅ License is VALID');

    // ШАГ 2: СЕРВЕР скачивает файлы с GitHub
    Logger.log('\n📌 STEP 2: Downloading files from GitHub...');
    const downloadStartTime = new Date().getTime();

    const files = downloadAllClientFiles_(isPublicRepo);
    const downloadTime = new Date().getTime() - downloadStartTime;

    if (!files) {
      Logger.log('❌ Download FAILED (no files returned)');
      return {ok: false, error: 'DOWNLOAD_FAILED'};
    }

    Logger.log('✅ Download completed in ' + downloadTime + 'ms');
    Logger.log('   📦 Downloaded ' + files.length + ' files');

    // ШАГ 3: СЕРВЕР обновляет клиента через API
    Logger.log('\n📌 STEP 3: Updating client script...');
    const updateStartTime = new Date().getTime();

    const updated = updateClientScript_(clientScriptId, files);
    const updateTime = new Date().getTime() - updateStartTime;

    if (!updated) {
      Logger.log('❌ Update FAILED (script not updated)');
      return {ok: false, error: 'UPDATE_FAILED'};
    }

    Logger.log('✅ Update completed in ' + updateTime + 'ms');

    // ШАГ 4: Логирование
    Logger.log('\n📌 STEP 4: Logging success...');
    serverLog_({
      action: 'OTA_SUCCESS',
      email: email,
      promptLen: 0,
      ms: new Date().getTime() - startTime,
    });
    Logger.log('✅ Success logged');

    const totalTime = new Date().getTime() - startTime;
    Logger.log('═══════════════════════════════════════════════════════════════');
    Logger.log('🎉 ✅ CLIENT SUCCESSFULLY UPDATED!');
    Logger.log('⏱️  Total time: ' + totalTime + 'ms');
    Logger.log('   - License check: ' + licTime + 'ms');
    Logger.log('   - File download: ' + downloadTime + 'ms');
    Logger.log('   - Script update: ' + updateTime + 'ms');
    Logger.log('═══════════════════════════════════════════════════════════════');

    return {
      ok: true,
      message: 'Client updated successfully',
      version: SERVER_VERSION,
      time: totalTime,
    };
  } catch (e) {
    const errorTime = new Date().getTime() - startTime;
    Logger.log('═══════════════════════════════════════════════════════════════');
    Logger.log('❌ ❌ FATAL ERROR ❌ ❌');
    Logger.log('═══════════════════════════════════════════════════════════════');
    Logger.log('Error message: ' + e.message);
    Logger.log('Stack trace: ' + (e.stack || 'no stack available'));
    Logger.log('Time before error: ' + errorTime + 'ms');
    Logger.log('═══════════════════════════════════════════════════════════════');

    return {ok: false, error: 'ERROR: ' + e.message, time: errorTime};
  }
}

// ═══════════════════════════════════════════════════════════════
// END OF OTA_UPDATES.GS (СЕРВЕР)
// ═══════════════════════════════════════════════════════════════
