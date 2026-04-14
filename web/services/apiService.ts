
// Используем относительные пути — nginx проксирует /api на бэкенд (порт 8787)
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

export const importMockContent = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/content/mock-import`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) throw new Error('Failed to import mock content');
  return await response.json();
};
