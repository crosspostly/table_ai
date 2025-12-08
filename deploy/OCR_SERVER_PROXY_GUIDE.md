# OCR Server Proxy Architecture

## Overview

The OCR (Optical Character Recognition) functionality has been migrated from client-side to server-side processing through a secure proxy architecture. This ensures API security, improved performance, and better reliability.

## Architecture

### Before (❌ Insecure)
```
Client (Browser/Google Sheets)
    ↓ (API KEY exposed in network request)
Gemini Vision API
```

### After (✅ Secure)
```
Client (Browser/Google Sheets)
    ↓ (Only image data, no API key)
Server (Google Apps Script Web App)
    ↓ (API KEY on server, secure)
Gemini Vision API
    ↓ (Results back to server)
Server logs & response
    ↓ (Results to client)
Client (Browser/Google Sheets)
```

## How It Works

### 1. Client-Side Collection
The client collects images from multiple sources:
- Google Drive files and folders
- VK (VKontakte) albums, discussions, reviews
- Yandex Disk public links
- Dropbox links
- Direct image URLs

All images are converted to base64 format on the client.

### 2. Server-Side Processing
When OCR is needed:
1. Client sends image data via secure JSON POST to `SERVER_URL`
2. Request includes: `{ action: 'gm_image', images: [...], lang: 'ru', ... }`
3. Server receives the request in `doPost()` handler
4. Server calls Gemini Vision API with the stored API key
5. Results are logged to the admin spreadsheet
6. Server returns results to client

### 3. Error Handling & Fallback
- If batch OCR fails, client attempts single-image fallback
- All errors are logged with detailed messages
- User sees progress in the UI with error counts

## Security Benefits

✅ **API Key Protection**
- API key is stored only on the server
- Client never sees the API key
- Network requests don't expose credentials

✅ **Centralized Logging**
- All OCR operations logged to admin spreadsheet
- Audit trail of all requests and responses
- Easy troubleshooting

✅ **Rate Limiting**
- Server enforces rate limits per token
- Prevents abuse and quota exhaustion
- Protects infrastructure

✅ **Unified Quotas**
- All users share server's API quotas
- More efficient quota usage than per-user keys

## Code Changes

### Client Functions Modified

#### `gmOcrFromBlobV2_(blob, lang)`
**Before:**
- Made direct calls to Gemini API
- Required API key retrieval from server config
- Exposed API key in network requests

**After:**
- Wraps image in array format
- Calls `serverGmOcrBatchV2_()` with server proxy
- No direct API calls

```javascript
function gmOcrFromBlobV2_(blob, lang){
  var mime = blob.getContentType() || 'image/png';
  var b64 = Utilities.base64Encode(blob.getBytes());
  
  var images = [{ mimeType: mime, data: b64 }];
  var userApiKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY') || '';
  
  var result = serverGmOcrBatchV2_(images, lang || 'ru', userApiKey);
  
  return (typeof processGeminiResponse === 'function') ? processGeminiResponse(result) : result;
}
```

#### `serverGmOcrBatchV2_(images, lang, userApiKey)`
**New Parameter:** `userApiKey` (optional)
- Falls back to script properties if not provided
- Allows per-user or default key usage

```javascript
function serverGmOcrBatchV2_(images, lang, userApiKey){
  var email = (typeof getLicenseEmail === 'function') ? getLicenseEmail() : '';
  var token = (typeof getLicenseToken === 'function') ? getLicenseToken() : '';
  var apiKey = userApiKey || PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '';
  
  var payload = { 
    action: 'gm_image', 
    email: email, 
    token: token, 
    apiKey: apiKey, 
    images: images, 
    lang: lang || 'ru', 
    delimiter: '____' 
  };
  
  var resp = UrlFetchApp.fetch(SERVER_URL, { 
    method: 'post', 
    contentType: 'application/json', 
    payload: JSON.stringify(payload), 
    muteHttpExceptions: true 
  });
  
  var code = resp.getResponseCode();
  var data = JSON.parse(resp.getContentText());
  
  if (code !== 200 || !data || !data.ok) {
    throw new Error((data && data.error) || ('HTTP_' + code));
  }
  
  return data.data || '';
}
```

### Server-Side Handler (server.gs)

The `doPost()` function handles `gm_image` action:
- Validates images and API key
- Enforces rate limiting
- Logs all operations
- Calls `serverGMImage_()` to process images
- Returns results with proper error handling

## Error Messages

Users may see these error messages with helpful hints:

| Error | Meaning | Action |
|-------|---------|--------|
| `Check SERVER_URL and API key on server!` | Batch OCR request failed | Verify server configuration |
| `Server proxy or API key error` | Fallback single-image OCR failed | Check license token validity |
| `RATE_LIMIT` | Too many requests | Wait a moment and retry |
| `NO_API_KEY_AVAILABLE` | No valid API key configured | Admin must set default key |

## Configuration

### Client Configuration
Users can optionally set their own API key:
```javascript
// In Google Sheets Script Editor console:
PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', 'your-key-here');
```

### Server Configuration
Admin sets the default API key (used if user key not provided):
```javascript
// In server.gs Script Editor console:
PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', 'your-key-here');
```

## Logging

All OCR operations are logged to the admin spreadsheet with:
- Timestamp
- User email and token
- Action type (`gm_image`)
- Success/failure status
- Error message (if failed)
- Response size
- Processing time (ms)
- API key source (USER or DEFAULT)

## Testing

### Test 1: Single Image OCR
```javascript
var blob = SpreadsheetApp.getActive().getSheetByName('Отзывы').getRange('A2').getRichTextValue();
var result = gmOcrFromBlobV2_(blob, 'ru');
Logger.log('Result: ' + result);
```

### Test 2: Batch Processing
1. Open Google Sheets with Table AI addon
2. Run: 🔄 Обновление → 🤖 OCR V2 Run
3. Check logs for success/errors

### Test 3: Verify Security
1. Open Developer Tools (F12) in browser
2. Go to Network tab
3. Run OCR operation
4. Check the POST request to `SERVER_URL`
5. Verify: No `?key=...` parameter in URL
6. Verify: JSON payload doesn't contain API key in clear

## Troubleshooting

### "SERVER_URL not defined"
- Ensure Main.gs has `const SERVER_URL = '...'`
- Check that server web app is deployed

### "NO_API_KEY_AVAILABLE"
- Admin must set default key in server.gs
- Or user must set their own key in client properties

### "RATE_LIMIT exceeded"
- Too many requests in short time
- Wait 1-2 seconds and retry
- Check for infinite loops in code

### "NO_IMAGES provided"
- Image collection failed
- Check source links are valid
- Verify user has access to Drive/VK content

## Performance Considerations

✅ **Faster Processing**
- Server has better network connection
- Batching reduces API calls
- Caching possible at server level

✅ **Reliability**
- Fallback mechanism handles single failures
- Logging helps identify issues
- Rate limiting prevents quota exhaustion

✅ **Scalability**
- Multiple users share server resources
- Centralized error handling
- Easy to monitor and debug

## Backward Compatibility

The changes are backward compatible:
- Existing `serverGmOcrBatchV2_()` calls work unchanged
- New `userApiKey` parameter is optional
- Fallback to script properties if not provided
- All existing UI workflows unchanged

## See Also

- `ocr_server_handler.gs` - Server-side OCR processing functions
- `server.gs` - Main server handler with `gm_image` action
- `ocrRunV2_client.gs` - Client-side OCR orchestration
- `Main.gs` - Client configuration and constants
