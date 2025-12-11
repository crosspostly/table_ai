// Table AI Server (Apps Script Web App)
// Backend: лицензии, прокси к Gemini с КЛЮЧОМ КЛИЕНТА, серверные логи
/* exported checkServerAutoUpdate_, setupServerTriggers */

// ===== Constants =====
const S_GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
const LOG_SHEET_NAME = 'Логи';
const RATE_LIMIT_PER_SEC = 3; // max запросов/сек на токен
const AUTO_UPDATE_CHECK_INTERVAL = 6;

// ⭐ OTA UPDATES
const SERVER_VERSION = '3.5.2';

// ⭐ LICENSE SHEET ID (для prompt_table)
const LICENSE_SHEET_ID = '1u9rNx0Zwk4Y1cKHiquwu2jH3elpX7VUSJVgkq_Tb3-s';
const TOKENS_SHEET_NAME = 'Tokens';
const BINDINGS_SHEET_NAME = 'Bindings';

// ⭐ Triple Rate Limiting Configuration (Google AI Studio Free Tier)
const TRIPLE_RATE_LIMITS = {
  // Requests Per Day (КРИТИЧНЫЙ - самый жёсткий)
  MAX_RPD: 20,
  MAX_RPD_WARNING: 15, // 75%

  // Requests Per Minute
  MAX_RPM: 10,
  MAX_RPM_WARNING: 8, // 80%

  // Tokens Per Minute
  MAX_TPM: 250000,
  MAX_TPM_WARNING: 200000, // 80%

  // API Keys Management
  API_KEYS_SHEET_NAME: 'api_gem',
  TOTAL_KEYS: 6,
  TOTAL_RPD: 120, // 6 × 20
};