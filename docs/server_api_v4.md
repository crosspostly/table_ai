# Table AI Server API v4 Specification

## Overview

This document defines the v4 server API for Table AI, establishing the "thick server" contract that enables gradual migration of client-side functionality to server-side operations. The API supports version negotiation, capabilities discovery, and phased rollout of features.

## Version Information

- **API Version**: 4.0.0
- **Client Version**: 4.0.0
- **Minimum Compatible Client Version**: 3.0.0
- **Server Version**: 4.0.0

## Core Concepts

### Version Negotiation
- Clients must perform capabilities handshake before using any server features
- Server advertises supported actions, version compatibility, and feature flags
- Clients can gracefully degrade when server capabilities are insufficient

### Authentication & Authorization
- All actions except `status`, `validate`, and `capabilities` require valid license
- License validation uses token, email, scriptId, and spreadsheetId
- Rate limiting applies per token

### Request/Response Format
All requests use POST with JSON payload:
```json
{
  "action": "string",
  "token": "string",
  "email": "string", 
  "scriptId": "string",
  "spreadsheetId": "string",
  "apiKey": "string (optional)",
  "data": "object (action-specific)"
}
```

Standard response format:
```json
{
  "ok": boolean,
  "data": "object (success case)",
  "error": "string (error case)",
  "logs": "array (optional)"
}
```

## Endpoints

### 1. Capabilities Discovery
**Action**: `capabilities`

**Purpose**: Server capabilities negotiation and version discovery

**Request**:
```json
{
  "action": "capabilities",
  "clientVersion": "string (optional)"
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "serverVersion": "4.0.0",
    "minClientVersion": "3.0.0",
    "supportedActions": [
      "capabilities", "status", "validate", "gm", "gm_image",
      "collect_config_preview", "collect_config_execute",
      "ocr_batch", "ocr_single", "unpacking_read", "unpacking_export",
      "vk_import", "batch_update"
    ],
    "featureFlags": {
      "serverSideCollectConfig": true,
      "serverSideOcr": true,
      "serverSideUnpackingViewer": true,
      "serverSideVkImport": false,
      "serverSideBatchUpdate": false,
      "enhancedLogging": true,
      "rateLimitingV2": false
    },
    "menuEntries": [
      {
        "id": "collect_config",
        "name": "🎯 AI Конструктор",
        "serverSide": true,
        "clientFunction": "openCollectConfigUI"
      },
      {
        "id": "ocr_run", 
        "name": "📸 OCR Обработка",
        "serverSide": false,
        "clientFunction": "ocrRun"
      }
    ],
    "endpoints": {
      "primary": "https://script.google.com/macros/s/AKfycbyyUlB5YWP4bwv3gHHniTv_12cAHlqjYfra7fQ3m3Vri5XvZTQ_uUZZovCYeTo2_u6gQw/exec",
      "fallback": null
    }
  }
}
```

**Logging Expectations**: Log capabilities request with client version, response time, and any compatibility warnings

### 2. License Status Check
**Action**: `status`

**Purpose**: Verify license validity and check quota

**Request**:
```json
{
  "action": "status",
  "token": "string",
  "email": "string",
  "scriptId": "string", 
  "spreadsheetId": "string"
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "valid": true,
    "until": "2024-12-31T23:59:59Z",
    "quota": {
      "used": 150,
      "limit": 1000,
      "remaining": 850
    },
    "row": 42,
    "message": "License valid"
  }
}
```

**Spreadsheet Access**: Read-only access to license sheet

### 3. License Validation
**Action**: `validate`

Same as `status` but with enhanced validation for new deployments

### 4. Gemini Text Generation
**Action**: `gm`

**Purpose**: Server-side text generation using user or default API key

**Request**:
```json
{
  "action": "gm",
  "token": "string",
  "email": "string",
  "scriptId": "string",
  "spreadsheetId": "string", 
  "apiKey": "string (optional)",
  "prompt": "string",
  "maxTokens": 12500,
  "temperature": 0.7
}
```

**Response**:
```json
{
  "ok": true,
  "data": "Generated text response"
}
```

**Logging Expectations**: Log prompt length, response time, key source (user/default), success/failure

**Rate Limiting**: 3 requests/second per token

### 5. Gemini Image Processing
**Action**: `gm_image`

**Purpose**: OCR and image analysis using Gemini Vision

**Request**:
```json
{
  "action": "gm_image", 
  "token": "string",
  "email": "string",
  "scriptId": "string",
  "spreadsheetId": "string",
  "apiKey": "string (optional)",
  "images": [
    {
      "mimeType": "image/png",
      "data": "base64-encoded-image-data"
    }
  ],
  "lang": "ru",
  "delimiter": "____ (optional)"
}
```

**Response**:
```json
{
  "ok": true,
  "data": "Transcribed text from images"
}
```

**Logging Expectations**: Log image count, total size, processing time, language

### 6. Collect Config Preview (NEW)
**Action**: `collect_config_preview`

