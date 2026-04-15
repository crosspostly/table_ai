
// Используем относительные пути — nginx проксирует /api на воркер
const API_BASE_URL = '';

export const getUserMe = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/user/me`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) throw new Error('Failed to get user');
  return await response.json();
};

export const getContent = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/content`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) throw new Error('Failed to get content');
  return await response.json();
};

export const importPosts = async (token: string, source: string, url: string, count: number) => {
  const response = await fetch(`${API_BASE_URL}/api/content/import`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ source, url, count })
  });
  if (!response.ok) throw new Error('Failed to import posts');
  return await response.json();
};

export const importManualText = async (token: string, text: string, sourceType: string = 'reviews') => {
  const response = await fetch(`${API_BASE_URL}/api/content/manual-import`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text, sourceType })
  });
  if (!response.ok) throw new Error('Failed to import manual text');
  return await response.json();
};

export const importOcrImage = async (token: string, imageBase64: string, mimeType: string) => {
  const response = await fetch(`${API_BASE_URL}/api/content/ocr-import`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ imageBase64, mimeType })
  });
  if (!response.ok) throw new Error('Failed to import image for OCR');
  return await response.json();
};

export const analyzeBatch = async (token: string, promptId: string, contentIds: string[]) => {
  const response = await fetch(`${API_BASE_URL}/api/ai/analyze-batch`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ promptId, contentIds })
  });
  if (!response.ok) throw new Error('Failed to analyze batch');
  return await response.json();
};

export const analyzeContent = async (token: string, prompt: string, text: string, options: { contentId?: string, promptId?: string, maxTokens?: number, temperature?: number } = {}) => {
  const { contentId, promptId, maxTokens = 2000, temperature = 0.7 } = options;
  const response = await fetch(`${API_BASE_URL}/api/ai/analyze`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt, text, maxTokens, temperature, contentId, promptId })
  });
  if (!response.ok) throw new Error('Failed to analyze content');
  return await response.json();
};

export const getResults = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/results`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) throw new Error('Failed to get results');
  return await response.json();
};

export const getPrompts = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/prompts`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) throw new Error('Failed to get prompts');
  return await response.json();
};

export const createPrompt = async (token: string, prompt: any) => {
  const response = await fetch(`${API_BASE_URL}/api/prompts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(prompt)
  });
  if (!response.ok) throw new Error('Failed to create prompt');
  return await response.json();
};

export const updatePrompt = async (token: string, id: string, prompt: any) => {
  const response = await fetch(`${API_BASE_URL}/api/prompts/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(prompt)
  });
  if (!response.ok) throw new Error('Failed to update prompt');
  return await response.json();
};

export const deletePrompt = async (token: string, id: string) => {
  const response = await fetch(`${API_BASE_URL}/api/prompts/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) throw new Error('Failed to delete prompt');
  return await response.json();
};
