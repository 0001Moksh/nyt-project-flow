import axios from 'axios';
import { useToastStore } from '../utils/toastStore';
import { API_BASE_URL } from './api';

const PRIMARY_DEVA_URL =
  import.meta.env.VITE_DEVA_API_BASE_URL ||
  (import.meta.env.PROD ? `${API_BASE_URL.replace(/\/$/, '')}/deva` : 'http://localhost:8000/api/v1/agent');

const FALLBACK_DEVA_URL = `${API_BASE_URL.replace(/\/$/, '')}/deva`;

const DEVA_API_KEY = import.meta.env.VITE_DEVA_API_KEY || 'deva_admin_secret_api_key_2026';

/**
 * Axios instance for Deva API calls
 */
export const devaApi = axios.create({
  baseURL: PRIMARY_DEVA_URL,
  timeout: 30000,
});

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('authToken');
  const headers: Record<string, string> = {
    'X-API-Key': DEVA_API_KEY,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

devaApi.interceptors.request.use(
  (config) => {
    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');

    if (userId) {
      config.headers['X-User-ID'] = userId;
    }
    if (userRole) {
      config.headers['X-User-Role'] = userRole;
    }

    Object.assign(config.headers, getAuthHeaders());
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Generate a unique session ID
 */
export const generateSessionId = (): string => {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Chat with Deva Agent (Synchronous)
 */
export const chatWithDeva = async (query: string, sessionId?: string, adminId?: string) => {
  const sid = sessionId || generateSessionId();
  const payload = {
    query,
    session_id: sid,
    admin_id: adminId || localStorage.getItem('userId') || 'admin_sys',
  };

  const headers = getAuthHeaders();

  try {
    const response = await axios.post(`${PRIMARY_DEVA_URL}/chat`, payload, {
      headers,
      timeout: 25000,
    });
    return response.data;
  } catch (primaryErr) {
    console.warn('Primary Deva agent (8000) unreachable, attempting fallback (8080)...', primaryErr);
    try {
      const response = await axios.post(`${FALLBACK_DEVA_URL}/chat`, payload, {
        headers,
        timeout: 25000,
      });
      return response.data;
    } catch (fallbackErr: any) {
      console.error('Both Deva endpoints failed:', fallbackErr);
      throw fallbackErr;
    }
  }
};

export interface SseEvent {
  event: string;
  data: any;
}

/**
 * Chat with Deva Agent (Streaming SSE)
 */
export const chatWithDevaStream = async (
  query: string,
  sessionId: string | undefined,
  onEvent?: (event: SseEvent) => void,
  onToken?: (token: string) => void,
  onWidget?: (widget: any) => void,
  onComplete?: (session: { sessionId: string; trace: any }) => void,
  onError?: (error: string) => void
) => {
  const sid = sessionId || generateSessionId();
  const dispatch = (event: string, data: any) => {
    const payload = { event, data };
    onEvent?.(payload);
    if (event === 'token' && onToken) onToken(data.token);
    if (event === 'widget' && onWidget) onWidget(data);
    if (event === 'done' && onComplete) onComplete({ sessionId: data.session_id || sid, trace: data.trace });
  };

  const tryStream = async (baseUrl: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-User-ID': localStorage.getItem('userId') || '',
      ...getAuthHeaders(),
    };

    const response = await fetch(`${baseUrl}/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        session_id: sid,
        admin_id: localStorage.getItem('userId') || 'admin_sys',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    if (!response.body) {
      throw new Error('Response body is not readable');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let eventBoundary: number;

      while ((eventBoundary = buffer.indexOf('\n\n')) >= 0) {
        const rawEvent = buffer.slice(0, eventBoundary);
        buffer = buffer.slice(eventBoundary + 2);

        let eventType = '';
        let eventData = '';

        for (const line of rawEvent.split('\n')) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            eventData += line.slice(5).trim();
          }
        }

        if (eventType && eventData) {
          try {
            dispatch(eventType, JSON.parse(eventData));
          } catch {
            dispatch(eventType, { raw: eventData });
          }
        }
      }
    }
  };

  try {
    await tryStream(PRIMARY_DEVA_URL);
  } catch (err) {
    console.warn('Streaming on primary URL failed, trying fallback...', err);
    try {
      await tryStream(FALLBACK_DEVA_URL);
    } catch (fallbackErr: any) {
      const msg = fallbackErr?.message || 'Failed to stream from Deva';
      onError?.(msg);
      throw fallbackErr;
    }
  }
};

/**
 * Confirm a destructive operation
 */
export const confirmDevaOperation = async (confirmationId: string) => {
  const headers = getAuthHeaders();
  const body = { confirmation_id: confirmationId };
  try {
    const response = await axios.post(`${PRIMARY_DEVA_URL}/confirm`, body, { headers });
    return response.data;
  } catch (err) {
    const response = await axios.post(`${FALLBACK_DEVA_URL}/confirm`, body, { headers });
    return response.data;
  }
};

/**
 * Submit widget form data
 */
export const submitWidgetAction = async (
  widgetId: string,
  targetTool: string,
  payload: Record<string, any>,
  sessionId?: string
) => {
  const headers = getAuthHeaders();
  const body = {
    widget_id: widgetId,
    target_tool: targetTool,
    payload,
    session_id: sessionId || generateSessionId(),
  };
  try {
    const response = await axios.post(`${PRIMARY_DEVA_URL}/widget-action`, body, { headers });
    return response.data;
  } catch (err) {
    const response = await axios.post(`${FALLBACK_DEVA_URL}/widget-action`, body, { headers });
    return response.data;
  }
};

export const getDevaHealth = async () => {
  try {
    const res = await axios.get(`${PRIMARY_DEVA_URL}/health`, { headers: getAuthHeaders() });
    return res.data;
  } catch {
    const res = await axios.get(`${FALLBACK_DEVA_URL}/health`, { headers: getAuthHeaders() });
    return res.data;
  }
};

export default devaApi;
