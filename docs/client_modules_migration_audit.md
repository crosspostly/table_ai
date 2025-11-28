# Client Modules Server Migration Audit

## Overview
This document audits each client module to enumerate responsibilities that should move server-side as part of the Table AI v4 "thick server" refactoring.

## Client Modules Analysis

### 1. CollectConfig.gs
**Current Location**: Client-side (deploy/CollectConfig.gs)
**Purpose**: AI builder for creating and executing data collection configurations

#### Current Client Responsibilities:
- UI management (sidebar interface)
- Configuration validation and storage
- Template management (read/write to PropertiesService)
- Data preview from spreadsheet cells
- Gemini API calls for execution
- Result writing to target cells

#### Server-Side Migration Plan:
**Phase 1 (MIGRATED)**:
- ✅ `collect_config_preview` - Server-side data preview
- ✅ `collect_config_execute` - Server-side configuration execution with Gemini API calls

**Remaining Client Responsibilities**:
- UI management (CollectConfigUi.html)
- Local configuration building and validation
- Template storage (client-side PropertiesService)
- User interaction handling

**Benefits of Migration**:
- Centralized API key management
- Better error handling and logging
- Consistent rate limiting
- Reduced client-side complexity

---

### 2. ocrRunV2_client.gs
**Current Location**: Client-side (deploy/ocrRunV2_client.gs)
**Purpose**: OCR processing of images from various sources (VK posts, direct images, rich text)

#### Current Client Responsibilities:
- Image source extraction (VK parser URLs, direct images, rich text links)
- Image data fetching and base64 encoding
- Batch processing with chunking logic
- Gemini Vision API calls
- Result processing and cell writing
- Error handling and retry logic

#### Server-Side Migration Plan:
**Phase 2 (PLANNED)**:
- 🔄 `ocr_batch` - Server-side batch OCR processing
- 🔄 `ocr_single` - Server-side single image OCR
- Image source resolution and fetching
- Centralized Gemini Vision API calls
- Enhanced error handling and logging

**Remaining Client Responsibilities**:
- UI interaction and progress display
- Local result caching
- User configuration management

**Benefits of Migration**:
- Better image source resolution
- Centralized API key management
- Improved error handling
- Enhanced rate limiting
- Better logging and monitoring

---

### 3. UnpackingViewer.gs
**Current Location**: Client-side (deploy/UnpackingViewer.gs)
**Purpose**: Data viewing and export from "Распаковка" and "ЦА" sheets

#### Current Client Responsibilities:
- Data reading from multiple sheets with specific structure
- Data formatting and organization
- Google Docs export functionality
- UI management (modal dialog)
- Data validation and error handling

#### Server-Side Migration Plan:
**Phase 3 (FUTURE)**:
- 📋 `unpacking_read` - Server-side data reading and formatting
- 📋 `unpacking_export` - Server-side export to various formats
- Enhanced data validation
- Multiple export formats support

**Remaining Client Responsibilities**:
- UI display and interaction
- Export format selection
- Progress indication

**Benefits of Migration**:
- Consistent data access patterns
- Better error handling
- Enhanced export capabilities
- Centralized data processing

---

### 4. VK.gs
**Current Location**: Client-side (deploy/VK.gs)
**Purpose**: Import posts from VK social network

#### Current Client Responsibilities:
- VK Parser service integration
- Post data fetching and validation
- Sheet data management (preserve headers, clear data rows)
- Formula creation for stop-word filtering
- Error handling and user feedback

#### Server-Side Migration Plan:
**Phase 3 (FUTURE)**:
- 📋 `vk_import` - Server-side VK post importing
- Enhanced VK Parser integration
- Better data validation and transformation
- Centralized error handling

**Remaining Client Responsibilities**:
- UI for import configuration
- Progress display
- User interaction

**Benefits of Migration**:
- Better error handling
- Enhanced data validation
- Consistent import patterns
- Improved logging

---

### 5. reniewcell.gs
**Current Location**: Client-side (deploy/reniewcell.gs)
**Purpose**: Batch update system for refreshing multiple cells with AI-generated content

#### Current Client Responsibilities:
- Batch operation configuration (BATCH_OPERATIONS object)
- Concurrent request management with semaphores
- Rate limiting and retry logic
- Success detection and auto-retry
- Progress tracking and logging
- Cell value updates and formula management

#### Server-Side Migration Plan:
**Phase 3 (FUTURE)**:
- 📋 `batch_update` - Server-side batch update system
- Enhanced concurrent processing
- Better rate limiting and queue management
- Centralized success detection
- Improved error handling and recovery

**Remaining Client Responsibilities**:
- UI for batch operation selection
- Progress display
- User configuration

**Benefits of Migration**:
- Better resource management
- Enhanced processing capabilities
- Improved error handling
- Centralized logging

---

## Migration Priority Matrix

| Module | Phase | Priority | Complexity | Impact |
|--------|-------|----------|------------|---------|
| CollectConfig | 1 | HIGH | MEDIUM | HIGH |
| ocrRunV2_client | 2 | MEDIUM | HIGH | MEDIUM |
| UnpackingViewer | 3 | LOW | LOW | MEDIUM |
| VK.gs | 3 | LOW | MEDIUM | LOW |
| reniewcell | 3 | LOW | HIGH | MEDIUM |

## Data Access Patterns

### Current Client Access:
- Direct SpreadsheetApp API calls
- PropertiesService for configuration
- External service calls (VK Parser, Gemini)
- CacheService for temporary storage

### Target Server Access:
- Centralized spreadsheet access via server.gs
- Server-side PropertiesService
- Managed external service calls
- Enhanced caching strategies

## Security Considerations

### Current Client Security:
- API keys stored in client PropertiesService
- Direct external service calls
- Limited audit trail

### Enhanced Server Security:
- Centralized API key management
- Server-side external service calls
- Comprehensive logging and audit
- Better rate limiting and abuse prevention

## Performance Implications

### Current Client Performance:
- Limited by Apps Script quotas
- Client-side processing bottlenecks
- Inefficient external service usage

### Expected Server Performance:
- Better resource utilization
- Optimized external service calls
- Enhanced caching strategies
- Improved batch processing

## Testing Strategy

### Current Testing:
- Limited client-side test coverage
- Mock-based testing
- Manual integration testing

### Enhanced Testing:
- Comprehensive server-side unit tests
- Integration test coverage
- End-to-end testing scenarios
- Performance testing

## Rollout Plan

### Phase 1 (Current):
- ✅ Server API v4 specification
- ✅ Capabilities handshake implementation
- ✅ CollectConfig migration
- ✅ Version negotiation system

### Phase 2 (Next):
- OCR functionality migration
- Enhanced error handling
- Improved logging system
- Performance monitoring

### Phase 3 (Future):
- Remaining modules migration
- Advanced features
- Optimization and tuning

## Success Metrics

### Technical Metrics:
- Reduced client-side complexity
- Improved error rates
- Better performance metrics
- Enhanced logging coverage

### User Experience Metrics:
- Faster response times
- Better error messages
- More reliable operations
- Enhanced feature capabilities

## Risk Assessment

### Migration Risks:
- Breaking existing functionality
- Performance regressions
- User experience impact
- Data loss potential

### Mitigation Strategies:
- Comprehensive testing
- Gradual rollout with feature flags
- Fallback mechanisms
- User communication

## Conclusion

The migration to a "thick server" architecture will provide significant benefits in terms of:
- Maintainability and code organization
- Security and audit capabilities
- Performance and resource utilization
- User experience and reliability

The phased approach ensures minimal disruption while delivering incremental value to users.