import React, { useState } from 'react';
import { MessageSquare, X, Send, Bot } from 'lucide-react';
import { Card } from './index';

export const GlobalChatbot: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
        { role: 'bot', text: 'Hi! I am the NYT Project Flow AI Assistant. I can help you understand grading rubrics, predict project risks, or navigate your dashboard based on the curriculum guidelines. How can I help?' }
    ]);
    const [input, setInput] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    
    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        const newMessages = [...messages, { role: 'user', text: input } as const];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const CHATBOT_URL = import.meta.env.VITE_CHATBOT_URL || 'http://localhost:8000/chat';
            // Use a mock user ID for the global chatbot if auth user is not available
            const userId = 'global-user-' + Math.floor(Math.random() * 1000);
            
            const response = await fetch(CHATBOT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, message: input })
            });
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            const data = await response.json();
            setMessages([...newMessages, { role: 'bot', text: data.response || 'No response from Deva.' }]);
        } catch (error) {
            console.error('Chatbot API Error:', error);
            setMessages([...newMessages, { role: 'bot', text: 'Sorry, I am currently unavailable. Please try again later.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed', bottom: '24px', right: '24px',
                    width: '60px', height: '60px', borderRadius: '30px',
                    backgroundColor: 'var(--primary)', color: 'white',
                    border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}
            >
                <MessageSquare size={28} />
            </button>
        );
    }

    return (
        <Card elevation={3} style={{
            position: 'fixed', bottom: '24px', right: '24px',
            width: '350px', height: '500px', display: 'flex', flexDirection: 'column',
            padding: 0, zIndex: 1000, overflow: 'hidden', border: '1px solid var(--border-color)'
        }}>
            {/* HEADER */}
            <div style={{ padding: '16px', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bot size={20} />
                    <span style={{ fontWeight: 600 }}>Deva AI Assistant</span>
                </div>
                <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                    <X size={20} />
                </button>
            </div>

            {/* CHAT AREA */}
            <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--background)' }}>
                {messages.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                            maxWidth: '80%', padding: '10px 14px', borderRadius: '16px', fontSize: '14px', lineHeight: '1.4',
                            backgroundColor: m.role === 'user' ? 'var(--primary)' : 'var(--surface-hover)',
                            color: m.role === 'user' ? 'white' : 'var(--text-primary)',
                            borderBottomRightRadius: m.role === 'user' ? '4px' : '16px',
                            borderBottomLeftRadius: m.role === 'bot' ? '4px' : '16px',
                        }}>
                            {m.text}
                        </div>
                    </div>
                ))}
            </div>

            {/* INPUT START */}
            <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--surface)', display: 'flex', gap: '8px' }}>
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask about project rules..."
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '20px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                />
                <button
                    onClick={handleSend}
                    style={{ width: '36px', height: '36px', borderRadius: '18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                >
                    <Send size={16} />
                </button>
            </div>
        </Card>
    );
};
