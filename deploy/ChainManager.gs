/**
 * ChainManager.gs - Управление цепочками формул
 * Версия: 1.0.0
 *
 * ЗАВИСИМОСТИ:
 * - LoggingService.gs: addLog()
 * - UtilsAndTriggers.gs: columnToLetter(), parseTargetA1(), getCompletionPhrase()
 *
 * Функции:
 * - prepareChainSmart() - умная подготовка цепочки
 * - prepareChainFromPromptBox() - подготовка из Prompt_box
 * - prepareChainForA3() - подготовка для A3
 * - clearChainForA3() - очистка цепочки A3
 * - refreshCurrentGMCell() - обновление текущей GM ячейки
 */

// ====== ОСНОВНЫЕ ФУНКЦИИ УПРАВЛЕНИЯ ЦЕПОЧКАМИ ======
/* eslint-disable-next-line no-unused-vars */
/* eslint-disable-next-line no-unused-vars */
function prepareChainSmart() {
  const ss = SpreadsheetApp.getActive();
  const prompt = ss.getSheetByName('Prompt_box');
  let hasTargets = false;
  if (prompt) {
    const lastRow = Math.max(2, prompt.getLastRow());
    const vals = prompt.getRange(2, 2, lastRow - 1, 1).getDisplayValues(); // B2:B
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][0] || '').trim()) {
        hasTargets = true; break;
      }
    }
  }
  if (hasTargets) {
    prepareChainFromPromptBox();
  } else {
    prepareChainForA3();
  }
}

/* eslint-disable-next-line no-unused-vars */
function prepareChainFromPromptBox() {
  const ss = SpreadsheetApp.getActive();
  const prompt = ss.getSheetByName('Prompt_box');
  const pack = ss.getSheetByName('Распаковка');
  if (!prompt) {
    SpreadsheetApp.getUi().alert('Ошибка', 'Лист "Prompt_box" не найден', SpreadsheetApp.getUi().ButtonSet.OK); return;
  }
  if (!pack) {
    SpreadsheetApp.getUi().alert('Ошибка', 'Лист "Распаковка" не найден', SpreadsheetApp.getUi().ButtonSet.OK); return;
  }

  const lastRow = Math.max(2, prompt.getLastRow());
  const targets = prompt.getRange(2, 2, lastRow - 1, 1).getDisplayValues(); // B2:B — ячейка назначения
  const mappings = [];
  for (let r = 2; r <= lastRow; r++) {
    const targetStr = String(targets[r - 2][0] || '').trim();
    if (!targetStr) continue;
    try {
      const parsed = parseTargetA1(targetStr);
      mappings.push({promptRow: r, targetRow: parsed.row, targetCol: parsed.col, targetA1: parsed.a1});
    } catch (e) {
      addLog('⚠️ Пропуск строки Prompt_box!B' + r + ': ' + e.message, 'WARN');
    }
  }

  if (!mappings.length) {
    SpreadsheetApp.getUi().alert('Информация', 'Нет целевых ячеек в Prompt_box!B, ничего не сделано.', SpreadsheetApp.getUi().ButtonSet.OK); return;
  }

  const phrase = getCompletionPhrase() || COMPLETION_PHRASE;
  const phraseEscaped = phrase.replace(/"/g, '""');

  for (let i = 0; i < mappings.length; i++) {
    const m = mappings[i];
    let cond;
    if (i === 0) {
      // Всегда якорь от A3
      cond = '$A3<>""';
    } else {
      const prev = mappings[i - 1];
      cond = 'LEFT(' + prev.targetA1 + ', LEN("' + phraseEscaped + '"))="' + phraseEscaped + '"';
    }
    const formula = '=GM_IF(' + cond + ', Prompt_box!$F$' + m.promptRow + ', 25000, 0.7)';
    pack.getRange(m.targetRow, m.targetCol).setFormula(formula);
    addLog('📝 Формула установлена → Распаковка!' + m.targetA1 + ' из Prompt_box!F' + m.promptRow, 'INFO');
  }

  SpreadsheetApp.getUi().alert('✅ Готово: формулы расставлены по целям из Prompt_box!B.\\n' +
    'Первая ячейка запустится при заполнении соответствующего A-столбца, далее — по фразе готовности.');
}

/* eslint-disable-next-line no-unused-vars */
function prepareChainForA3() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('Распаковка');
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Ошибка', 'Лист "Распаковка" не найден', SpreadsheetApp.getUi().ButtonSet.OK); return;
  }
  const row = 3;
  const startCol = 2; // B
  const steps = 6; // B..G
  const endCol = startCol + steps - 1;
  const phrase = getCompletionPhrase() || COMPLETION_PHRASE;
  const phraseEscaped = phrase.replace(/"/g, '""');

  for (let col = startCol; col <= endCol; col++) {
    const stepIndex = col - 1; // B=1 -> шаг 1
    const promptRow = stepIndex + 1; // шаг 1 -> F2 ... шаг 6 -> F7
    const target = sheet.getRange(row, col);
    const promptRef = 'Prompt_box!$F$' + promptRow;
    let formula;
    if (col === 2) {
      formula = '=GM_IF($A3<>"", ' + promptRef + ', 25000, 0.7)';
    } else {
      const prevColLetter = columnToLetter(col - 1);
      formula = '=GM_IF(LEFT(' + prevColLetter + '3, LEN("' + phraseEscaped + '"))="' + phraseEscaped + '", ' + promptRef + ', 25000, 0.7)';
    }
    target.setFormula(formula);
    addLog('📝 Формула ' + target.getA1Notation() + ' установлена', 'DEBUG');
  }
  SpreadsheetApp.getUi().alert('Готово', '✅ Готово: формулы B3..G3 проставлены.\nЗаполните A3 — шаги пойдут по очереди.', SpreadsheetApp.getUi().ButtonSet.OK);
}

