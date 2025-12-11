# 🔄 Gemini API Request Flow Diagrams

## 1. HIGH-LEVEL REQUEST FLOW

```
┌──────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                              │
│         (CollectConfig UI / reviewcell.gs batch menu)            │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    CLIENT SIDE (Apps Script)                     │
│  CollectConfig.gs / reniewcell.gs / ocrRunV2_client.gs          │
│                                                                  │
│  ├─ saveAndExecuteCollectConfig()                               │
│  │  └─ callCollectConfigServer_(config)                         │
│  │     └─ UrlFetchApp.fetch(serverUrl, POST)                    │
│  │                                                               │
│  └─ updateCellsBatch(cells[])  [reniewcell.gs]                  │
│     └─ updateSingleCell(sheet, cell)                            │
│        └─ callCollectConfigServer_(config)                      │
│           └─ UrlFetchApp.fetch(serverUrl, POST)                 │
│                                                                  │
│  [NETWORK TRANSMISSION]                                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                         ⚡ NETWORK ⚡
                         HTTP POST
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    SERVER SIDE (Apps Script)                     │
│                       server.gs:doPost()                         │
│                                                                  │
│  ├─ parseBody_() → extract action, config, apiKey, token        │
│  │                                                               │
│  ├─ checkLicense_(token, email) → verify subscription           │
│  │  [413 if invalid]                                            │
│  │                                                               │
│  ├─ rateLimitOk_(token)  ✅ LEVEL 1: Per-token limit            │
│  │  [429 if token exceeds 3/sec]                                │
│  │                                                               │
│  └─ serverCollectConfigExecute_(config)                         │
│     ├─ serverGetSystemPrompt_()                                 │
│     ├─ serverReadData_() × N sources                            │
│     └─ serverGM_(prompt, apiKey) ⭐⭐⭐ GEMINI CALL             │
│        └─ executeGeminiWithRateLimit()                          │
│           └─ callGeminiApi()                                    │
│              └─ UrlFetchApp.fetch(gemini.com API) 🚀 REAL API  │
│                                                                  │
│  [RESPONSE]                                                      │
│  ├─ If success: {ok: true, data: result}                        │
│  └─ If error: {ok: false, error: msg, logs: []}                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                         ⚡ NETWORK ⚡
                         JSON RESPONSE
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    CLIENT SIDE (Result)                          │
│                                                                  │
│  ├─ Check response.ok                                           │
│  ├─ If success: update cell with result                         │
│  ├─ If error: log and retry (reniewcell.gs)                     │
│  └─ mergeServerLogs_()                                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. GEMINI API CALL DETAIL (executeGeminiWithRateLimit)

```
┌────────────────────────────────────────────────────────┐
│  executeGeminiWithRateLimit(modelConfig, prompt, opts) │
│         (server.gs:201-302)                           │
└────────────────────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Step 1: Check Cache         │
        │  CacheManager.get(cacheKey)  │
        └──────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         │                            │
         ▼ MISS                       ▼ HIT
      Continue              Return cached result
                                      │
                                      ▼
                            {success: true, data: cached}
                                      │
                                      ╭─────────────────┬─ return
                                      │
       (if MISS, continue...)         │
         │                            │
         ▼                            │
┌──────────────────────────────────┐ │
│  Step 2: Rate Limit Check        │ │
│  rateLimiter.waitIfNeeded()      │ │
│                                  │ │
│  ├─ getRecentRequests_()         │ │
│  │  (last 60 sec in memory)      │ │
│  │                               │ │
│  └─ If >= 10 requests:           │ │
│     Utilities.sleep(waitTime)    │ │
└──────────────────────────────────┘ │
         │                            │
         ▼                            │
┌──────────────────────────────────┐ │
│  Step 3: Log Request             │ │
│  rateLimiter.logRequest()        │ │
│  (add timestamp to memory)       │ │
└──────────────────────────────────┘ │
         │                            │
         ▼                            │
