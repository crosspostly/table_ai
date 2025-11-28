# CollectConfig Server Migration Guide

## Overview

This document describes the migration of CollectConfig from client-side business logic to server-side processing, maintaining the same UI and user experience while improving security, concurrency, and maintainability.

## Architecture Changes

### Before Migration
- Client-side configuration management in `CollectConfig.gs`
- Direct spreadsheet manipulation from client functions
- Mixed client/server execution with fallbacks
- Local template management with direct PropertiesService access

### After Migration
- Server-side configuration management in `server.gs`
- Centralized `callServerAction_` function for all server communications
- Thin client wrappers in `CollectConfig.gs` for UI integration
- Server-enforced license checking and rate limiting
- Unified logging system with server log merging

## New Server Endpoints

### Core Configuration Operations
- `collect_config_init` - Initialize UI and load existing configuration
- `collect_config_save` - Save configuration to server-side ConfigData sheet
- `collect_config_delete` - Delete configuration from server-side ConfigData sheet
- `collect_config_preview` - Preview data from specified ranges
- `collect_config_execute` - Execute AI processing with configuration

### Template Management
- `collect_config_templates_get_all` - Get all user templates
- `collect_config_templates_get` - Get specific template
- `collect_config_templates_save` - Save template
- `collect_config_templates_delete` - Delete template
- `collect_config_templates_stats` - Get template statistics

## Server-Side Configuration Management

### ConfigData Sheet Structure
The server now manages the ConfigData sheet with the same structure:

| Column | Description |
|--------|-------------|
| Sheet | Target sheet name |
| Cell | Target cell address |
| SystemPromptSheet | System prompt sheet name |
| SystemPromptCell | System prompt cell address |
| UserDataJSON | JSON string of user data sources |
| CreatedAt | Creation timestamp |
| LastRun | Last execution timestamp |

### Server Functions
- `serverLoadCollectConfig_()` - Load configuration from ConfigData
- `serverSaveCollectConfig_()` - Save configuration to ConfigData
- `serverDeleteCollectConfig_()` - Delete configuration from ConfigData
- Enhanced `serverCollectConfigExecute_()` - Execute with server-side logging
- `serverGetSystemPrompt_()` - Handle protected table IDs and prompts
- `serverReadData_()` - Read and flatten spreadsheet data

## Client-Side Changes

### Thin Wrapper Functions
All client functions now use the centralized `callServerAction_()` function:

```javascript
function callServerAction_(action, data) {
  // Centralized server communication with:
  // - License validation
  // - Rate limiting
  // - Error handling
  // - Response parsing
  // - Logging integration
}
```

### Updated Client Functions
- `getCollectConfigInitData()` - Server initialization with config loading
- `saveAndExecuteCollectConfig()` - Server save + execute workflow
- `getCellPreview()` - Server-side data preview
- `deleteCollectConfig()` - Server configuration deletion
- `refreshCellWithConfig()` - Server-based refresh workflow
- `hasConfigForCurrentCell()` - Server config existence check

### Template Wrappers
- `serverGetAllTemplates()` - Template listing via server
- `serverGetTemplate()` - Individual template retrieval
- `serverSaveTemplate()` - Template saving via server
- `serverDeleteTemplate()` - Template deletion via server
- `serverGetTemplatesStats()` - Template statistics via server

## UI Integration Updates

### CollectConfigUi.html Changes
- Updated `initialize()` function to handle server-provided data
- Enhanced `loadExistingConfig()` to use server-loaded configuration
- Added server log merging for unified logging display
- Maintained existing UI flow and user experience

```javascript
function initialize(data) {
  // Handle server response with:
  // - sheets array
  // - existingConfig object
  // - server logs array
  // - version and update info
  
  // Merge server logs into UI
  if (data.logs && Array.isArray(data.logs)) {
    data.logs.forEach(function(logEntry) {
      addLogEntry(logEntry.message, logEntry.level.toLowerCase());
    });
  }
  
  loadExistingConfig(data.existingConfig);
}
```

## Security and Performance Improvements

### License Enforcement
- All server actions require valid license
- Consistent license checking across all endpoints
- Script and spreadsheet ID binding for enhanced security

### Rate Limiting
- Server-enforced rate limits (3 requests/second)
- Prevents abuse and ensures fair usage
- Applied to all collect_config actions

### Concurrency Protection
- Server-side locking for ConfigData operations
- Prevents race conditions in multi-user scenarios
- Atomic operations for configuration save/delete

### Logging and Monitoring
- Unified server logging for all operations
- Detailed execution tracking with timestamps
- Performance metrics (execution time, data size)
- Error tracking and debugging information

## Backward Compatibility

### Existing Configurations
- All existing ConfigData rows remain valid
- No migration required for user data
- Seamless upgrade path for existing users

### Template Compatibility
- Existing templates continue to work
- TemplateService integration maintained
- No breaking changes to template structure

### API Compatibility
- Client function signatures preserved
- UI expectations maintained
- No breaking changes for external integrations

## Testing

### Updated Test Suites
- `CollectConfigServer.test.js` - Server endpoint testing
- `CollectConfigFlowCompat.test.js` - Backward compatibility testing
- Comprehensive mock coverage for server functions

### Test Coverage
- Server configuration management
- Template operations via server
- Error handling and edge cases
- License and rate limiting enforcement
- Log merging functionality

## Deployment Notes

### Server Deployment
1. Deploy updated `server.gs` with new handlers
2. Verify all endpoint functionality
3. Test license and rate limiting
4. Monitor server logs for proper operation

### Client Deployment
1. Deploy updated `CollectConfig.gs` with thin wrappers
2. Deploy updated `CollectConfigUi.html` with server integration
3. Verify UI functionality with server backend
4. Test existing configuration compatibility

## Migration Benefits

### Security
- Centralized license checking
- Server-side data validation
- Enhanced user authentication
- Protection against client-side manipulation

### Performance
- Reduced client-side processing
- Server-optimized data operations
- Improved caching and batching
- Better resource utilization

### Maintainability
- Centralized business logic
- Consistent error handling
- Unified logging system
- Easier debugging and monitoring

### Reliability
- Server-enforced data integrity
- Atomic operations prevent corruption
- Better error recovery
- Consistent user experience

## Troubleshooting

### Common Issues
1. **License Errors**: Verify LICENSE_EMAIL and LICENSE_TOKEN in ScriptProperties
2. **Rate Limiting**: Check for excessive API calls, implement backoff
3. **Configuration Not Found**: Verify ConfigData sheet creation and permissions
4. **Template Issues**: Check TemplateService functions and PropertiesService access

### Debugging
- Enable server logging to track execution flow
- Check client-side UI logs for user interaction
- Monitor server response codes and error messages
- Verify spreadsheet permissions and access

## Future Enhancements

### Potential Improvements
1. **Caching**: Server-side caching for frequently accessed configurations
2. **Batching**: Batch operations for multiple configuration updates
3. **Validation**: Enhanced server-side validation rules
4. **Monitoring**: Real-time monitoring and alerting
5. **API Versioning**: Versioned API for future compatibility

This migration successfully serverizes CollectConfig while maintaining full backward compatibility and improving security, performance, and maintainability.