/* eslint-disable-next-line no-unused-vars */
/* eslint-disable-next-line no-unused-vars */
function clearChainForA3() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('Распаковка');
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Ошибка', 'Лист "Распаковка" не найден', SpreadsheetApp.getUi().ButtonSet.OK); return;
  }
  sheet.getRange(3, 2, 1, 6).clearContent(); // B3..G3
  SpreadsheetApp.getUi().alert('Информация', '🧹 Очищено: B3..G3', SpreadsheetApp.getUi().ButtonSet.OK);
}

// ====== ОБНОВЛЕНИЕ GM ЯЧЕЕК ======
/* eslint-disable-next-line no-unused-vars */
/* eslint-disable-next-line no-unused-vars */
function refreshCurrentGMCell() {
  try {
    const ss = SpreadsheetApp.getActive();
    const range = ss.getActiveRange();
    if (!range) {
      SpreadsheetApp.getUi().alert('Информация', 'Выберите ячейку на листе "Распаковка"', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    const cell = range.getCell(1, 1);
    const sheet = cell.getSheet();
    if (sheet.getName() !== 'Распаковка') {
      SpreadsheetApp.getUi().alert('Информация', 'Выберите ячейку на листе "Распаковка"', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    const row = cell.getRow();
    const col = cell.getColumn();

    let formula = cell.getFormula();
    const hasGm = formula && (/^\s*=\s*GM_IF\s*\(/i.test(formula) || /\bGM\s*\(/i.test(formula));
    if (!hasGm) {
      // Попробуем найти соответствие этой ячейки в Prompt_box!B (умный режим)
      const promptSheet = ss.getSheetByName('Prompt_box');
      if (promptSheet) {
        const lastRow = Math.max(2, promptSheet.getLastRow());
        const targets = promptSheet.getRange(2, 2, lastRow - 1, 1).getDisplayValues(); // B2:B
        const mappings = [];
        for (let r = 2; r <= lastRow; r++) {
          const tstr = String(targets[r - 2][0] || '').trim();
          if (!tstr) continue;
          try {
            const parsed = parseTargetA1(tstr);
            mappings.push({promptRow: r, targetA1: parsed.a1, targetRow: parsed.row, targetCol: parsed.col});
          } catch (e) {}
        }
        if (mappings.length) {
          const currentA1 = columnToLetter(col) + row;
          let idx = -1;
          for (let i = 0; i < mappings.length; i++) {
            if (mappings[i].targetA1 === currentA1) {
              idx = i; break;
            }
          }
          if (idx >= 0) {
            const phrase = getCompletionPhrase() || COMPLETION_PHRASE;
            const phraseEscaped = phrase.replace(/"/g, '""');
            let cond;
            if (idx === 0) {
              cond = '$A3<>""';
            } else {
              const prev = mappings[idx - 1];
              cond = 'LEFT(' + prev.targetA1 + ', LEN("' + phraseEscaped + '"))="' + phraseEscaped + '"';
            }
            const promptRef = 'Prompt_box!$F$' + mappings[idx].promptRow;
            formula = '=GM_IF(' + cond + ', ' + promptRef + ', 25000, 0.7)';
          }
        }
      }
    }
    if (!formula) {
      SpreadsheetApp.getUi().alert('Информация', 'Нечего обновлять: в ячейке нет GM-формулы и нет соответствия в Prompt_box!B', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }

    cell.clearContent();
    SpreadsheetApp.flush();
    Utilities.sleep(50);
    cell.setFormula(formula);
    SpreadsheetApp.flush();
    addLog('🔁 Обновлена ячейка ' + cell.getA1Notation(), 'INFO');
  } catch (e) {
    addLog('❌ Ошибка обновления ячейки: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка: ' + e.message);
  }
}

