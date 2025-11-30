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

    if (isPublicRepo) {
      return downloadFromPublicRepo_(fileName);
    } else {
      return downloadFromPrivateRepo_(fileName);
    }
  } catch (e) {
    Logger.log('❌ Error: ' + e.message);
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

    const resp = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
    });

    if (resp.getResponseCode() !== 200) {
      Logger.log('   ❌ HTTP ' + resp.getResponseCode());
      return null;
    }

    const content = resp.getContentText();
    Logger.log('   ✅ Downloaded: ' + content.length + ' bytes');
    return content;
  } catch (e) {
    Logger.log('   ❌ Exception: ' + e.message);
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
      Logger.log('   ❌ No GitHub PAT configured');
      return null;
    }

    const url = 'https://api.github.com/repos/' + OTA_CONFIG.REPO + '/contents/' + OTA_CONFIG.DEPLOY_PATH + fileName + '?ref=' + OTA_CONFIG.BRANCH;

    const resp = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        'Authorization': 'token ' + pat, // ⭐ PAT ТОЛЬКО ЗДЕСЬ!
        'Accept': 'application/vnd.github.v3.raw',
        'User-Agent': 'TableAI-OTA',
      },
      muteHttpExceptions: true,
    });

    if (resp.getResponseCode() === 401 || resp.getResponseCode() === 403) {
      Logger.log('   ❌ GitHub auth failed');
      return null;
    }

    if (resp.getResponseCode() !== 200) {
      Logger.log('   ❌ HTTP ' + resp.getResponseCode());
      return null;
    }

    const content = resp.getContentText();
    Logger.log('   ✅ Downloaded: ' + content.length + ' bytes');
    return content;
  } catch (e) {
    Logger.log('   ❌ Exception: ' + e.message);
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
    Logger.log('📦 Downloading ' + OTA_CONFIG.CLIENT_FILES.length + ' files');

    const files = [];

    for (let i = 0; i < OTA_CONFIG.CLIENT_FILES.length; i++) {
      const fileName = OTA_CONFIG.CLIENT_FILES[i];
      const content = downloadFileFromGithub_(fileName, isPublicRepo);

      if (!content) {
        Logger.log('❌ Failed: ' + fileName);
        return null;
      }

      let type = 'SERVER_JS';
      if (fileName.endsWith('.html')) type = 'HTML';
      if (fileName === 'appsscript.json') type = 'JSON';

      files.push({
        name: fileName,
        type: type,
        source: content,
      });
    }

    Logger.log('✅ Downloaded ' + files.length + ' files');
    return files;
  } catch (e) {
    Logger.log('❌ Error: ' + e.message);
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
    Logger.log('🔧 Updating client: ' + clientScriptId.substring(0, 12) + '...');

    const apiUrl = 'https://script.googleapis.com/v1/projects/' + clientScriptId + '/content';
    const oauthToken = ScriptApp.getOAuthToken();

    const resp = UrlFetchApp.fetch(apiUrl, {
      method: 'put',
      headers: {
        'Authorization': 'Bearer ' + oauthToken,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({files: files}),
      muteHttpExceptions: true,
    });

    if (resp.getResponseCode() !== 200) {
      Logger.log('   ❌ HTTP ' + resp.getResponseCode());
      return false;
    }

    Logger.log('   ✅ Updated successfully');
    return true;
  } catch (e) {
    Logger.log('❌ Error: ' + e.message);
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
  try {
    Logger.log('═══════════════════════════════════════════════════════════════');
    Logger.log('🚀 СЕРВЕР ОБНОВЛЯЕТ КЛИЕНТА');
    Logger.log('═══════════════════════════════════════════════════════════════');

    // ШАГ 1: СЕРВЕР проверяет лицензию
    Logger.log('\n📌 STEP 1: Checking license');
    const lic = checkLicense_(token, email, clientScriptId, spreadsheetId);

    if (!lic.ok) {
      Logger.log('❌ License FAILED: ' + lic.error);
      return {ok: false, error: 'LICENSE_FAILED'};
    }

    Logger.log('✅ License OK');

    // ШАГ 2: СЕРВЕР скачивает файлы с GitHub
    Logger.log('\n📌 STEP 2: Server downloading files from GitHub');
    const files = downloadAllClientFiles_(isPublicRepo);

    if (!files) {
      Logger.log('❌ Download FAILED');
      return {ok: false, error: 'DOWNLOAD_FAILED'};
    }

    Logger.log('✅ Downloaded ' + files.length + ' files');

    // ШАГ 3: СЕРВЕР обновляет клиента через API
    Logger.log('\n📌 STEP 3: Server updating client script');
    const updated = updateClientScript_(clientScriptId, files);

    if (!updated) {
      Logger.log('❌ Update FAILED');
      return {ok: false, error: 'UPDATE_FAILED'};
    }

    Logger.log('✅ Client updated');

    // ШАГ 4: Логирование
    serverLog_({
      action: 'OTA_SUCCESS',
      email: email,
      promptLen: 0,
      ms: 0,
    });

    Logger.log('═══════════════════════════════════════════════════════════════');
    Logger.log('🎉 CLIENT UPDATED!');
    Logger.log('═══════════════════════════════════════════════════════════════');

    return {
      ok: true,
      message: 'Updated',
      version: SERVER_VERSION,
    };
  } catch (e) {
    Logger.log('❌ FATAL: ' + e.message);
    return {ok: false, error: 'ERROR: ' + e.message};
  }
}

// ═══════════════════════════════════════════════════════════════
// END OF OTA_UPDATES.GS (СЕРВЕР)
// ═══════════════════════════════════════════════════════════════
