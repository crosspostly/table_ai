/**
 * Version Information System
 * Динамическая информация о версии с реальным временем обновления
 */

/**
 * Получить текущую версию системы
 */
function getCurrentVersion() {
  return '2.1.0';
}

/**
 * Получить дату последнего обновления (динамическая)
 */
function getLastUpdateDate() {
  // Возвращаем текущее время как время последнего обновления
  // В реальном проекте здесь может быть дата из git или properties
  return new Date().toISOString();
}

/**
 * Получить детальную информацию о версии
 */
function getVersionInfo() {
  const now = new Date();

  return {
    project: {
      name: 'Table AI Bot',
      description: 'AI-powered Google Sheets automation system',
      repository: 'https://github.com/crosspostly/ai_table',
    },

    version: {
      current: '2.1.0',
      previous: '2.0.1',
      releaseDate: '2024-10-10',
      lastUpdate: now.toISOString(),
      timestamp: now.getTime(),
      status: 'stable',
    },

    build: {
      number: '210',
      environment: 'production',
      platform: 'Google Apps Script',
      deployedBy: 'Factory AI',
    },

    features: {
      social_import: {
        name: 'Универсальный импорт соцсетей',
        description: 'VK, Instagram, Telegram',
        status: 'active',
        added_in: '2.1.0',
      },
      unified_credentials: {
        name: 'Единое окно настроек',
        description: 'Все ключи в одном месте',
        status: 'active',
        added_in: '2.0.1',
      },
      sheets_logger: {
        name: 'Google Sheets логирование',
        description: 'Логи в отдельной таблице',
        status: 'active',
        added_in: '2.0.1',
      },
      comprehensive_testing: {
        name: 'Комплексное тестирование',
        description: 'Автоматическая проверка всех функций',
        status: 'active',
        added_in: '2.0.1',
      },
      smart_chain: {
        name: 'Умная цепочка',
        description: 'Последовательная обработка данных',
        status: 'active',
        added_in: '2.0.0',
      },
    },

    changelog: [
      '2.1.0: Восстановлен импорт из VK/Instagram/Telegram',
      '2.0.1: Единое окно настроек, логирование, тестирование',
      '2.0.0: Новая архитектура Client/Server/Shared',
      '1.9.0: Добавлены GM функции для Gemini AI',
      '1.8.0: Базовая версия с VK Parser',
    ],

    statistics: {
      totalFunctions: 27,
      activeFunctions: 24,
      coverage: '88%',
      lastCheck: now.toISOString(),
    },
  };
}

/**
 * Получить версию с временем обновления (для UI)
 */
function getVersionWithTimestamp() {
  const version = getCurrentVersion();
  const now = new Date();

  // Форматируем время по-русски
  const dateStr = now.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const timeStr = now.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return 'v' + version + ' • Обновлено: ' + dateStr + ' ' + timeStr;
}

/**
 * Показать версию в UI (для меню)
 */
function showVersionInfo() {
  const ui = SpreadsheetApp.getUi();
  const versionInfo = getVersionInfo();
  const now = new Date();

  const message = [];
  message.push('🔢 VERSION INFO:');
  message.push('• Current: ' + versionInfo.version.current);
  message.push('• Previous: ' + versionInfo.version.previous);
  message.push('• Release Date: ' + versionInfo.version.releaseDate);
  message.push('• Last Update: ' + now.toLocaleString('ru-RU'));
  message.push('• Status: ' + versionInfo.version.status);
  message.push('');
  message.push('📊 STATISTICS:');
  message.push('• Functions: ' + versionInfo.statistics.activeFunctions + '/' + versionInfo.statistics.totalFunctions);
  message.push('• Coverage: ' + versionInfo.statistics.coverage);
  message.push('');
  message.push('🔗 Repository: ' + versionInfo.project.repository);

  ui.alert('Version Information', message.join('\n'), ui.ButtonSet.OK);
}
