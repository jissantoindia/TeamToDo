import { useState, useEffect } from 'react';
import { databases, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { ID, Query } from 'appwrite';
import { useAuth } from '../context/AuthContext';
import { Bell, Send, Plus, X, Inbox, Megaphone } from 'lucide-react';

export default function Notifications() {
    const { user, hasPermission } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showComposeModal, setShowComposeModal] = useState(false);
    const [members, setMembers] = useState([]);

    const canSend = hasPermission('manage_roles') || hasPermission('manage_team');

    const [form, setForm] = useState({
        title: '', message: '', type: 'general', targetUserId: ''
    });

    useEffect(() => {
        fetchNotifications();
        if (canSend) fetchMembers();
    }, []);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            // Fetch notifications for this user + broadcasts (no targetUserId)
            const [userNotifs, broadcastNotifs] = await Promise.all([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.NOTIFICATIONS, [
                    Query.equal('targetUserId', user.$id),
                    Query.orderDesc('$createdAt'),
                    Query.limit(50)
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.NOTIFICATIONS, [
                    Query.equal('targetUserId', ''),
                    Query.orderDesc('$createdAt'),
                    Query.limit(50)
                ])
            ]);

            // Merge and sort by date
            const all = [...userNotifs.documents, ...broadcastNotifs.documents];
            all.sort((a, b) => new Date(b.$createdAt) - new Date(a.$createdAt));
            setNotifications(all);
        } catch (error) {
            // If collection doesn't exist yet, show empty
            console.error('Error fetching notifications:', error);
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchMembers = async () => {
        try {
            const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [Query.limit(100)]);
            setMembers(res.documents);
        } catch (error) {
            console.error('Error fetching members:', error);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        try {
            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.NOTIFICATIONS,
                ID.unique(),
                {
                    title: form.title,
                    message: form.message,
                    type: form.type,
                    targetUserId: form.targetUserId || '',
                    createdBy: user.$id
                }
            );
            setShowComposeModal(false);
            setForm({ title: '', message: '', type: 'general', targetUserId: '' });
            fetchNotifications();
        } catch (error) {
            console.error('Error sending notification:', error);
            alert('Failed to send notification. Make sure the notifications collection exists.');
        }
    };

    const handleDelete = async (id) => {
        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.NOTIFICATIONS, id);
            fetchNotifications();
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'leave': return '📅';
            case 'task': return '📋';
            case 'holiday': return '🎉';
            default: return '📢';
        }
    };

    const getTypeBadge = (type) => {
        const styles = {
            general: 'bg-blue-100 text-blue-800',
            leave: 'bg-purple-100 text-purple-800',
            task: 'bg-green-100 text-green-800',
            holiday: 'bg-amber-100 text-amber-800'
        };
        return styles[type] || styles.general;
    };

    const timeAgo = (dateStr) => {
        const now = new Date();
        const date = new Date(dateStr);
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Notifications</h1>
                    <p className="mt-1 text-sm text-gray-500">Stay updated with team announcements and alerts.</p>
                </div>
                {canSend && (
                    <button onClick={() => setShowComposeModal(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-all">
                        <Megaphone className="-ml-1 mr-2 h-5 w-5" />
                        Send Notification
                    </button>
                )}
            </div>

            {/* Notification List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-12 text-center text-gray-500">
                        Loading notifications...
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-16 text-center">
                        <Inbox className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 font-medium">No notifications yet</p>
                        <p className="text-sm text-gray-400 mt-1">You're all caught up!</p>
                    </div>
                ) : (
                    notifications.map((n) => (
                        <div key={n.$id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-4">
                                <div className="text-2xl flex-shrink-0 mt-0.5">
                                    {getTypeIcon(n.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-sm font-bold text-gray-900 truncate">{n.title}</h3>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getTypeBadge(n.type)}`}>
                                            {n.type}
                                        </span>
                                        {!n.targetUserId && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                                                All Users
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600 leading-relaxed">{n.message}</p>
                                    <p className="text-xs text-gray-400 mt-2">{timeAgo(n.$createdAt)}</p>
                                </div>
                                {canSend && (
                                    <button onClick={() => handleDelete(n.$id)}
                                        className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Compose Modal */}
            {showComposeModal && (
                <div className="fixed z-50 inset-0 overflow-y-auto" role="dialog">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-black/60" onClick={() => setShowComposeModal(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                        <div className="relative z-10 inline-block align-bottom bg-white rounded-2xl px-4 pt-5 pb-4 text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900">Send Notification</h3>
                                <button onClick={() => setShowComposeModal(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <form onSubmit={handleSend} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Title</label>
                                    <input type="text" required
                                        className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                                        placeholder="Notification title"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Type</label>
                                        <select
                                            className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={form.type}
                                            onChange={(e) => setForm({ ...form, type: e.target.value })}
                                        >
                                            <option value="general">General</option>
                                            <option value="leave">Leave</option>
                                            <option value="task">Task</option>
                                            <option value="holiday">Holiday</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Send To</label>
                                        <select
                                            className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={form.targetUserId}
                                            onChange={(e) => setForm({ ...form, targetUserId: e.target.value })}
                                        >
                                            <option value="">All Users (Broadcast)</option>
                                            {members.map(m => (
                                                <option key={m.$id} value={m.userId || m.$id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Message</label>
                                    <textarea rows={4} required
                                        className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        value={form.message}
                                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                                        placeholder="Write your message..."
                                    />
                                </div>
                                <div className="mt-5 sm:mt-6 flex flex-row gap-3">
                                    <button type="button" onClick={() => setShowComposeModal(false)}
                                        className="flex-1 rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                                        Cancel
                                    </button>
                                    <button type="submit"
                                        className="flex-1 rounded-lg border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 inline-flex items-center justify-center">
                                        <Send className="h-4 w-4 mr-2" /> Send
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
