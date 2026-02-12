import { useEffect, useState } from 'react';
import { databases, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { ID, Query } from 'appwrite';
import { useAuth } from '../context/AuthContext';
import { FolderKanban, CheckSquare, Clock, Users, LogIn, LogOut, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        projects: 0,
        tasks: 0,
        activeTasks: 0,
        completedProjects: 0,
        teamMembers: 0
    });
    const [loading, setLoading] = useState(true);
    const [todaySessions, setTodaySessions] = useState([]);
    const [attendanceLoading, setAttendanceLoading] = useState(true);
    const [recentProjects, setRecentProjects] = useState([]);

    useEffect(() => {
        if (user) {
            fetchStats();
            fetchTodaySessions();
        }
    }, [user]);

    const fetchStats = async () => {
        try {
            const [projects, tasks, members] = await Promise.all([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, []),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TASKS, []),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, [])
            ]);

            setStats({
                projects: projects.total,
                tasks: tasks.total,
                activeTasks: tasks.documents.filter(t => t.status !== 'done').length,
                completedProjects: projects.documents.filter(p => p.status === 'completed').length,
                teamMembers: members.total
            });

            setRecentProjects(projects.documents.slice(0, 3));
        } catch (error) {
            console.error("Error fetching stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTodaySessions = async () => {
        setAttendanceLoading(true);
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
            setAttendanceLoading(false);
        }
    };

    // Find active (open) session
    const activeSession = todaySessions.find(s => s.checkInTime && !s.checkOutTime);
    const isCheckedIn = !!activeSession;
    const hasSessions = todaySessions.length > 0;
    const completedSessions = todaySessions.filter(s => s.checkInTime && s.checkOutTime);

    // Total time across all completed sessions today
    const totalTodayMs = completedSessions.reduce((sum, s) => {
        return sum + (new Date(s.checkOutTime) - new Date(s.checkInTime));
    }, 0);

    const handleCheckIn = async () => {
        setAttendanceLoading(true);
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
        } catch (error) {
            console.error("Error checking in:", error);
            alert("Failed to check in: " + (error?.message || error));
        } finally {
            setAttendanceLoading(false);
        }
    };

    const handleCheckOut = async () => {
        if (!activeSession) return;
        setAttendanceLoading(true);
        try {
            const now = new Date();
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.ATTENDANCE,
                activeSession.$id,
                { checkOutTime: now.toISOString() }
            );
            await fetchTodaySessions();
        } catch (error) {
            console.error("Error checking out:", error);
            alert("Failed to check out: " + (error?.message || error));
        } finally {
            setAttendanceLoading(false);
        }
    };

    const formatTime = (isoString) => {
        if (!isoString) return '--:--';
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatMs = (ms) => {
        if (!ms || ms <= 0) return '0h 0m';
        const hrs = Math.floor(ms / 3600000);
        const mins = Math.floor((ms % 3600000) / 60000);
        return `${hrs}h ${mins}m`;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    const statCards = [
        { name: 'Total Projects', value: stats.projects, icon: FolderKanban, color: 'text-indigo-600', bg: 'bg-indigo-100' },
        { name: 'Active Tasks', value: stats.activeTasks, icon: CheckSquare, color: 'text-emerald-600', bg: 'bg-emerald-100' },
        { name: 'Completed Projects', value: stats.completedProjects, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
        { name: 'Team Members', value: stats.teamMembers, icon: Users, color: 'text-purple-600', bg: 'bg-purple-100' },
    ];

    const statusColors = {
        active: 'bg-green-100 text-green-800',
        planning: 'bg-blue-100 text-blue-800',
        completed: 'bg-gray-100 text-gray-800',
        paused: 'bg-yellow-100 text-yellow-800'
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-8">Dashboard</h1>

            {/* Live Attendance Widget — supports multiple sessions */}
            <div className={`p-6 rounded-2xl shadow-sm border mb-8 transition-all duration-300 ${isCheckedIn ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' :
                'bg-gradient-to-r from-indigo-50 to-white border-gray-100'
                }`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div className="mb-4 sm:mb-0 flex-1">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center">
                            <Clock className={`h-5 w-5 mr-2 ${isCheckedIn ? 'text-green-600 animate-pulse' : 'text-indigo-600'}`} />
                            Today's Attendance
                        </h2>
                        {attendanceLoading ? (
                            <p className="text-sm text-gray-500 mt-1">Loading...</p>
                        ) : isCheckedIn ? (
                            <div className="mt-2">
                                <p className="text-sm text-gray-700">
                                    Checked in at <strong className="text-green-700">{formatTime(activeSession.checkInTime)}</strong>
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    You are currently <span className="font-bold text-green-600">Working</span>
                                    {completedSessions.length > 0 && (
                                        <span className="ml-2 text-gray-400">· {completedSessions.length} earlier session{completedSessions.length > 1 ? 's' : ''} ({formatMs(totalTodayMs)})</span>
                                    )}
                                </p>
                            </div>
                        ) : hasSessions ? (
                            <div className="mt-2">
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {completedSessions.map((s, idx) => (
                                        <span key={s.$id} className="inline-flex items-center bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-600">
                                            <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                                            {formatTime(s.checkInTime)} → {formatTime(s.checkOutTime)}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-sm text-gray-600">
                                    <span className="font-medium">{completedSessions.length}</span> session{completedSessions.length > 1 ? 's' : ''} completed
                                    <span className="mx-1">·</span>
                                    Total: <strong className="text-indigo-600">{formatMs(totalTodayMs)}</strong>
                                </p>
                                <p className="text-xs text-green-600 mt-1">You can check in again for a new session.</p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 mt-1">You haven't checked in today. Start your day!</p>
                        )}
                    </div>
                    <div className="flex space-x-3 flex-shrink-0">
                        {attendanceLoading ? (
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        ) : isCheckedIn ? (
                            <button
                                onClick={handleCheckOut}
                                className="flex items-center px-6 py-2.5 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 shadow-md transition-all transform hover:scale-105"
                            >
                                <LogOut className="h-5 w-5 mr-2" />
                                Check Out
                            </button>
                        ) : (
                            <button
                                onClick={handleCheckIn}
                                className="flex items-center px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md transition-all transform hover:scale-105"
                            >
                                <LogIn className="h-5 w-5 mr-2" />
                                Check In
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                {statCards.map((item) => (
                    <div key={item.name} className="relative bg-white pt-6 px-4 pb-6 sm:px-6 shadow-sm rounded-xl overflow-hidden border border-gray-100 transition-all duration-200 hover:shadow-md">
                        <dt>
                            <div className={`absolute rounded-lg p-3 ${item.bg}`}>
                                <item.icon className={`h-6 w-6 ${item.color}`} aria-hidden="true" />
                            </div>
                            <p className="ml-16 text-sm font-medium text-gray-500 truncate">{item.name}</p>
                        </dt>
                        <dd className="ml-16 flex items-baseline">
                            <p className="text-2xl font-bold text-gray-900">{item.value}</p>
                        </dd>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* Recent Projects */}
                <div className="bg-white shadow-sm rounded-xl border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-gray-900">Recent Projects</h2>
                        <Link to="/projects" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors">View all</Link>
                    </div>
                    {recentProjects.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            <FolderKanban className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                            <p>No projects yet. <Link to="/projects" className="text-indigo-600 hover:underline font-medium">Create one</Link>.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {recentProjects.map((project) => (
                                <li key={project.$id} className="py-4">
                                    <div className="flex items-center space-x-4">
                                        <div className="flex-shrink-0">
                                            <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-indigo-100">
                                                <span className="font-medium leading-none text-indigo-700">
                                                    {project.name?.substring(0, 2).toUpperCase()}
                                                </span>
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">{project.name}</p>
                                            <p className="text-sm text-gray-500 truncate">
                                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium capitalize ${statusColors[project.status] || 'bg-gray-100 text-gray-800'}`}>
                                                    {project.status}
                                                </span>
                                                {project.deadline && (
                                                    <span className="ml-2 text-xs text-gray-400">
                                                        Due: {new Date(project.deadline).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div>
                                            <Link to="/projects" className="inline-flex items-center shadow-sm px-2.5 py-0.5 border border-gray-300 text-xs font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50">
                                                View
                                            </Link>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="bg-white shadow-sm rounded-xl border border-gray-100 p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-6">Quick Actions</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Link to="/projects" className="flex items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-indigo-200 transition-all duration-200 cursor-pointer group">
                            <div className="flex-shrink-0 p-3 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                                <FolderKanban className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div className="ml-4">
                                <span className="block font-medium text-gray-900">New Project</span>
                                <span className="block text-xs text-gray-500 mt-1">Start a new initiative</span>
                            </div>
                        </Link>
                        <Link to="/tasks" className="flex items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-emerald-200 transition-all duration-200 cursor-pointer group">
                            <div className="flex-shrink-0 p-3 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                                <CheckSquare className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div className="ml-4">
                                <span className="block font-medium text-gray-900">New Task</span>
                                <span className="block text-xs text-gray-500 mt-1">Add to your todo list</span>
                            </div>
                        </Link>
                        <Link to="/customers" className="flex items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-200 transition-all duration-200 cursor-pointer group">
                            <div className="flex-shrink-0 p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                                <Users className="h-6 w-6 text-blue-600" />
                            </div>
                            <div className="ml-4">
                                <span className="block font-medium text-gray-900">Add Customer</span>
                                <span className="block text-xs text-gray-500 mt-1">Register a new client</span>
                            </div>
                        </Link>
                        <Link to="/team" className="flex items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-purple-200 transition-all duration-200 cursor-pointer group">
                            <div className="flex-shrink-0 p-3 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors">
                                <Users className="h-6 w-6 text-purple-600" />
                            </div>
                            <div className="ml-4">
                                <span className="block font-medium text-gray-900">Invite Member</span>
                                <span className="block text-xs text-gray-500 mt-1">Grow your team</span>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
