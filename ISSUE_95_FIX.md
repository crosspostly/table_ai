# Issue #95 Fix: prompt_table Configuration Error

## Problem Description

Issue #95 identified a critical bug in the `prompt_table` feature where the configuration could be saved or loaded incorrectly, leading to errors when executing AI transformations.

### Root Cause

The bug occurred in the `loadCollectConfig()` function in `CollectConfig.gs`. When loading a saved configuration:

1. If `systemPromptSheet === 'prompt_table'` but `systemPromptCell` was empty/null
2. The condition `systemPromptSheet === 'prompt_table' && systemPromptCell` would evaluate to FALSE
3. The code would fall through to the next condition and incorrectly create a `systemPrompt` object instead of a `prompt_table` object
4. This caused the prompt_table configuration to be lost and potentially return invalid data

### Example Scenario

```javascript
// Saved in ConfigData sheet:
// systemPromptSheet = 'prompt_table'
// systemPromptCell = '' (empty)

// OLD BEHAVIOR (BUGGY):
loadCollectConfig() returns:
{
  systemPrompt: {
    sheet: 'prompt_table',  // ❌ Wrong! Should be prompt_table object
    cell: ''
  },
  userData: [...]
}

// NEW BEHAVIOR (FIXED):
loadCollectConfig() returns:
{
  prompt_table: {
    cellAddress: ''  // ✅ Correct structure, validation will catch empty value
  },
  userData: [...]
}
```

## Changes Made

### 1. Fixed `loadCollectConfig()` in `CollectConfig.gs` (Line 330-351)

**Before:**
```javascript
if (systemPromptSheet === 'prompt_table' && systemPromptCell) {
  return { prompt_table: { cellAddress: systemPromptCell }, userData: userData };
}
```

**After:**
```javascript
if (systemPromptSheet === 'prompt_table') {
  // Если это prompt_table, всегда возвращаем prompt_table (даже если cellAddress пустой)
  return {
    prompt_table: {
      cellAddress: systemPromptCell || '',
    },
    userData: userData,
  };
}
```

**Why:** Always return a `prompt_table` object when the marker is 'prompt_table', even if cellAddress is empty. This preserves the configuration type and allows validation to catch the error.

### 2. Added Client-Side Validation in `CollectConfigUi.html` (Line 839-844)

**New Code:**
```javascript
// Проверка валидности prompt_table
if (config.prompt_table && !config.prompt_table.cellAddress) {
  showStatus('❌ Ошибка: prompt_table активен, но не указана ячейка!', 'error');
  addLogEntry('❌ Валидация не прошла: prompt_table без cellAddress', 'error');
  return;
}
```

**Why:** Explicitly validate that if `prompt_table` exists, it must have a non-empty `cellAddress`. This catches configuration errors before sending to server.

### 3. Enhanced Server-Side Validation in `server.gs` (Line 1365-1375)

**Before:**
```javascript
if (config && config.prompt_table && config.prompt_table.cellAddress) {
  // Process...
}
```

**After:**
```javascript
if (config && config.prompt_table) {
  // Проверяем, что cellAddress указан и не пустой
  if (!config.prompt_table.cellAddress || config.prompt_table.cellAddress.trim() === '') {
    const errorMsg = '❌ Ошибка: prompt_table активен, но cellAddress не указан или пустой!';
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: errorMsg,
    });
    throw new Error('prompt_table требует указания cellAddress (например, A2)');
  }
  // Process with cellAddress...
}
```

**Why:** 
- Separate check for prompt_table existence from cellAddress validation
- Provide clear error message when cellAddress is missing or empty
- Trim whitespace to catch " " (space-only) values

## Benefits

1. **Data Integrity:** Configuration type (prompt_table vs systemPrompt) is preserved correctly
2. **Clear Error Messages:** Users get explicit feedback when cellAddress is missing
3. **Defense in Depth:** Validation at multiple layers (client UI, runConfig, server)
4. **Backward Compatibility:** Existing systemPrompt configs continue to work
5. **Better Debugging:** Error logs clearly identify prompt_table validation issues

## Testing

All existing tests pass:
- ✅ 67 tests passed
- ✅ No breaking changes to existing APIs
- ✅ ESLint compliant

## Migration Path

No migration needed for existing users:
- ✅ Old systemPrompt configs work as before
- ✅ Corrupted prompt_table configs will now show clear error messages
- ✅ New prompt_table configs are validated correctly

## Edge Cases Handled

1. **Empty cellAddress:** Error thrown with clear message
2. **Whitespace-only cellAddress:** Trimmed and validated
3. **Mixed config (both systemPrompt and prompt_table):** prompt_table takes precedence
4. **Missing prompt_table object:** Falls back to systemPrompt check
5. **Load from corrupted ConfigData:** Always creates correct object structure

## Related Documentation

- Memory: prompt_table feature implementation details
- README.md: prompt_table usage examples
- server.gs: serverGetSystemPrompt_() documentation

---

**Fixed by:** AI Agent  
**Date:** 2025-12-10  
**Branch:** fix-issue-95-error  
**Status:** Ready for review and merge
