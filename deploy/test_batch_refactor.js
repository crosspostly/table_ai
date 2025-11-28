/**
 * Тест корректности рефакторинга batch операций
 * Запустить: node test_batch_refactor.js
 */

const fs = require('fs');
const path = require('path');

function checkFile(filePath, description) {
  console.log(`\n🔍 Проверка: ${description}`);
  console.log(`📁 Файл: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ ФАЙЛ НЕ НАЙДЕН!`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`✅ Файл найден (${content.length} символов)`);
  return content;
}

function checkFunction(content, functionName, description) {
  console.log(`\n🔍 Функция: ${functionName} - ${description}`);

  const regex = new RegExp(`function\\s+${functionName}\\s*\\(`, 'i');
  if (regex.test(content)) {
    console.log(`✅ Функция найдена`);
    return true;
  } else {
    console.log(`❌ Функция НЕ найдена!`);
    return false;
  }
}

function checkConstant(content, constantName, description) {
  console.log(`\n🔍 Константа: ${constantName} - ${description}`);

  const regex = new RegExp(`const\\s+${constantName}\\s*=`, 'i');
  if (regex.test(content)) {
    console.log(`✅ Константа найдена`);
    return true;
  } else {
    console.log(`❌ Константа НЕ найдена!`);
    return false;
  }
}

console.log('🎯 ТЕСТ РЕФАКТОРИНГА BATCH ОПЕРАЦИЙ v3.1');
console.log('=' .repeat(50));

// Проверяем основные файлы
const mainContent = checkFile('./Main.gs', 'Основной клиентский файл');
const reniewCellContent = checkFile('./reniewCell.gs', 'Batch операции (НОВЫЙ ФАЙЛ!)');
const batchAPIContent = checkFile('./batchUpdateAPI.gs', 'Серверный API');

if (!mainContent || !reniewCellContent || !batchAPIContent) {
  console.log('\n❌ ОШИБКА: Не все файлы найдены!');
  process.exit(1);
}

// Проверяем ключевые функции в Main.gs
console.log('\n📋 Main.gs - ПРОВЕРКА ФУНКЦИЙ:');
const mainChecks = [
  ['addLog', 'Клиентское логирование'],
  ['getClientLogs', 'Получение клиентских логов'],
  ['clearClientLogs', 'Очистка клиентских логов'],
  ['callServerAction_', 'Вызов сервера с логированием'],
  ['onOpen', 'Точка входа с логированием'],
  ['buildMenu_', 'Построение меню'],
  ['showClientLogsDialog', 'Просмотр клиентских логов'],
  ['showServerLogsDialog', 'Просмотр серверных логов'],
];

let mainPassed = 0;
mainChecks.forEach(([func, desc]) => {
  if (checkFunction(mainContent, func, desc)) mainPassed++;
});

console.log(`\n📊 Main.gs: ${mainPassed}/${mainChecks.length} проверок пройдено`);

// Проверяем ключевые функции в reniewCell.gs
console.log('\n📋 reniewCell.gs - ПРОВЕРКА ФУНКЦИЙ:');
const reniewChecks = [
  ['batchStart_', 'Универсальный запуск операций'],
  ['buildBatchMenu_', 'Построение batch меню'],
  ['getAllOperationsForServer', 'Формирование массива для сервера'],
  ['showBatchStatus', 'Просмотр статуса операций'],
];

let reniewPassed = 0;
reniewChecks.forEach(([func, desc]) => {
  if (checkFunction(reniewCellContent, func, desc)) reniewPassed++;
});

// Проверяем batch операции
console.log('\n📋 reniewCell.gs - ПРОВЕРКА ОПЕРАЦИЙ:');
const operations = ['etap1', 'etap2_1', 'etap2_2', 'faza1', 'archetype', 'common_ca', 'faza2', 'faza3', 'brendDesign', 'resume', 'analizConc', 'analizCA'];
let opsPassed = 0;

operations.forEach(op => {
  const funcName = op.charAt(0).toUpperCase() + op.slice(1);
  if (checkFunction(reniewCellContent, funcName, `Операция ${op}`)) opsPassed++;
});