┌──────────────────────────────────────────────────┐
│  Step 4: Attempt API Call                        │
│  (loop: maxRetries = 3)                          │
│                                                  │
│  for (let attempt = 0; attempt < 3; attempt++) {│
│    try {                                         │
│      result = callGeminiApi(modelConfig, prompt)│
│      ├─ UrlFetchApp.fetch(gemini API)           │
│      ├─ HTTP 200? → parse response              │
│      └─ HTTP != 200? → throw Error              │
│    } catch (error) {                            │
│      if (error.includes('429')) {               │
│        // Quota exceeded!                       │
│        backoffDelay = 2^attempt * 1000          │
│        // = 1s, 2s, 4s                          │
│        Utilities.sleep(backoffDelay)            │
│        continue; // retry                       │
│      } else {                                   │
│        throw error; // no retry                 │
│      }                                          │
│    }                                            │
│  }                                              │
└──────────────────────────────────────────────────┘
         │
     ┌───┴────┬────────┐
     │         │        │
  SUCCESS    429x3    OTHER ERROR
     │         │        │
     ▼         ▼        ▼
   ┌─────┐   ┌─────┐  ┌──────────┐
   │OK✓  │   │FAIL │  │ THROW ❌ │
   └─────┘   │429  │  └──────────┘
             └─────┘
             
     │         │        │
     ▼         ▼        ▼
┌────────────────────────────────┐
│  Step 5: Cache Result (if ok)  │
│  cacheManager.set(cacheKey)    │
└────────────────────────────────┘
     │
     ▼
┌────────────────────────────────┐
│  Step 6: Log Metrics           │
│  logApiMetric(metric)          │
│  → write to API_METRICS sheet  │
└────────────────────────────────┘
     │
     ▼
┌────────────────────────────────┐
│  Return Result                 │
│  {                             │
│    success: true/false,        │
│    data: result,               │
│    error: error_msg,           │
│    waitTime: ms,               │
│    attempt: N                  │
│  }                             │
└────────────────────────────────┘
```

---

## 3. BATCH UPDATE FLOW (reniewcell.gs)

```
┌─────────────────────────────────────────────────────┐
│              User clicks "etap1" button              │
│             (or any batch operation)                │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  etap1() {                                          │
│    BatchStart(BATCH_OPERATIONS.etap1)              │
│  }                                                 │
│                                                     │
│  Reads from ConfigData sheet:                      │
│  Sheet | Cell | SystemPrompt | UserDataJSON        │
│  ──────┼──────┼──────────────┼──────────────       │
│  etap1 | A2   | Prompt_box!E2| [...userData]       │
│  etap1 | A3   | ...          | ...                 │
│  ...   | ...  | ...          | ...                 │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────┐
│  BatchStart(config) {                    │
│    enqueueTask(                          │
│      () => batchUpdateWrapper(...),      │
│      config.name                         │
│    )                                     │
│  }                                       │
└──────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│  enqueueTask(taskFn, taskName) {                     │
│    GLOBAL_CONFIG.QUEUE.push({                        │
│      fn: taskFn,                                    │
│      name: taskName,                                │
│      timestamp: now                                 │
│    })                                               │
│    processQueue()  // Start processing              │
│  }                                                  │
│                                                     │
│  QUEUE: [                                           │
│    {fn: ..., name: "etap1"},                        │
│    {fn: ..., name: "etap2_1"},  // if queued        │
│  ]                                                  │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│  processQueue() {                                │
│    if (ACTIVE_REQUESTS >= 2) return;  // wait   │
│                                                  │
│    task = QUEUE.shift()                         │
│    ACTIVE_REQUESTS++                            │
│    task.fn()  // Execute batch                  │
│    ACTIVE_REQUESTS--                            │
│    processQueue()  // Next                       │
│  }                                              │
│                                                  │
│  ⚠️ Max 2 concurrent batches                    │
└──────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  batchUpdateWrapper(batchName, startRow, endRow) {       │
│                                                          │
│  1. Read ConfigData rows [startRow:endRow]              │
│  2. Filter by lastRun + Success status                  │
│  3. Build cellsToUpdate array                           │
│  4. Call updateCellsBatch(cellsToUpdate)                │
│  5. If errors + AUTO_RETRY_ENABLED:                     │
│     scheduleAutoRetry()                                 │
│  }                                                      │
└──────────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  updateCellsBatch(cellsToUpdate[], batchName) {          │
│                                                          │
│  POOL_SIZE = 3                                          │
│  RETRY_COUNT = 2 (max 3 attempts per cell)              │
│  DELAY = 800ms                                          │
│                                                          │
│  for (idx = 0; idx < cellsToUpdate.length; idx += 3) {  │
│    batch = cellsToUpdate.slice(idx, idx+3)             │
│                                                          │
│    ┌─ Attempt 1: 3 cells parallel                       │
│    │  - cell1 → updateSingleCell()                      │
│    │  - cell2 → updateSingleCell()                      │
│    │  - cell3 → updateSingleCell()                      │
│    │                                                    │
│    │  If any cell fails:                                │
│    │    └─ RETRY_COUNT = 2:                             │
│    │       └─ Attempt 2 after 800ms                     │
│    │       └─ Attempt 3 after 1600ms                    │
│    │                                                    │
│    └─ Delay 800ms before next batch                    │
│                                                          │
│  }                                                      │
│  }                                                      │
└──────────────────────────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
    SUCCESS                       ERROR(S)
        │                             │
        ▼                             ▼
   ┌────────┐                   ┌──────────────┐
   │  +1    │                   │ scheduleAuto │
   │Success │                   │  Retry()     │
   │Count   │                   │              │
   └────────┘                   │ (if enabled) │
        │                       └──────────────┘
        │                             │
        ▼                             ▼
    ┌─────────────────────────────────────────┐
    │  updateLastRunWithStatus()               │
    │  Write to ConfigData:                    │
    │  ├─ Column G: timestamp (lastRun)        │
    │  └─ Column H: true/false (Success)       │
    └─────────────────────────────────────────┘
        │
        ▼
    ┌─────────────────┐
    │ Show alert:     │
    │ ✅ X successes │
    │ ❌ Y errors     │
    └─────────────────┘
