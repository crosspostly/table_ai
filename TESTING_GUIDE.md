# Table AI - Logging & API Key Priority Testing Guide

## Overview
This document provides step-by-step testing instructions for the comprehensive logging and API key priority system implementation.

## Key Features Implemented

### 1. Comprehensive Logging
- **Client-side**: All major operations logged with `Logger.log()` and `addLog()`
- **Server-side**: Detailed logging for all API calls, license checks, and errors
- **Request/Response tracking**: Full payload logging (with sensitive data masked)
- **Performance monitoring**: Request timing and processing duration

### 2. API Key Priority System
- **Priority 1**: User-provided API key (stored in UserProperties)
- **Priority 2**: Default API key (stored in ScriptProperties)
- **Fallback**: Clear error messages when no keys are available

### 3. Enhanced Error Handling
- **License validation**: Proper blocking with informative error messages
- **API key validation**: Clear errors for missing/invalid keys
- **Rate limiting**: Proper handling with user-friendly messages

## Testing Scenarios

### Scenario 1: User API Key Priority Test
**Goal**: Verify user API key takes precedence over default key

**Steps**:
1. Set a default API key in ScriptProperties
2. Set a user API key via Settings UI
3. Make a GM request
4. Check logs for "Using USER API key"

**Expected Results**:
- Client logs show user API key being used
- Server logs show `keySource: USER`
- Response successful with user's API key

### Scenario 2: Default API Key Fallback Test
**Goal**: Verify default API key is used when no user key exists

**Steps**:
1. Set only default API key in ScriptProperties
2. Clear user API key via Settings UI (leave blank)
3. Make a GM request
4. Check logs for "Using DEFAULT API key"

**Expected Results**:
- Client logs show default API key being used
- Server logs show `keySource: DEFAULT`
- Response successful with default API key

### Scenario 3: License Validation Test
**Goal**: Verify proper license blocking and error messages

**Steps**:
1. Use invalid/missing license credentials
2. Attempt to make a GM request
3. Check error response and logs

**Expected Results**:
- Request blocked with 403 status
- Clear error message about license issue
- Server logs show "License check FAILED"

### Scenario 4: No API Key Error Test
**Goal**: Verify proper error handling when no API keys are available

**Steps**:
1. Remove both user and default API keys
2. Attempt to make a GM request
3. Check error response and logs

**Expected Results**:
- Request blocked with 400 status
- Clear error message "NO_API_KEY_AVAILABLE"
- Server logs show "No API key available"

## Log Locations

### Client Logs
- **Apps Script Logger**: Viewable in Apps Script Editor → Executions → Logs
- **Custom Logs**: Via `showLogsDialog()` or `getLogs()`
- **Settings**: All save/load operations logged

### Server Logs
- **Apps Script Logger**: Server-side logs in server Apps Script
- **Spreadsheet Logs**: Automatically logged to "Логи" sheet in license spreadsheet
- **Request Tracking**: Full request/response cycle with timing

## Log Message Patterns

### Client-Side
```
=== saveSettingsData START ===
data.apiKey: SET (user provided)
✅ User API key saved, length: 39
=== serverGM START ===
Using USER API key, length: 39
```

### Server-Side
```
=== doPost START ===
action: gm
apiKey: SET (length: 39)
License check PASSED
Using USER API key, length: 39
=== serverGM_ START ===
Gemini API success, response length: 1250
```

## Troubleshooting

### Common Issues
1. **API Key Not Working**: Check key length and format in logs
2. **License Errors**: Verify email/token match license spreadsheet
3. **Rate Limiting**: Check `keySource` and token in logs
4. **Missing Logs**: Ensure `Logger.log()` calls are present

### Debug Commands
```javascript
// Check current settings
getSettingsData()

// View recent logs
getLogs(50)

// Test server status
serverStatus()
```

## Validation Checklist

- [ ] User API key takes priority over default
- [ ] Default API key used when no user key
- [ ] Clear error when no API keys available
- [ ] License validation blocks invalid requests
- [ ] All operations properly logged
- [ ] Server logs include `keySource` field
- [ ] Client logs show API key source
- [ ] Error messages are user-friendly
- [ ] Performance timing is tracked

## Implementation Notes

### Security Considerations
- API keys are masked in logs (showing only length)
- Tokens are masked in spreadsheet logs
- Sensitive data never fully logged

### Performance Impact
- Logging adds minimal overhead
- Cache-based log rotation prevents memory issues
- Async logging where possible

### Maintenance
- Logs auto-rotate based on configured limits
- Error patterns easily searchable
- Performance metrics available for optimization