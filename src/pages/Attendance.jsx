import { useState, useEffect } from 'react';
import { databases, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { ID, Query } from 'appwrite';
import { useAuth } from '../context/AuthContext';
import { Clock, LogIn, LogOut, CheckCircle, AlertCircle } from 'lucide-react';

export default function Attendance() {
    const { user } = useAuth();
    const [todaySessions, setTodaySessions] = useState([]); // multiple sessions per day
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        if (user) {
            fetchTodaySessions();
            fetchHistory();
        }
    }, [user]);

    const fetchTodaySessions = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.ATTENDANCE,
                [
                    Query.equal('userId', user.$id),
                    Query.equal('date', today),
                    Query.orderAsc('$createdAt')
                ]
            );
            setTodaySessions(response.documents);
        } catch (error) {
            console.error("Error checking attendance:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.ATTENDANCE,
                [
                    Query.equal('userId', user.$id),
                    Query.orderDesc('date'),
                    Query.limit(50)
                ]
            );
            setHistory(response.documents);
        } catch (error) {
            console.error("Error fetching history:", error);
        }
    };

    // Check if there's an active (open) session today
    const activeSession = todaySessions.find(s => s.checkInTime && !s.checkOutTime);
    const hasCheckedIn = todaySessions.length > 0;
    const totalTodayDuration = todaySessions.reduce((sum, s) => {
        if (s.checkInTime && s.checkOutTime) {
            return sum + (new Date(s.checkOutTime) - new Date(s.checkInTime));
        }
        return sum;
    }, 0);

    const handleCheckIn = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const today = now.toISOString().split('T')[0];

            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.ATTENDANCE,
                ID.unique(),
                {
                    userId: user.$id,
                    date: today,
                    checkInTime: now.toISOString(),
                    status: 'present'
                }
            );
            await fetchTodaySessions();
            await fetchHistory();
        } catch (error) {
            console.error("Error checking in:", error);
            alert("Failed to check in.");
        } finally {
            setLoading(false);
        }
    };

    const handleCheckOut = async () => {
        if (!activeSession) return;
        setLoading(true);
        try {
            const now = new Date();
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.ATTENDANCE,
                activeSession.$id,
                {
                    checkOutTime: now.toISOString()
                }
            );
            await fetchTodaySessions();
            await fetchHistory();
        } catch (error) {
            console.error("Error checking out:", error);
            alert("Failed to check out.");
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (isoString) => {
        if (!isoString) return '--:--';
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const calculateDuration = (start, end) => {
        if (!start || !end) return '-';
        const diff = new Date(end) - new Date(start);
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
    };

    const formatMs = (ms) => {
        if (!ms || ms <= 0) return '0h 0m';
        const hrs = Math.floor(ms / 3600000);
        const mins = Math.floor((ms % 3600000) / 60000);
        return `${hrs}h ${mins}m`;
    };

    // Group history by date for display
    const historyByDate = history.reduce((acc, record) => {
        const date = record.date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(record);
        return acc;
    }, {});

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-8">Attendance</h1>

            {/* Today's Status */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
                <div className="sm:flex sm:items-start sm:justify-between">
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center">
                            <Clock className="h-6 w-6 mr-2 text-indigo-600" />
                            Today's Status
                        </h2>
                        <p className="mt-2 text-gray-500">
                            Date: <span className="font-medium text-gray-900">{new Date().toLocaleDateString()}</span>
                        </p>

                        {/* Today's sessions summary */}
                        {todaySessions.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <p className="text-sm font-semibold text-gray-700">
                                    Sessions today: {todaySessions.length}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {todaySessions.map((session, idx) => (
                                        <div key={session.$id} className={`p-3 rounded-lg border ${!session.checkOutTime ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-medium text-gray-500">Session {idx + 1}</span>
                                                {!session.checkOutTime && (
                                                    <span className="text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded animate-pulse">ACTIVE</span>
                                                )}
                                            </div>
                                            <div className="mt-1 text-sm font-medium text-gray-900">
                                                {formatTime(session.checkInTime)} → {session.checkOutTime ? formatTime(session.checkOutTime) : '...'}
                                            </div>
                                            {session.checkOutTime && (
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    Duration: {calculateDuration(session.checkInTime, session.checkOutTime)}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {totalTodayDuration > 0 && (
                                    <p className="text-sm font-medium text-indigo-600 mt-2">
                                        Total checked-in time: {formatMs(totalTodayDuration)}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-8 sm:mt-0 sm:ml-8 flex flex-col items-center">
                        {activeSession ? (
                            /* Currently checked in → show Check Out */
                            <button
                                onClick={handleCheckOut}
                                disabled={loading}
                                className="flex items-center justify-center w-48 px-6 py-4 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all disabled:opacity-50"
                            >
                                <LogOut className="h-5 w-5 mr-2" />
                                Check Out
                            </button>
                        ) : (
                            /* No active session → show Check In */
                            <button
                                onClick={handleCheckIn}
                                disabled={loading}
                                className="flex items-center justify-center w-48 px-6 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all disabled:opacity-50"
                            >
                                <LogIn className="h-5 w-5 mr-2" />
                                Check In
                            </button>
                        )}
                        <p className="text-xs text-gray-400 mt-2 text-center">
                            You can check in and out<br />multiple times per day
                        </p>
                    </div>
                </div>
            </div>

            {/* Attendance History (grouped by date) */}
            <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">Recent History</h3>
                </div>
                <div className="divide-y divide-gray-100">
                    {Object.keys(historyByDate).length === 0 ? (
                        <div className="px-6 py-8 text-center text-gray-500 italic">No attendance records found.</div>
                    ) : (
                        Object.entries(historyByDate).map(([date, sessions]) => {
                            const totalDayMs = sessions.reduce((sum, s) => {
                                if (s.checkInTime && s.checkOutTime) {
                                    return sum + (new Date(s.checkOutTime) - new Date(s.checkInTime));
                                }
                                return sum;
                            }, 0);
                            return (
                                <div key={date} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center">
                                            <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                                {new Date(date).getDate()}
                                            </div>
                                            <div className="ml-4">
                                                <p className="text-sm font-medium text-gray-900">
                                                    {new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {sessions.length} session{sessions.length > 1 ? 's' : ''} · Total: {formatMs(totalDayMs)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-100 text-green-700">
                                                <CheckCircle className="h-3 w-3 mr-1" /> Present
                                            </span>
                                        </div>
                                    </div>
                                    <div className="ml-14 flex flex-wrap gap-2">
                                        {sessions.map((s, idx) => (
                                            <span key={s.$id} className="text-xs bg-gray-100 rounded-md px-2 py-1 text-gray-600">
                                                {formatTime(s.checkInTime)} – {s.checkOutTime ? formatTime(s.checkOutTime) : '...'}
                                                {s.checkOutTime && (
                                                    <span className="ml-1 text-gray-400">({calculateDuration(s.checkInTime, s.checkOutTime)})</span>
                                                )}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