```

---

## 4. updateSingleCell DETAIL (retry logic)

```
┌────────────────────────────┐
│  updateSingleCell(sheet,   │
│                    cell)   │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│  1. Load CollectConfig from DB     │
│     getLoadCollectConfig(          │
│       sheet, cell)                 │
└────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  2. Call Server                  │
│  (RETRY LOOP)                    │
│                                  │
│  retryCount = 0                  │
│  success = false                 │
│                                  │
│  while (retryCount <= 2) {       │
│                                  │
│    ┌─────────────────────────┐   │
│    │ Attempt #(retryCount)   │   │
│    │                         │   │
│    │ callCollectConfigServer_│   │
│    │ (config, sheet, cell)   │   │
│    │     ↓                   │   │
│    │ POST request            │   │
│    │     ↓                   │   │
│    │ Server: execute API     │   │
│    │     ↓                   │   │
│    │ Response:               │   │
│    │ ├─ {ok: true, data}     │   │
│    │ └─ {ok: false, error}   │   │
│    └─────────────────────────┘   │
│    │                             │
│    ├─ Success?                   │
│    │  └─ success = true          │
│    │     break                   │
│    │                             │
│    └─ Error?                     │
│       └─ retryCount++            │
│          if (retryCount <= 2)    │
│            sleep(800 * retry)    │
│                                  │
│  }  // end while                 │
│                                  │
└──────────────────────────────────┘
         │
    ┌────┴─────┐
    │           │
  SUCCESS     FAIL
    │           │
    ▼           ▼
┌────────┐  ┌──────────┐
│return  │  │errorCount│
│success │  │   += 1   │
└────────┘  └──────────┘
```

---

## 5. RATE LIMITING LAYERS

```
REQUEST ARRIVES AT SERVER
  │
  ├─ HTTP Headers parsed
  │
  ▼
═══════════════════════════════════════════════════════════

  LAYER 1: rateLimitOk_(token)  ✅ Per-token
  ─────────────────────────────────────────
  
  CacheService.getScriptCache()
    key = "rl:{token}:{sec}"     // epoch second
    
    limit = 3 requests/sec
    
    If count >= 3:
      return false → HTTP 429 Conflict
    Else:
      increment count
      return true → proceed
  
  ├─ Called: server.gs:481 (gm), 555 (gm_image)
  └─ TTL: 2 seconds

