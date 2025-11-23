#!/usr/bin/env node
/**
 * ТОЧНАЯ ПРОВЕРКА СИНТАКСИСА - парсим как JavaScript
 */

const fs = require('fs');
const vm = require('vm');

const files = [
  'deploy/Main.gs',
  'deploy/server.gs',
  'deploy/CollectConfig.gs',
  'deploy/VK.gs',
  'deploy/UnpackingViewer.gs',
  'deploy/TemplateService.gs',
  'deploy/ocrRunV2_client.gs',
  'deploy/reniewcell.gs'
];

console.log('🔍 ПРОВЕРКА СИНТАКСИСА ЧЕРЕЗ NODE.JS VM\n');

files.forEach(file => {
  console.log(`📁 ${file}...`);
  
  if (!fs.existsSync(file)) {
    console.log(`   ❌ Файл не найден\n`);
    return;
  }
  
  const content = fs.readFileSync(file, 'utf8');
  
  try {
    // Пытаемся создать Script объект - это проверит синтаксис
    new vm.Script(content, { filename: file });
    console.log(`   ✅ СИНТАКСИС ПРАВИЛЬНЫЙ\n`);
  } catch (error) {
    console.log(`   ❌ SYNTAX ERROR:`);
    console.log(`   Line: ${error.stack.split(':')[1]}`);
    console.log(`   Error: ${error.message}`);
    console.log('');
  }
});
