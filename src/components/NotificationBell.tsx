import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../services/api';

interface Notification {
    id: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    link?: string; // 🔥 NEW (for navigation)
}

interface NotificationBellProps {
    userId: string;
    onNotificationClick?: (notif: Notification) => void; // 🔥 NEW
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
    userId,
    onNotificationClick
}) => {

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        if (!userId) return;

        try {
            setLoading(true);

            const [notifRes, countRes] = await Promise.all([
                api.get(`/notifications/${userId}?limit=10`), // 🔥 pagination ready
                api.get(`/notifications/${userId}/unread-count`)
            ]);

            setNotifications(notifRes.data);
            setUnreadCount(countRes.data.count);

        } catch (error) {
            console.error('Failed to fetch notifications');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();

        const interval = setInterval(fetchNotifications, 10000);
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
                await api.put(`/notifications/user/${userId}/read-all`);
                setUnreadCount(0);

                setNotifications(prev =>
                    prev.map(n => ({ ...n, isRead: true }))
                );
            } catch (error) {
                console.error('Failed to mark notifications as read');
            }
        }
    };

    // 🔥 NEW: mark single notification as read
    const markSingleRead = async (id: string) => {
        try {
            await api.put(`/notifications/${id}/read`);

            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, isRead: true } : n)
            );

            setUnreadCount(prev => Math.max(prev - 1, 0));
        } catch (err) {
            console.error('Failed to mark single notification');
        }
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            + ' • ' + date.toLocaleDateString();
    };

    if (!userId) return null;

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef}>

            {/* 🔔 BUTTON */}
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

                {/* 🔴 BADGE */}
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
                        height: '18px',
                        minWidth: '18px',
                        padding: '0 4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* 📩 DROPDOWN */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    width: '360px',
                    maxHeight: '420px',
                    backgroundColor: 'white',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    zIndex: 1000,
                    marginTop: '8px'
                }}>

                    {/* HEADER */}
                    <div style={{
                        padding: '14px 16px',
                        borderBottom: '1px solid var(--border-color)',
                        fontWeight: 600
                    }}>
                        Notifications
                    </div>

                    {/* BODY */}
                    <div style={{
                        maxHeight: '340px',
                        overflowY: 'auto'
                    }}>

                        {loading ? (
                            <div style={{ padding: '16px', textAlign: 'center' }}>
                                Loading...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div style={{
                                padding: '16px',
                                textAlign: 'center',
                                color: 'var(--text-disabled)'
                            }}>
                                No notifications
                            </div>
                        ) : (
                            notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    onClick={() => {
                                        markSingleRead(notification.id);
                                        onNotificationClick?.(notification);
                                    }}
                                    style={{
                                        padding: '12px 16px',
                                        cursor: 'pointer',
                                        backgroundColor: notification.isRead ? '#fff' : '#ecfdf5',
                                        borderBottom: '1px solid #f1f1f1',
                                        transition: '0.2s'
                                    }}
                                >
                                    <div style={{
                                        fontSize: '14px',
                                        fontWeight: notification.isRead ? 400 : 600
                                    }}>
                                        {notification.message}
                                    </div>

                                    <div style={{
                                        fontSize: '11px',
                                        color: '#777',
                                        marginTop: '4px'
                                    }}>
                                        {formatTime(notification.createdAt)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* FOOTER */}
                    <div
                        style={{
                            padding: '10px',
                            textAlign: 'center',
                            borderTop: '1px solid #eee',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                        onClick={() => console.log('Go to all notifications')}
                    >
                        View All
                    </div>
                </div>
            )}
        </div>
    );
};