═══════════════════════════════════════════════════════════

  LAYER 2: rateLimiter.waitIfNeeded()  ⚠️ Global
  ─────────────────────────────────────────────────
  
  UserProperties:
    key = "gemini_api_rate_limit_store"
    value = [ts1, ts2, ts3, ...]
    
    Recent requests = filter(ts > now - 60000)
    
    If recent.length < 10:
      return 0 (no wait)
    Else:
      oldestTs = min(recent)
      waitTime = 60000 - (now - oldestTs) + 500
      Utilities.sleep(waitTime)
      return waitTime
  
  ├─ Called: executeGeminiWithRateLimit() line 227
  └─ Window: 60 seconds

═══════════════════════════════════════════════════════════

  LAYER 3: Exponential Backoff (on 429)
  ─────────────────────────────────────
  
  Upon HTTP 429 from Gemini API:
    
    backoffDelay = 2^attempt * 1000  // ms
    
    Attempt 0: 1 sec
    Attempt 1: 2 sec
    Attempt 2: 4 sec
    ──────────────────
    Max total: 7 seconds
  
  ├─ Called: executeGeminiWithRateLimit() line 269-272
  └─ Max attempts: 3

═══════════════════════════════════════════════════════════

           ▼
  CALL GEMINI API
  UrlFetchApp.fetch(
    "https://generativelanguage.googleapis.com/..."
  )

           ▼
  
  Response:
    ├─ HTTP 200 → SUCCESS
    ├─ HTTP 429 → QUOTA EXCEEDED (retry)
    ├─ HTTP 401 → INVALID KEY (fail)
    ├─ HTTP 400 → BAD REQUEST (fail)
    └─ HTTP 5xx → SERVER ERROR (fail)
```

---

## 6. PROBLEM SCENARIO: 25 API CALLS IN 15 MINUTES

```
18:39:00  │
          │  User clicks "etap1" (batch operation)
          │  startRow: 2, endRow: 9 (8 cells)
          │
          ▼
18:39:00  ├─ batchUpdateWrapper() called
          │
          ├─ Reads ConfigData rows 2-9
          ├─ Filters: no fresh successes
          ├─ cellsToUpdate = [cell1, cell2, ..., cell8]
          │
          └─ updateCellsBatch(8 cells)
             
             Round 1 (POOL_SIZE = 3):
             ├─ cell1 → callCollectConfigServer_() → HTTP 200 ✓
             ├─ cell2 → callCollectConfigServer_() → HTTP 200 ✓
             └─ cell3 → callCollectConfigServer_() → HTTP 200 ✓
                                                     = 3 API calls
          
18:39:02  │  Delay: 800ms between rounds
          │
          └─ Round 1 completes, Round 2 starts
             
             Round 2 (POOL_SIZE = 3):
             ├─ cell4 → callCollectConfigServer_() → ⚠️ HTTP 429 ❌
             ├─ cell5 → callCollectConfigServer_() → ⚠️ HTTP 429 ❌
             └─ cell6 → callCollectConfigServer_() → ⚠️ HTTP 429 ❌
                                                     = 3 API calls
                
             ❌ QUOTA EXCEEDED on server!

18:39:03  │  Retry logic kicks in (RETRY_COUNT = 2)
          │
          ├─ Retry Attempt 2 (retryCount=1): delay 800ms
          │
          └─ cell4 → callCollectConfigServer_() → ❌ HTTP 429
             cell5 → callCollectConfigServer_() → ❌ HTTP 429
             cell6 → callCollectConfigServer_() → ❌ HTTP 429
                                                  = 3 API calls
             
18:39:04  │  Retry Attempt 3 (retryCount=2): delay 1600ms
          │
          └─ cell4 → callCollectConfigServer_() → ✓ HTTP 200
             cell5 → callCollectConfigServer_() → ✓ HTTP 200
             cell6 → callCollectConfigServer_() → ✓ HTTP 200
                                                  = 3 API calls
             
             ✓ Quota recovered!

18:39:05  │  Delay: 800ms before final round
          │
          ├─ Round 3 (cell7-8):
          │  └─ cell7 → callCollectConfigServer_() → ✓ HTTP 200
          │  └─ cell8 → callCollectConfigServer_() → ✓ HTTP 200
          │                                        = 2 API calls
          │
          └─ etap1 completed

18:39:10  │
          │  User clicks "etap2_1" (another batch)
          │  startRow: 10, endRow: 23 (14 cells)
          │
          └─ Similar pattern...
             Round 1: 3 cells × 1 = 3 calls
             Round 2: 3 cells × 1 = 3 calls
             Round 3: 3 cells × 1 = 3 calls
             Round 4: 5 cells × 1 = 5 calls
                                    = 14 API calls

