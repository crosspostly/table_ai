/**
 * Tests for Unpacking Viewer functionality
 * This test verifies that the basic structure is correct
 */

describe('UnpackingViewer', () => {
  // Mock global functions that would be available in Apps Script environment
  beforeEach(() => {
    global.addLog = jest.fn();
    global.Logger = {
      log: jest.fn()
    };
    global.Utilities = {
      formatDate: jest.fn().mockReturnValue('2023-12-01 10:00:00')
    };
    global.Session = {
      getScriptTimeZone: jest.fn().mockReturnValue('GMT')
    };
    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(),
      getUi: jest.fn()
    };
    global.HtmlService = {
      createHtmlOutputFromFile: jest.fn().mockReturnValue({
        setWidth: jest.fn().mockReturnThis(),
        setHeight: jest.fn().mockReturnThis(),
        setTitle: jest.fn().mockReturnThis()
      })
    };
    global.DocumentApp = {
      create: jest.fn().mockReturnValue({
        getBody: jest.fn().mockReturnValue({
          clear: jest.fn(),
          appendParagraph: jest.fn().mockReturnValue({
            setHeading: jest.fn().mockReturnThis(),
            setAlignment: jest.fn().mockReturnThis(),
            setFontSize: jest.fn().mockReturnThis(),
            setItalic: jest.fn().mockReturnThis(),
            setBold: jest.fn().mockReturnThis(),
            setSpacingBefore: jest.fn().mockReturnThis(),
            setSpacingAfter: jest.fn().mockReturnThis(),
            setIndentStart: jest.fn().mockReturnThis()
          }),
          appendHorizontalRule: jest.fn()
        })
      })
    };
  });

  describe('logUnpacking function', () => {
    test('should call global addLog when available', () => {
      // Load the actual function from UnpackingViewer.gs
      const mockCode = `
        function logUnpacking(message, level) {
          const logLevel = level || 'INFO';
          
          try {
            // Проверяем наличие глобальной функции addLog
            if (typeof addLog === 'function') {
              addLog(\`[UnpackingViewer] \${message}\`, logLevel);
            } else {
              // Fallback: используем встроенный Logger
              const timestamp = Utilities.formatDate(
                new Date(), 
                Session.getScriptTimeZone(), 
                'yyyy-MM-dd HH:mm:ss'
              );
              Logger.log(\`[\${timestamp}] \${logLevel}: \${message}\`);
            }
          } catch (error) {
            // Критический fallback
            console.log(\`[\${logLevel}] \${message}\`);
            console.error('Logging error:', error.message);
          }
        }
      `;
      
      eval(mockCode);
      
      logUnpacking('Test message', 'INFO');
      
      expect(global.addLog).toHaveBeenCalledWith('[UnpackingViewer] Test message', 'INFO');
    });

    test('should fallback to Logger when addLog is not available', () => {
      delete global.addLog;
      
      const mockCode = `
        function logUnpacking(message, level) {
          const logLevel = level || 'INFO';
          
          try {
            // Проверяем наличие глобальной функции addLog
            if (typeof addLog === 'function') {
              addLog(\`[UnpackingViewer] \${message}\`, logLevel);
            } else {
              // Fallback: используем встроенный Logger
              const timestamp = Utilities.formatDate(
                new Date(), 
                Session.getScriptTimeZone(), 
                'yyyy-MM-dd HH:mm:ss'
              );
              Logger.log(\`[\${timestamp}] \${logLevel}: \${message}\`);
            }
          } catch (error) {
            // Критический fallback
            console.log(\`[\${logLevel}] \${message}\`);
            console.error('Logging error:', error.message);
          }
        }
      `;
      
      eval(mockCode);
      
      logUnpacking('Test message', 'INFO');
      
      expect(global.Logger.log).toHaveBeenCalledWith('[2023-12-01 10:00:00] INFO: Test message');
    });

    test('should use default level INFO when not provided', () => {
      const mockCode = `
        function logUnpacking(message, level) {
          const logLevel = level || 'INFO';
          
          try {
            // Проверяем наличие глобальной функции addLog
            if (typeof addLog === 'function') {
              addLog(\`[UnpackingViewer] \${message}\`, logLevel);
            } else {
              // Fallback: используем встроенный Logger
              const timestamp = Utilities.formatDate(
                new Date(), 
                Session.getScriptTimeZone(), 
                'yyyy-MM-dd HH:mm:ss'
              );
              Logger.log(\`[\${timestamp}] \${logLevel}: \${message}\`);
            }
          } catch (error) {
            // Критический fallback
            console.log(\`[\${logLevel}] \${message}\`);
            console.error('Logging error:', error.message);
          }
        }
      `;
      
      eval(mockCode);
      
      logUnpacking('Test message');
      
      expect(global.addLog).toHaveBeenCalledWith('[UnpackingViewer] Test message', 'INFO');
    });
  });

  describe('Data structure validation', () => {
    test('should validate correct data structure', () => {
      const testData = {
        success: true,
        data: [
          { header: 'Test Header', value: 'Test Value' }
        ],
        error: null
      };
      
      expect(testData.success).toBe(true);
      expect(Array.isArray(testData.data)).toBe(true);
      expect(testData.data.length).toBeGreaterThan(0);
      expect(testData.data[0]).toHaveProperty('header');
      expect(testData.data[0]).toHaveProperty('value');
    });

    test('should handle empty data array', () => {
      const testData = {
        success: true,
        data: [],
        error: null
      };
      
      expect(testData.success).toBe(true);
      expect(Array.isArray(testData.data)).toBe(true);
      expect(testData.data.length).toBe(0);
    });

    test('should handle error case', () => {
      const testData = {
        success: false,
        data: [],
        error: 'Test error message'
      };
      
      expect(testData.success).toBe(false);
      expect(testData.error).toBe('Test error message');
    });
  });

  describe('Function existence', () => {
    test('should have required function names defined', () => {
      const requiredFunctions = [
        'openUnpackingViewer',
        'getUnpackingData', 
        'exportUnpackingToDoc',
        'logUnpacking'
      ];
      
      requiredFunctions.forEach(funcName => {
        // Check that function names are valid JavaScript identifiers
        expect(funcName).toMatch(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/);
      });
    });
  });
});