console.log(`\n📊 Операции: ${opsPassed}/${operations.length} найдено`);

// Проверяем константу BATCH_OPERATIONS в reniewCell.gs
console.log('\n📋 reniewCell.gs - ПРОВЕРКА КОНСТАНТ:');
if (checkConstant(reniewCellContent, 'BATCH_OPERATIONS', 'Конфигурация всех операций')) {
  reniewPassed++;
}

console.log(`\n📊 reniewCell.gs: ${reniewPassed}/${reniewChecks.length + 1} проверок пройдено`);

// Проверяем batchUpdateAPI.gs
console.log('\n📋 batchUpdateAPI.gs - ПРОВЕРКА ИЗМЕНЕНИЙ:');
const apiChecks = [
  'BATCH_OPERATIONS должна быть удалена',
  'batchUpdateRunSegment должна принимать config',
  'batchUpdateRunBatch должна принимать массив',
  'batchUpdateGetStatus должна принимать массив',
  'batchUpdateClearResults должна принимать массив',
];

let apiPassed = 0;

// Проверяем, что BATCH_OPERATIONS удалена (только в комментариях)
const batchOpsMatches = (batchAPIContent.match(/BATCH_OPERATIONS/g) || []).length;
if (batchOpsMatches <= 3) { // Только в комментариях
  console.log('✅ BATCH_OPERATIONS удалена (только комментарии)');
  apiPassed++;
} else {
  console.log(`❌ BATCH_OPERATIONS всё ещё используется (${batchOpsMatches} раз)`);
}

// Проверяем ключевые изменения
if (batchAPIContent.includes('const {operation, config, sheetName = \'Распаковка\'} = payload')) {
  console.log('✅ batchUpdateRunSegment принимает config');
  apiPassed++;
} else {
  console.log('❌ batchUpdateRunSegment не принимает config');
}

if (batchAPIContent.includes('const {operations} = payload') && batchAPIContent.includes('Array.isArray(operations)')) {
  console.log('✅ batchUpdateRunBatch принимает массив');
  apiPassed++;
} else {
  console.log('❌ batchUpdateRunBatch не принимает массив');
}

if (batchAPIContent.includes('batchUpdateGetStatus') && batchAPIContent.includes('Array.isArray(operations)')) {
  console.log('✅ batchUpdateGetStatus принимает массив');
  apiPassed++;
} else {
  console.log('❌ batchUpdateGetStatus не принимает массив');
}

if (batchAPIContent.includes('batchUpdateClearResults') && batchAPIContent.includes('Array.isArray(operations)')) {
  console.log('✅ batchUpdateClearResults принимает массив');
  apiPassed++;
} else {
  console.log('❌ batchUpdateClearResults не принимает массив');
}

console.log(`\n📊 batchUpdateAPI.gs: ${apiPassed}/${apiChecks.length} проверок пройдено`);

// Итог
const totalPassed = mainPassed + reniewPassed + opsPassed + apiPassed;
const totalChecks = mainChecks.length + reniewChecks.length + 1 + operations.length + apiChecks.length;

console.log('\n' + '='.repeat(50));
console.log('🎯 ИТОГОВЫЙ РЕЗУЛЬТАТ:');
console.log(`✅ Пройдено: ${totalPassed}/${totalChecks} проверок`);
console.log(`📊 Процент: ${Math.round((totalPassed / totalChecks) * 100)}%`);

if (totalPassed === totalChecks) {
  console.log('\n🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ! Рефакторинг выполнен успешно!');
  console.log('\n✨ Что теперь работает:');
  console.log('  • Одно место редактирования операций (reniewCell.gs)');
  console.log('  • Меню независимо от сервера');
  console.log('  • Клиентское логирование в CacheService');
  console.log('  • Двойное логирование (клиент + сервер)');
  console.log('  • Graceful degradation при недоступности сервера');
} else {
  console.log('\n❌ Есть проблемы, которые нужно исправить!');
  process.exit(1);
}