18:39:54  │  TOTAL: etap1 (14) + etap2_1 (11) = 25 API calls ✓


SUMMARY:
───────
3 + 3 + 3 (Rounds) + 3 + 3 + 3 (Retries) + 2 (Final) + 3 + 3 + 3 + 5 (Batch 2)
= 3 + 9 + 2 + 14
= 28 calls (approx 25 logged)

ROOT CAUSE: Double retry mechanism
├─ 2 local retries in updateCellsBatch (RETRY_COUNT=2)
├─ 3 server retries in executeGeminiWithRateLimit (exponential backoff)
└─ = 5 total attempts per cell when quota exceeded
   × 6-8 cells affected = 30-40 API calls
```

---

## 7. SOLUTION FLOW (Proposed)

```
REQUEST ARRIVES AT SERVER
  │
  ├─ HTTP Headers parsed
  │
  ▼
═══════════════════════════════════════════════════════════

  LAYER 1: rateLimitOk_(token)  ✅ Per-token
  ─────────────────────────────────────────
  (unchanged: 3 requests/sec per token)

═══════════════════════════════════════════════════════════

  LAYER 2: RateLimitManager (IMPROVED)
  ─────────────────────────────────────
  
  ✅ NEW: Activate MAX_REQUESTS_PER_MINUTE check
     if (!canMakeRequest()) {
       waitTime = getWaitTime()
       Utilities.sleep(waitTime)
     }
  
  ✅ NEW: Add circuit breaker
     if (quota_circuit_breaker.isOpen()) {
       throw Error("Quota circuit breaker open")
     }

═══════════════════════════════════════════════════════════

  LAYER 3: QuotaCircuitBreaker (NEW)
  ──────────────────────────────────
  
  Track: count of 429 errors
  
  If errors >= 5 in 10 seconds:
    ├─ Open circuit (reject new requests)
    └─ Hold for 30 seconds (recovery)

═══════════════════════════════════════════════════════════

  LAYER 4: Improved Exponential Backoff
  ──────────────────────────────────────
  
  ✅ NEW: Longer delays
     backoffDelay = Min(
       120000,  // max 120 seconds
       Math.pow(2, attempt + 2) * 1000
     )
     
     Attempt 0: 4 secs
     Attempt 1: 8 secs
     Attempt 2: 16 secs
     ────────────────────
     Max total: 28 seconds (much better)

═══════════════════════════════════════════════════════════

  ✅ REMOVED: Double retry in batching
  ─────────────────────────────────────
  
  Old: updateCellsBatch → RETRY_COUNT = 2 (3 attempts)
  New: updateCellsBatch → RETRY_COUNT = 0 (1 attempt only)
  
  Reason: Let server handle all retries
          Client only fails and re-queues

═══════════════════════════════════════════════════════════

           ▼
  CALL GEMINI API
  (only once per cell, server retries internally)

           ▼
  
  Response:
    ├─ HTTP 200 → SUCCESS, mark cell ✓
    ├─ HTTP 429 → SERVER RETRIES (exponential backoff)
    │            if still 429: mark cell for retry later
    └─ HTTP 4xx/5xx → FAIL, mark cell ❌
```

---

## COMPARISON TABLE

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Per-token limit** | 3 req/sec | 3 req/sec (same) |
| **Global limit** | 10 req/min (defined but unused) | ✅ 10 req/min enforced |
| **Local retry** (client) | RETRY_COUNT=2 (3 attempts) | ❌ RETRY_COUNT=0 (1 attempt) |
| **Server retry** | 3 attempts, backoff 1-2-4s | ✅ 3 attempts, backoff 4-8-16s |
| **Circuit breaker** | ❌ None | ✅ New: 5 errors → 30s block |
| **Max backoff** | 7 sec | ✅ 28+ sec (max 120s) |
| **Logging** | scattered | ✅ centralized GeminiRequestLog |
| **Request tracking** | no ID | ✅ request_id + logs |
| **Worst case** (5 cells, quota) | 45 calls | ✅ ~15 calls |

---

**END OF FLOW DIAGRAMS**
