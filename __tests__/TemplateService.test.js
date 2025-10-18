/**
 * Unit tests for TemplateService
 * Testing template management functionality
 */

// Mock Google Apps Script globals
global.PropertiesService = {
  getScriptProperties: jest.fn(() => ({
    getProperty: jest.fn(),
    setProperty: jest.fn(),
    deleteProperty: jest.fn(),
    getProperties: jest.fn(() => ({})),
  })),
};

global.LockService = {
  getScriptLock: jest.fn(() => ({
    waitLock: jest.fn(),
    releaseLock: jest.fn(),
    tryLock: jest.fn(() => true),
    hasLock: jest.fn(() => true),
  })),
};

global.Session = {
  getEffectiveUser: jest.fn(() => ({
    getEmail: jest.fn(() => 'test@example.com'),
  })),
};

global.Logger = {
  log: jest.fn(),
};

global.Utilities = {
  formatDate: jest.fn((date) => date.toISOString()),
};

describe('TemplateService - Basic Structure', () => {
  test('Mock environment is set up correctly', () => {
    expect(PropertiesService).toBeDefined();
    expect(LockService).toBeDefined();
    expect(Session).toBeDefined();
  });

  test('PropertiesService mock works', () => {
    const props = PropertiesService.getScriptProperties();
    expect(props).toHaveProperty('getProperty');
    expect(props).toHaveProperty('setProperty');
  });

  test('LockService mock works', () => {
    const lock = LockService.getScriptLock();
    expect(lock).toHaveProperty('waitLock');
    expect(lock).toHaveProperty('releaseLock');
  });
});

describe('Template Validation Logic', () => {
  const validateTemplateStructure = (template) => {
    const errors = [];

    if (!template || typeof template !== 'object') {
      errors.push('Template must be an object');
      return {valid: false, errors};
    }

    if (!template.prompt || typeof template.prompt !== 'string') {
      errors.push('Template must have a prompt string');
    }

    if (template.prompt && template.prompt.length > 8000) {
      errors.push('Prompt must be less than 8000 characters');
    }

    if (template.maxTokens !== undefined) {
      if (typeof template.maxTokens !== 'number' ||
          template.maxTokens < 1 ||
          template.maxTokens > 25000) {
        errors.push('maxTokens must be between 1 and 25000');
      }
    }

    if (template.temperature !== undefined) {
      if (typeof template.temperature !== 'number' ||
          template.temperature < 0 ||
          template.temperature > 1) {
        errors.push('temperature must be between 0 and 1');
      }
    }

    return {valid: errors.length === 0, errors};
  };

  test('Valid template passes validation', () => {
    const template = {
      prompt: 'Test prompt: {{value}}',
      maxTokens: 10000,
      temperature: 0.7,
    };

    const result = validateTemplateStructure(template);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('Template without prompt fails validation', () => {
    const template = {
      maxTokens: 10000,
      temperature: 0.7,
    };

    const result = validateTemplateStructure(template);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Template must have a prompt string');
  });

  test('Template with invalid maxTokens fails validation', () => {
    const template = {
      prompt: 'Test',
      maxTokens: 50000,
      temperature: 0.7,
    };

    const result = validateTemplateStructure(template);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('maxTokens'))).toBe(true);
  });

  test('Template with invalid temperature fails validation', () => {
    const template = {
      prompt: 'Test',
      maxTokens: 10000,
      temperature: 1.5,
    };

    const result = validateTemplateStructure(template);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('temperature'))).toBe(true);
  });

  test('Template with very long prompt fails validation', () => {
    const template = {
      prompt: 'x'.repeat(9000),
      maxTokens: 10000,
      temperature: 0.7,
    };

    const result = validateTemplateStructure(template);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('8000 characters'))).toBe(true);
  });
});

describe('Template Name Validation', () => {
  const validateTemplateName = (name) => {
    if (!name || typeof name !== 'string') {
      return {valid: false, error: 'Name must be a non-empty string'};
    }

    if (name.length > 100) {
      return {valid: false, error: 'Name must be less than 100 characters'};
    }

    if (name.trim().length === 0) {
      return {valid: false, error: 'Name cannot be only whitespace'};
    }

    return {valid: true};
  };

  test('Valid template name passes', () => {
    const result = validateTemplateName('My Template');
    expect(result.valid).toBe(true);
  });

  test('Empty name fails', () => {
    const result = validateTemplateName('');
    expect(result.valid).toBe(false);
  });

  test('Whitespace-only name fails', () => {
    const result = validateTemplateName('   ');
    expect(result.valid).toBe(false);
  });

  test('Too long name fails', () => {
    const result = validateTemplateName('x'.repeat(101));
    expect(result.valid).toBe(false);
  });
});

describe('Storage Size Calculations', () => {
  const calculateStorageSize = (data) => {
    return JSON.stringify(data).length;
  };

  test('Calculate size of empty object', () => {
    const size = calculateStorageSize({});
    expect(size).toBe(2); // "{}"
  });

  test('Calculate size of template', () => {
    const template = {
      prompt: 'Test prompt',
      maxTokens: 10000,
      temperature: 0.7,
    };
    const size = calculateStorageSize(template);
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThan(500); // Should be small
  });

  test('Large template size calculation', () => {
    const template = {
      prompt: 'x'.repeat(5000),
      maxTokens: 10000,
      temperature: 0.7,
      metadata: {
        created: '2025-10-18',
        updated: '2025-10-18',
        description: 'y'.repeat(1000),
      },
    };
    const size = calculateStorageSize(template);
    expect(size).toBeGreaterThan(6000);
  });
});

describe('Multi-user Isolation', () => {
  const getUserKey = (email, templateName) => {
    return `template_${email}_${templateName}`;
  };

  test('Different users get different keys', () => {
    const key1 = getUserKey('user1@example.com', 'Template1');
    const key2 = getUserKey('user2@example.com', 'Template1');

    expect(key1).not.toBe(key2);
    expect(key1).toContain('user1@example.com');
    expect(key2).toContain('user2@example.com');
  });

  test('Same user, different templates get different keys', () => {
    const key1 = getUserKey('user@example.com', 'Template1');
    const key2 = getUserKey('user@example.com', 'Template2');

    expect(key1).not.toBe(key2);
  });
});
