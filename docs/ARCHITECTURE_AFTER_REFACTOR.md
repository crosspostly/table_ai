# Architecture After Refactor - Thick Server + Thin Client

## 🎯 Overview

Table AI has been completely refactored to use a thick server + thin auto-updatable client architecture. This provides better maintainability, security, and OTA (Over-The-Air) update capabilities.

## 📁 Architecture Components

### 🖥 Server (Thick, 150+ KB)

The server contains all business logic and acts as a central dispatcher:

```
deploy/server.gs (диспетчер + лицензирование + OTA)
├── collectConfigAPI.gs (вся логика CollectConfig)
├── ocrAPI.gs (вся логика OCR)
├── vkAPI.gs (вся логика VK импорта)
├── unpackingAPI.gs (вся логика UnpackingViewer)
├── batchUpdateAPI.gs (вся логика batch операций)
└── license.gs (лицензирование)
```

**Server Responsibilities:**
- ✅ Central request routing via `doPost(e)`
- ✅ All business logic execution
- ✅ License validation
- ✅ Gemini API proxy with rate limiting
- ✅ Server-side logging
- ✅ OTA update management
- ✅ Data validation and security

### 💻 Client (Thin, 5-7 KB, Auto-updatable)

The client is a minimal wrapper that calls server APIs:

```
deploy/Main.gs (тонкая обёртка + OTA механизм)
├── CollectConfigUi.html (UI только)
├── UnpackingViewerUI.html (UI только)
├── SettingsUI.html (UI только)
├── logging_system.html (log viewer)
└── appsscript.json (версионирование)
```

**Client Responsibilities:**
- ✅ UI rendering and user interaction
- ✅ Server communication via `callServerAction_()`
- ✅ OTA update detection and installation
- ✅ Menu building (unchanged)
- ✅ Error handling and user feedback

## 🔄 Communication Flow

```
Client (Main.gs)          Server (server.gs)
     │                          │
     ├── callServerAction_ ──►│
     │   (action, subaction,  │   doPost() - Dispatcher
     │    payload)           │       │
     │                          │   ├── handleOTA()
     │                          │   ├── handleGemini()
     │                          │   ├── handleCollectConfig()
     │                          │   ├── handleOCR()
     │                          │   ├── handleVK()
     │                          │   ├── handleUnpacking()
     │                          │   └── handleBatchUpdate()
     │                          │
     ◄── JSON Response ─────┤
     │   {ok, data/error, logs}│
     │                          │
```

## 📋 API Actions

### OTA Updates
- `ota/checkUpdates` - Check for available updates
- `ota/getFileContent` - Download file content for updates

### CollectConfig
- `collectConfig/init` - Initialize UI
- `collectConfig/preview` - Preview configuration
- `collectConfig/execute` - Execute configuration
- `collectConfig/save` - Save configuration
- `collectConfig/delete` - Delete configuration
- `collectConfig/getTemplates` - Get templates list

### OCR
- `ocr/queue` - Queue OCR processing
- `ocr/getStatus` - Get OCR status
- `ocr/processBatch` - Process OCR batch

### VK Import
- `vk/importPosts` - Import VK posts
- `vk/parsePost` - Parse single post
- `vk/getStatus` - Get VK status

### Unpacking
- `unpacking/fetch` - Fetch unpacking data
- `unpacking/exportToDoc` - Export to Google Docs
- `unpacking/listExports` - List exports
- `unpacking/clear` - Clear data

### Batch Update
- `batchUpdate/runSegment` - Run batch segment
- `batchUpdate/runBatch` - Run full batch
- `batchUpdate/runImport` - Run import
- `batchUpdate/getStatus` - Get batch status
- `batchUpdate/clearResults` - Clear results
- `batchUpdate/getOperations` - Get operations list

## 🔒 Security

### Server Side
- ✅ License validation for all actions (except OTA)
- ✅ Rate limiting per token
- ✅ API key management (user + default)
- ✅ Input validation and sanitization
- ✅ Server-side logging and audit

### Client Side
- ✅ No sensitive data stored in client
- ✅ Minimal attack surface
- ✅ Secure communication via HTTPS
- ✅ No direct API keys exposure

## 🚀 Deployment

### Server Deployment (One-time)
1. Deploy all server files to Apps Script project
2. Deploy as Web App with appropriate permissions
3. Configure GEMINI_API_KEY in Script Properties
4. Set up license sheet if needed

### Client Deployment (Per User)
1. Copy Main.gs and HTML files to new spreadsheet
2. Set SERVER_URL in Script Properties
3. Client auto-updates on next `onOpen()`

## 🔄 Update Process

### Automatic Updates
1. Client checks updates on `onOpen()`
2. Server compares versions and returns file list
3. User sees update notification
4. Files downloaded and applied via dialog
5. Client restarts with new version

### Manual Updates
- DEV menu → "🔄 Проверить обновления"
- Forces update check regardless of version

## 📊 Benefits

### ✅ Advantages
- **Maintainability**: All logic in one place (server)
- **Security**: API keys and sensitive data on server only
- **Performance**: Client is lightweight and fast
- **Updates**: OTA updates without manual redistribution
- **Scalability**: Easy to add new features
- **Debugging**: Centralized logging and monitoring

### ✅ Compatibility
- All existing functions work unchanged
- Menu structure preserved
- User experience identical
- Data format compatible
- No migration required

## 🔧 Adding New Features

### Server Side
1. Create new API module (e.g., `newFeatureAPI.gs`)
2. Add handler in `server.gs` dispatcher
3. Implement business logic in module
4. Add subaction routing

### Client Side
1. Add menu function in `Main.gs`
2. Call via `callServerAction_('newFeature', 'action', payload)`
3. Handle response and update UI

### Example
```javascript
// Server: newFeatureAPI.gs
function newFeatureAction(spreadsheetId, payload) {
  // Business logic here
  return { success: true, data: result };
}

// Server: server.gs dispatcher
case 'newFeature':
  return handleNewFeature(subaction, data, spreadsheetId);

// Client: Main.gs
function newFeatureMenu() {
  const result = callServerAction_('newFeature', 'action', payload);
  SpreadsheetApp.getUi().alert(result.message);
}
```

## 📈 Monitoring

### Server Logs
- All actions logged with timing
- Error tracking and reporting
- License usage monitoring
- Rate limiting violations

### Client Logs
- Local error handling
- Server communication status
- Update process logging
- DEV mode debugging

## 🔮 Future Enhancements

### Planned Features
- Real-time updates via WebSocket
- Caching layer for performance
- Advanced analytics dashboard
- Multi-tenant support
- API versioning

### Scalability
- Horizontal scaling possible
- Load balancing ready
- Database migration path
- Microservices architecture preparation

---

**Version**: 3.0.0  
**Last Updated**: 2025-06-18  
**Architecture**: Thick Server + Thin Client + OTA