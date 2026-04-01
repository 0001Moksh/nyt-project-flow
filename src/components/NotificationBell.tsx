import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../services/api';

interface Notification {
    id: string;
    message: string;
    isRead: boolean;
    createdAt: string;
}

interface NotificationBellProps {
    userId: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ userId }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        if (!userId) return;
        try {
            const [notifRes, countRes] = await Promise.all([
                api.get(`/notifications/${userId}`),
                api.get(`/notifications/${userId}/unread-count`)
            ]);
            setNotifications(notifRes.data);
            setUnreadCount(countRes.data.count);
        } catch (error) {
            console.error('Failed to fetch notifications');
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [userId]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = async () => {
        setIsOpen(!isOpen);
        if (!isOpen && unreadCount > 0) {
            try {
                // Mark all as read when opening dropdown
                await api.put(`/notifications/user/${userId}/read-all`);
                setUnreadCount(0);
                setNotifications(notifications.map(n => ({ ...n, isRead: true })));
            } catch (error) {
                console.error('Failed to mark notifications as read');
            }
        }
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString();
    };

    if (!userId) return null;

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button 
                onClick={handleToggle}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)'
                }}
            >
                <Bell size={24} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        borderRadius: '50%',
                        height: '16px',
                        width: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid white'
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    width: '350px',
                    maxHeight: '400px',
                    backgroundColor: 'white',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    borderRadius: '8px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    border: '1px solid var(--border-color)',
                    marginTop: '8px'
                }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Notifications</h3>
                    </div>
                    <div style={{ padding: '8px 0' }}>
                        {notifications.length === 0 ? (
                            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-disabled)', fontSize: '14px' }}>
                                No notifications found.
                            </div>
                        ) : (
                            notifications.map(notification => (
                                <div key={notification.id} style={{
                                    padding: '12px 16px',
                                    backgroundColor: notification.isRead ? 'transparent' : '#f0fdf4',
                                    borderBottom: '1px solid var(--border-color)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px'
                                }}>
                                    <span style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                                        {notification.message}
                                    </span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                        {formatTime(notification.createdAt)}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