**Purpose**: Server-side preview of AI builder configuration

**Request**:
```json
{
  "action": "collect_config_preview",
  "token": "string", 
  "email": "string",
  "scriptId": "string",
  "spreadsheetId": "string",
  "config": {
    "systemPrompt": "string",
    "userData": [
      {
        "sheet": "string",
        "cell": "string", 
        "description": "string"
      }
    ]
  },
  "tableId": "string (optional, alternative to spreadsheetId)"
}
```

**Response**:
```json
{
  "ok": true,
  "data": "Preview of data that will be processed",
  "logs": ["Processing log entries"]
}
```

**Spreadsheet Access**: Read access to specified sheets and cells for data preview

**Logging Expectations**: Log data sources accessed, preview generation time, any errors

### 7. Collect Config Execute (NEW)
**Action**: `collect_config_execute`

**Purpose**: Server-side execution of AI builder configuration

**Request**:
```json
{
  "action": "collect_config_execute",
  "token": "string",
  "email": "string", 
  "scriptId": "string",
  "spreadsheetId": "string",
  "apiKey": "string (optional)",
  "config": {
    "systemPrompt": "string",
    "userData": [...],
    "maxTokens": 12500,
    "temperature": 0.7
  },
  "sheetName": "string",
  "cellAddress": "string"
}
```

**Response**:
```json
{
  "ok": true,
  "data": "Generated content",
  "logs": ["Execution log entries"]
}
```

**Spreadsheet Access**: Read source data, write result to target cell

**Logging Expectations**: Log full execution trace, data sources, generation parameters, result size

## Migration Plan

### Phase 1 (Current)
- Implement capabilities handshake
- Add version constants and negotiation
- Migrate `collect_config_preview` and `collect_config_execute`
- Maintain backward compatibility

### Phase 2 (Planned)
- Migrate OCR functionality (`ocr_batch`, `ocr_single`)
- Server-side image processing with better error handling
- Enhanced rate limiting and quota management

### Phase 3 (Future)  
- Migrate UnpackingViewer functionality
- Server-side data export and formatting
- VK import migration
- Batch update system migration

## Client Integration

### Version Constants
```javascript
// In Main.gs
const CLIENT_VERSION = '4.0.0';
const SERVER_VERSION = '4.0.0'; 
const MIN_CLIENT_VERSION = '3.0.0';
```

### Helper Functions
```javascript
// In Main.gs
function callServerAction_(action, data, options) {
  // Version negotiation, caching, error handling
}

function ensureServerCapabilities_(forceRefresh) {
  // Capabilities handshake with caching
}
```

### Compatibility Layer
- Graceful degradation when server features unavailable
- Fallback to client-side implementations
- Clear error messages for version mismatches

## Error Handling

### Standard Error Codes
- `UNAUTHORIZED`: Invalid or missing license
- `RATE_LIMIT`: Request rate exceeded
- `NO_API_KEY_AVAILABLE`: No API key configured
- `UNKNOWN_ACTION`: Action not supported
- `VERSION_MISMATCH`: Client/server version incompatibility
- `SPREADSHEET_ACCESS_DENIED`: Insufficient permissions

### Error Response Format
```json
{
  "ok": false,
  "error": "ERROR_CODE",
  "message": "Human readable error description",
  "details": {
    "requiredVersion": "4.0.0",
    "currentVersion": "3.5.0"
  }
}
```

## Testing

### Test Coverage Requirements
- Capabilities handshake scenarios
- Version compatibility matrix
- Error handling for all error codes
- Rate limiting behavior
- Spreadsheet access permissions
- API key priority handling

### Test Data
- Mock spreadsheets with various permission levels
- Test licenses with different quota states
- Sample images for OCR testing
- Configurations for collect config testing

## Security Considerations

### API Key Handling
- User API keys take priority over defaults
- Keys are never logged or stored persistently on server
- Keys are validated before use

### Spreadsheet Access
- Server requests include both scriptId and spreadsheetId
- Access is validated against license permissions
- Read/write operations are logged for audit

### Rate Limiting
- Per-token rate limits prevent abuse
- Quota tracking prevents overuse
- Burst capacity with sustained limits

## Monitoring and Observability

### Metrics to Track
- Request volume by action type
- Response time distributions
- Error rates by error code
- API key usage patterns
- License quota consumption

### Log Format
```
[timestamp] [LEVEL] [ACTION] [TOKEN] [EMAIL] - message
```

Example:
```
2024-01-15 10:30:45 INFO collect_config_execute abc123 user@example.com - Execution completed in 2.3s
```

## Deployment Notes

### Server Deployment
- Update server.gs with new actions
- Add version constants
- Implement capabilities endpoint
- Update rate limiting if needed

### Client Deployment  
- Add version constants to Main.gs
- Implement helper functions
- Update menu system to use capabilities
- Add error handling for version mismatches

### Rollout Strategy
- Deploy server first (backward compatible)
- Update client with capabilities handshake
- Enable features via feature flags
- Monitor for compatibility issues