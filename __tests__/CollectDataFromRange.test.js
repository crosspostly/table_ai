/**
 * UNIT ТЕСТЫ для функции collectDataFromRange
 * Цель: Найти РЕАЛЬНУЮ проблему с чтением диапазонов!
 */

describe('collectDataFromRange - ПОЛНОЕ ТЕСТИРОВАНИЕ', () => {
  // Mock Google Apps Script API
  let mockSpreadsheet;
  let mockSheet;
  let mockRange;

  beforeEach(() => {
    // Сбрасываем моки перед каждым тестом
    mockRange = {
      getValues: jest.fn(),
      getValue: jest.fn(),
    };

    mockSheet = {
      getName: jest.fn(() => 'TestSheet'),
      getLastRow: jest.fn(() => 100), // По умолчанию 100 строк
      getLastColumn: jest.fn(() => 10), // По умолчанию 10 столбцов
      getRange: jest.fn(() => mockRange),
    };

    mockSpreadsheet = {
      getSheetByName: jest.fn((name) => {
        if (name === 'TestSheet') return mockSheet;
        return null;
      }),
    };

    // Mock global SpreadsheetApp
    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => mockSpreadsheet),
    };

    // Mock addLog (для логирования)
    global.addLog = jest.fn();
  });

  // Загружаем функцию collectDataFromRange
  function collectDataFromRange(sheetName, cellAddress) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Лист \"${sheetName}\" не найден.`);
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow === 0 || lastCol === 0) {
      addLog(`⚠️ Лист \"${sheetName}\" пуст (lastRow=${lastRow}, lastCol=${lastCol})`, 'WARN');
      return '';
    }

    let normalizedAddress = cellAddress.trim().toUpperCase();

    try {
      // Случай 1: Полный столбец (C:C, A:B)
      if (/^[A-Z]+:[A-Z]+$/.test(normalizedAddress)) {
        const cols = normalizedAddress.split(':');
        const startCol = cols[0];
        const endCol = cols[1];
        const fullRangeAddress = `${startCol}1:${endCol}${lastRow}`;
        addLog(`📊 Читаем полный столбец: ${fullRangeAddress} с листа \"${sheetName}\"`, 'INFO');
        const values = sheet.getRange(fullRangeAddress).getValues();
        return values
          .flat()
          .filter(function(val) {
            return val !== null && val !== undefined && val.toString().trim() !== '';
          })
          .join('\n');
      }

      // Случай 2: Конкретный диапазон (A1, A1:B10, C1:C100)
      addLog(`📋 Читаем диапазон: ${normalizedAddress} с листа \"${sheetName}\"`, 'INFO');

      const rangeRegex = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/;
      const match = normalizedAddress.match(rangeRegex);

      if (match) {
        const startCol = match[1];
        const startRow = parseInt(match[2]);
        const endCol = match[3];
        const endRow = parseInt(match[4]);

        const actualEndRow = Math.min(endRow, lastRow);

        if (startRow > lastRow) {
          addLog(`⚠️ Диапазон \"${normalizedAddress}\" начинается за границами данных (startRow=${startRow} > lastRow=${lastRow})`, 'WARN');
          return '';
        }

        const adjustedAddress = `${startCol}${startRow}:${endCol}${actualEndRow}`;
        if (adjustedAddress !== normalizedAddress) {
          addLog(`📋 Скорректированный диапазон: ${adjustedAddress} (было ${normalizedAddress})`, 'INFO');
        }

        const values = sheet.getRange(adjustedAddress).getValues();
        return values
          .flat()
          .filter(function(val) {
            return val !== null && val !== undefined && val.toString().trim() !== '';
          })
          .join('\n');
      }

      // Случай 3: Одна ячейка (A1) или другой простой формат (включая B1:B)
      const range = sheet.getRange(normalizedAddress);
      const values = range.getValues();
      return values
        .flat()
        .filter(function(val) {
          return val !== null && val !== undefined && val.toString().trim() !== '';
        })
        .join('\n');
    } catch (rangeError) {
      addLog(`❌ Ошибка чтения диапазона \"${cellAddress}\" на листе \"${sheetName}\": ${rangeError.message}`, 'ERROR');
      throw new Error(
        `Некорректный диапазон \"${cellAddress}\" на листе \"${sheetName}\": ${rangeError.message}`,
      );
    }
  }

  describe('🧪 ТЕСТ 1: Одна ячейка B1', () => {
    it('должен прочитать одну ячейку B1', () => {
      mockRange.getValues.mockReturnValue([['Test Value']]);

      const result = collectDataFromRange('TestSheet', 'B1');

      expect(result).toBe('Test Value');
      expect(mockSheet.getRange).toHaveBeenCalledWith('B1');
      expect(mockRange.getValues).toHaveBeenCalled();
    });

    it('должен вернуть пустую строку для пустой ячейки', () => {
      mockRange.getValues.mockReturnValue([['']]);

      const result = collectDataFromRange('TestSheet', 'B1');

      expect(result).toBe('');
    });

    it('должен вернуть пустую строку для null', () => {
      mockRange.getValues.mockReturnValue([[null]]);

      const result = collectDataFromRange('TestSheet', 'B1');

      expect(result).toBe('');
    });
  });

  describe('🧪 ТЕСТ 2: Полный столбец B:B', () => {
    it('должен прочитать весь столбец B:B', () => {
      // Мокаем 5 строк данных
      mockRange.getValues.mockReturnValue([
        ['Row1'],
        ['Row2'],
        ['Row3'],
        [''],
        ['Row5'],
      ]);

      const result = collectDataFromRange('TestSheet', 'B:B');

      expect(mockSheet.getRange).toHaveBeenCalledWith('B1:B100');
      expect(result).toBe('Row1\nRow2\nRow3\nRow5'); // Пустая строка отфильтрована
    });
  });

  describe('🧪 ТЕСТ 3: Диапазон B1:B (от B1 до конца)', () => {
    it('должен прочитать B1:B как диапазон', () => {
      // Google Sheets API должен сам обработать B1:B
      mockRange.getValues.mockReturnValue([
        ['Value1'],
        ['Value2'],
        ['Value3'],
      ]);

      const result = collectDataFromRange('TestSheet', 'B1:B');

      // Это попадёт в Случай 3 (getRange напрямую)
      expect(mockSheet.getRange).toHaveBeenCalledWith('B1:B');
      expect(result).toBe('Value1\nValue2\nValue3');
    });
  });

  describe('🧪 ТЕСТ 4: Диапазон B1:B100', () => {
    it('должен прочитать B1:B100', () => {
      mockRange.getValues.mockReturnValue([
        ['Val1'],
        ['Val2'],
      ]);

      const result = collectDataFromRange('TestSheet', 'B1:B100');

      // Это попадёт в Случай 2 (regex для C1:C100)
      expect(mockSheet.getRange).toHaveBeenCalledWith('B1:B100');
      expect(result).toBe('Val1\nVal2');
    });
  });

  describe('🧪 ТЕСТ 5: Диапазон A1:D50', () => {
    it('должен прочитать многостолбцовый диапазон A1:D50', () => {
      mockRange.getValues.mockReturnValue([
        ['A1', 'B1', 'C1', 'D1'],
        ['A2', 'B2', 'C2', 'D2'],
      ]);

      const result = collectDataFromRange('TestSheet', 'A1:D50');

      expect(mockSheet.getRange).toHaveBeenCalledWith('A1:D50');
      expect(result).toBe('A1\nB1\nC1\nD1\nA2\nB2\nC2\nD2');
    });
  });

  describe('🧪 ТЕСТ 6: Пустой лист', () => {
    it('должен вернуть пустую строку для пустого листа', () => {
      mockSheet.getLastRow.mockReturnValue(0);
      mockSheet.getLastColumn.mockReturnValue(0);

      const result = collectDataFromRange('TestSheet', 'B1');

      expect(result).toBe('');
      expect(addLog).toHaveBeenCalledWith(
        expect.stringContaining('пуст'),
        'WARN',
      );
    });
  });

  describe('🧪 ТЕСТ 7: Несуществующий лист', () => {
    it('должен выбросить ошибку для несуществующего листа', () => {
      expect(() => {
        collectDataFromRange('NonExistentSheet', 'B1');
      }).toThrow('Лист "NonExistentSheet" не найден');
    });
  });

  describe('🧪 ТЕСТ 8: Диапазон за границами данных', () => {
    it('должен вернуть пустую строку если диапазон начинается после lastRow', () => {
      mockSheet.getLastRow.mockReturnValue(50);

      const result = collectDataFromRange('TestSheet', 'B51:B100');

      expect(result).toBe('');
      expect(addLog).toHaveBeenCalledWith(
        expect.stringContaining('начинается за границами данных'),
        'WARN',
      );
    });

    it('должен обрезать диапазон если endRow > lastRow', () => {
      mockSheet.getLastRow.mockReturnValue(50);
      mockRange.getValues.mockReturnValue([['Val1'], ['Val2']]);

      const result = collectDataFromRange('TestSheet', 'B1:B200');

      // Должен обрезать до B1:B50
      expect(mockSheet.getRange).toHaveBeenCalledWith('B1:B50');
      expect(result).toBe('Val1\nVal2');
    });
  });

  describe('🧪 ТЕСТ 9: Некорректный формат диапазона', () => {
    it('должен выбросить ошибку для некорректного формата', () => {
      mockSheet.getRange.mockImplementation(() => {
        throw new Error('Invalid range format');
      });

      expect(() => {
        collectDataFromRange('TestSheet', 'INVALID_RANGE');
      }).toThrow('Некорректный диапазон');
    });
  });

  describe('🧪 ТЕСТ 10: Смешанные данные (строки, числа, null)', () => {
    it('должен правильно обработать смешанные данные', () => {
      mockRange.getValues.mockReturnValue([
        ['Text'],
        [123],
        [null],
        [''],
        [456.78],
        [true],
      ]);

      const result = collectDataFromRange('TestSheet', 'B1:B10');

      // Должны остаться только непустые значения
      expect(result).toBe('Text\n123\n456.78\ntrue');
    });
  });

  describe('🧪 ТЕСТ 11: Пробелы в адресе', () => {
    it('должен обработать адрес с пробелами', () => {
      mockRange.getValues.mockReturnValue([['Value']]);

      const result = collectDataFromRange('TestSheet', '  B1  ');

      expect(mockSheet.getRange).toHaveBeenCalledWith('B1');
      expect(result).toBe('Value');
    });
  });

  describe('🧪 ТЕСТ 12: Нижний регистр', () => {
    it('должен нормализовать нижний регистр в верхний', () => {
      mockRange.getValues.mockReturnValue([['Value']]);

      const result = collectDataFromRange('TestSheet', 'b1');

      expect(mockSheet.getRange).toHaveBeenCalledWith('B1');
      expect(result).toBe('Value');
    });
  });
});
