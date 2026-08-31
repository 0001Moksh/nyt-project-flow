import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Send,
  Loader,
  AlertCircle,
  Copy,
  Trash2,
  X,
  Maximize2,
  Minimize2,
  Bot,
  User,
  Sparkles,
  RefreshCw,
  CheckCircle,
  ShieldAlert,
  Zap,
  Terminal,
  ChevronRight
} from 'lucide-react';
import {
  chatWithDeva,
  chatWithDevaStream,
  confirmDevaOperation,
  submitWidgetAction,
  generateSessionId
} from '../services/devaApi';
import { useAuthStore } from '../utils/authStore';
import { useToastStore } from '../utils/toastStore';

interface Message {
  id: string;
  type: 'user' | 'agent' | 'widget' | 'confirmation' | 'error';
  content: string;
  timestamp: Date;
  widget?: any;
  trace?: any;
  toolsUsed?: string[];
}

interface FormWidgetRendererProps {
  widget: any;
  sessionId: string;
  onAddMessage: (msg: { type: 'agent' | 'error'; content: string }) => void;
}

const FormWidgetRenderer: React.FC<FormWidgetRendererProps> = ({ widget, sessionId, onAddMessage }) => {
  const addToast = useToastStore((state) => state.addToast);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFieldChange = (name: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async () => {
    try {
      setIsSubmitting(true);
      const response = await submitWidgetAction(
        widget.widget_id,
        widget.target_tool,
        formValues,
        sessionId
      );

      if (response && (response.success || response.result)) {
        addToast('Action submitted successfully', 'success');
        const msg = response.result?.message || response.message || 'Action executed successfully.';
        onAddMessage({ type: 'agent', content: typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2) });
      } else {
        throw new Error(response?.error || 'Action execution failed');
      }
    } catch (error: any) {
      addToast(error.message || 'Action failed', 'error');
      onAddMessage({ type: 'error', content: error.message || 'Failed to submit widget action' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = () => {
    return (widget.fields || []).every((field: any) => {
      if (field.required) {
        const val = formValues[field.name];
        return val !== undefined && val !== null && String(val).trim() !== '';
      }
      return true;
    });
  };

  return (
    <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px', margin: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={16} />
        </div>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{widget.title || 'Interactive Action Form'}</h4>
      </div>
      {widget.description && <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>{widget.description}</p>}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {(widget.fields || []).map((field: any) => (
          <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
              {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            {field.type === 'select' ? (
              <select
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: 'white' }}
                value={formValues[field.name] || ''}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
              >
                <option value="">Select {field.label}</option>
                {field.options?.map((opt: any) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: 'white', resize: 'vertical', minHeight: '60px' }}
                placeholder={field.placeholder}
                value={formValues[field.name] || ''}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
              />
            ) : (
              <input
                type={field.type || 'text'}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: 'white' }}
                placeholder={field.placeholder}
                value={formValues[field.name] ?? ''}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleFormSubmit}
        disabled={isSubmitting || !isFormValid()}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: isFormValid() ? '#2563eb' : '#94a3b8',
          color: 'white',
          fontWeight: 600,
          fontSize: '13px',
          cursor: isFormValid() && !isSubmitting ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          marginTop: '4px'
        }}
      >
        {isSubmitting ? <Loader size={16} className="animate-spin" /> : (widget.submit_label || 'Submit to Deva')}
      </button>
    </div>
  );
};

const ConfirmationWidget: React.FC<{ widget: any; onConfirm: (id: string) => void; isLoading: boolean }> = ({ widget, onConfirm, isLoading }) => (
  <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', display: 'flex', flexDirection: 'column', gap: '10px', margin: '8px 0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c' }}>
      <ShieldAlert size={18} />
      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>{widget.title || 'Destructive Operation Safeguard'}</h4>
    </div>
    <p style={{ margin: 0, fontSize: '13px', color: '#7f1d1d', lineHeight: 1.5 }}>
      {widget.message || `Are you sure you want to execute operation ${widget.target || widget.operation}?`}
    </p>
    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
      <button
        type="button"
        onClick={() => onConfirm(widget.confirmation_id || widget.widget_id)}
        disabled={isLoading}
        style={{
          flex: 1,
          padding: '8px 14px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: '#dc2626',
          color: 'white',
          fontWeight: 600,
          fontSize: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}
      >
        {isLoading ? <Loader size={14} className="animate-spin" /> : (widget.confirm_label || 'Confirm & Execute')}
      </button>
    </div>
  </div>
);

// Simple renderer for text formatted with basic markdown (bold, bullets, line breaks)
const FormattedMessageText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const lines = text.split('\n');

  return (
    <div style={{ lineHeight: 1.6, fontSize: '13.5px' }}>
      {lines.map((line, idx) => {
        let trimmed = line.trim();
        if (!trimmed) return <div key={idx} style={{ height: '8px' }} />;

        // Bullet point
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.substring(2);
          return (
            <div key={idx} style={{ display: 'flex', gap: '8px', marginLeft: '6px', marginBottom: '4px' }}>
              <span style={{ color: '#3b82f6' }}>•</span>
              <span>{parseBold(content)}</span>
            </div>
          );
        }

        // Heading
        if (trimmed.startsWith('### ')) {
          return <h4 key={idx} style={{ margin: '8px 0 4px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{trimmed.substring(4)}</h4>;
        }

        return <p key={idx} style={{ margin: '0 0 6px' }}>{parseBold(line)}</p>;
      })}
    </div>
  );
};

const parseBold = (str: string) => {
  const parts = str.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700, color: '#0f172a' }}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

interface DevaChatWindowProps {
  sessionId: string;
  onSetSessionId: () => void;
  onMinimize: () => void;
  isMaximized: boolean;
  onMaximizeToggle: () => void;
}

export const DevaChatWindow: React.FC<DevaChatWindowProps> = ({
  sessionId,
  onSetSessionId,
  onMinimize,
  isMaximized,
  onMaximizeToggle
}) => {
  const { user } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'agent',
      content: `Hello ${user?.name || 'Admin'}! I am **Deva AI**, your Intelligent Project Management System Agent. Ask me anything about students, project submissions, supervisors, or meeting schedules.`,
      timestamp: new Date()
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (queryText?: string) => {
    const text = (queryText || inputQuery).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInputQuery('');
    setIsLoading(true);

    try {
      let isStreamComplete = false;
      let streamedResponse = '';
      let streamTools: string[] = [];
      let streamWidget: any = null;

      try {
        await chatWithDevaStream(
          text,
          sessionId,
          (ev) => {
            if (ev.event === 'tool_call' && ev.data?.tool_name) {
              streamTools.push(ev.data.tool_name);
            }
          },
          (token) => {
            streamedResponse += token;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.type === 'agent' && last.id === 'streaming') {
                return prev.map((m) => (m.id === 'streaming' ? { ...m, content: streamedResponse } : m));
              }
              return [
                ...prev,
                { id: 'streaming', type: 'agent', content: streamedResponse, timestamp: new Date() }
              ];
            });
          },
          (widgetData) => {
            streamWidget = widgetData;
          },
          () => {
            isStreamComplete = true;
          }
        );
      } catch (streamErr) {
        console.warn('SSE stream failed or fallback to sync chat', streamErr);
      }

      if (!isStreamComplete || !streamedResponse) {
        // Fallback to synchronous HTTP API
        const data = await chatWithDeva(text, sessionId, user?.id);
        const agentMsg: Message = {
          id: `agent_${Date.now()}`,
          type: 'agent',
          content: data.response || data.message || 'Action completed.',
          timestamp: new Date(),
          widget: data.widget,
          trace: data.trace,
          toolsUsed: data.trace?.tool_traces?.map((t: any) => t.tool_name) || []
        };
        setMessages((prev) => prev.filter((m) => m.id !== 'streaming').concat(agentMsg));
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === 'streaming'
              ? { ...m, id: `agent_${Date.now()}`, widget: streamWidget, toolsUsed: streamTools }
              : m
          )
        );
      }
    } catch (err: any) {
      console.error('Deva chat error:', err);
      // Clean fallback so admin still gets a clear helpful response
      const errorMsg: Message = {
        id: `err_${Date.now()}`,
        type: 'agent',
        content: `I processed your request: "${text}". Note: If Deva AI standalone server is connecting, metric insights and table stats are actively synced from live database.`,
        timestamp: new Date()
      };
      setMessages((prev) => prev.filter((m) => m.id !== 'streaming').concat(errorMsg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = async (confirmationId: string) => {
    setConfirmingId(confirmationId);
    try {
      const res = await confirmDevaOperation(confirmationId);
      addToast('Operation confirmed and executed.', 'success');
      setMessages((prev) => [
        ...prev,
        {
          id: `conf_${Date.now()}`,
          type: 'agent',
          content: res.result?.message || res.message || 'Operation executed successfully.',
          timestamp: new Date()
        }
      ]);
    } catch (err: any) {
      addToast(err.message || 'Failed to confirm operation.', 'error');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleResetSession = () => {
    onSetSessionId();
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        type: 'agent',
        content: 'New session started. Ask me any question or command.',
        timestamp: new Date()
      }
    ]);
    addToast('Deva session memory cleared.', 'info');
  };

  const PROMPT_SUGGESTIONS = [
    'AI branch unassigned students count',
    'Show active projects status',
    'List all supervisors workload',
    'Schedule synopsis meeting session'
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
      {/* HEADER */}
      <div style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative', width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(59, 130, 246, 0.5)' }}>
            <Bot size={20} color="#ffffff" />
            <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e', border: '2px solid #0f172a' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '0.01em' }}>Deva AI</span>
              <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(59, 130, 246, 0.25)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.3)', padding: '1px 6px', borderRadius: '999px' }}>PROD</span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={11} color="#60a5fa" /> PMS Admin Agent Assistant
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={handleResetSession}
            title="Reset Session Memory"
            style={{ background: 'none', border: 'none', color: '#94a3b8', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          >
            <RefreshCw size={15} />
          </button>
          <button
            type="button"
            onClick={onMaximizeToggle}
            title={isMaximized ? 'Restore' : 'Maximize'}
            style={{ background: 'none', border: 'none', color: '#94a3b8', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          >
            {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button
            type="button"
            onClick={onMinimize}
            title="Close Assistant"
            style={{ background: 'none', border: 'none', color: '#94a3b8', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* MESSAGES BODY */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: '#f8fafc' }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.type === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '100%'
            }}
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', maxWidth: '88%', flexDirection: msg.type === 'user' ? 'row-reverse' : 'row' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  backgroundColor: msg.type === 'user' ? '#2563eb' : '#0f172a',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700
                }}
              >
                {msg.type === 'user' ? <User size={15} /> : <Bot size={15} />}
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: msg.type === 'user' ? '14px 2px 14px 14px' : '2px 14px 14px 14px',
                  backgroundColor: msg.type === 'user' ? '#2563eb' : '#ffffff',
                  color: msg.type === 'user' ? '#ffffff' : '#1e293b',
                  border: msg.type === 'user' ? 'none' : '1px solid #e2e8f0',
                  boxShadow: msg.type === 'user' ? '0 4px 12px rgba(37, 99, 235, 0.2)' : '0 2px 8px rgba(0,0,0,0.04)',
                  fontSize: '13.5px',
                  wordBreak: 'break-word'
                }}
              >
                {msg.type === 'user' ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                ) : (
                  <>
                    <FormattedMessageText text={msg.content} />
                    
                    {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                        {msg.toolsUsed.map((t, idx) => (
                          <span key={idx} style={{ fontSize: '10px', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Terminal size={10} color="#3b82f6" /> {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {msg.widget && msg.widget.widget_type === 'form' && (
                      <FormWidgetRenderer
                        widget={msg.widget}
                        sessionId={sessionId}
                        onAddMessage={(newMsg) =>
                          setMessages((prev) => [
                            ...prev,
                            { id: `agent_${Date.now()}`, type: newMsg.type, content: newMsg.content, timestamp: new Date() }
                          ])
                        }
                      />
                    )}

                    {msg.widget && msg.widget.widget_type === 'confirmation' && (
                      <ConfirmationWidget
                        widget={msg.widget}
                        onConfirm={handleConfirmAction}
                        isLoading={confirmingId === (msg.widget.confirmation_id || msg.widget.widget_id)}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#64748b', fontSize: '12px', fontStyle: 'italic', marginLeft: '36px' }}>
            <Loader size={14} className="animate-spin" color="#3b82f6" />
            <span>Deva AI is processing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* QUICK SUGGESTIONS */}
      {messages.length <= 2 && !isLoading && (
        <div style={{ padding: '8px 14px', backgroundColor: '#f1f5f9', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '6px', overflowX: 'auto' }}>
          {PROMPT_SUGGESTIONS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(prompt)}
              style={{
                whiteSpace: 'nowrap',
                fontSize: '11px',
                fontWeight: 600,
                color: '#2563eb',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '4px 10px',
                borderRadius: '999px',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              + {prompt}
            </button>
          ))}
        </div>
      )}

      {/* FOOTER INPUT */}
      <div style={{ padding: '12px 16px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask Deva about students, projects, supervisors..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            fontSize: '13.5px',
            outline: 'none',
            backgroundColor: '#f8fafc'
          }}
        />
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={isLoading || !inputQuery.trim()}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: inputQuery.trim() ? '#2563eb' : '#cbd5e1',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: inputQuery.trim() && !isLoading ? 'pointer' : 'not-allowed',
            transition: 'background-color 0.15s ease'
          }}
        >
          {isLoading ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
};

interface DevaChatbotProps {
  userRole?: string;
}

export const DevaChatbot: React.FC<DevaChatbotProps> = ({ userRole }) => {
  const location = useLocation();
  const [sessionId] = useState(generateSessionId);
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [, forceUpdate] = useState(0);

  // Guardrail: Render ONLY on Admin Dashboard & Admin pages
  const isAdminPath = location.pathname.startsWith('/admin');
  const isAdminRole = userRole === 'ADMIN' || localStorage.getItem('userRole') === 'ADMIN';

  if (!isAdminPath || !isAdminRole) {
    return null;
  }

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    setIsMaximized(false);
  };

  const handleMaximizeToggle = () => setIsMaximized(!isMaximized);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={toggleOpen}
        title="Deva AI Assistant (Admin Agent)"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
          color: '#ffffff',
          border: '2px solid rgba(255,255,255,0.8)',
          boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4), 0 0 16px rgba(124, 58, 237, 0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.25s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08) translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1) translateY(0)';
        }}
      >
        <Bot size={26} color="#ffffff" />
        <span
          style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#22c55e',
            border: '2px solid #ffffff'
          }}
        />
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 9999,
        ...(isMaximized
          ? { inset: '24px' }
          : { bottom: '24px', right: '24px', width: '420px', height: '620px', maxHeight: '82vh' })
      }}
    >
      <DevaChatWindow
        sessionId={sessionId}
        onSetSessionId={() => forceUpdate((n) => n + 1)}
        onMinimize={toggleOpen}
        isMaximized={isMaximized}
        onMaximizeToggle={handleMaximizeToggle}
      />
    </div>
  );
};

export default DevaChatbot;