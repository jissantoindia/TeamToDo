import { useState, useEffect, useMemo } from 'react';
import { databases, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { Query } from 'appwrite';
import { Clock, Calendar, ClipboardList, Users, BarChart3, Filter, Play, LogIn, Star } from 'lucide-react';

export default function Reports() {
    const [teamMembers, setTeamMembers] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [timeEntries, setTimeEntries] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [activeTab, setActiveTab] = useState('hours'); // 'hours' or 'tasks'

    // Task report filters
    const [filterMember, setFilterMember] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => { fetchReportData(); }, [month]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const [membersRes, timeEntriesRes, attendanceRes, tasksRes, statusesRes] = await Promise.all([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TIME_ENTRIES, [Query.limit(500)]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.ATTENDANCE, [Query.limit(500)]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TASKS, [Query.limit(200)]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TASK_STATUSES, [Query.orderAsc('order')])
            ]);

            const members = membersRes.documents;
            setTeamMembers(members);
            setTasks(tasksRes.documents);
            setStatuses(statusesRes.documents);
            setTimeEntries(timeEntriesRes.documents);
            setAttendance(attendanceRes.documents);

            // Build per-member report data
            const data = members.map(member => {
                const memberId = member.userId || member.$id;

                // Attendance: all sessions for this member in selected month
                const memberAttendance = attendanceRes.documents.filter(a =>
                    (a.userId === memberId || a.userId === member.$id) &&
                    a.date?.startsWith(month)
                );

                // Total attendance hours (sum of check-in to check-out durations)
                const attendanceMs = memberAttendance.reduce((sum, a) => {
                    if (a.checkInTime && a.checkOutTime) {
                        return sum + (new Date(a.checkOutTime) - new Date(a.checkInTime));
                    }
                    return sum;
                }, 0);
                const attendanceHours = attendanceMs / 3600000;

                // Unique days present
                const uniqueDays = new Set(memberAttendance.map(a => a.date)).size;

                // In-Progress Task Hours: from time entries where duration > 0
                const memberTimeEntries = timeEntriesRes.documents.filter(e =>
                    (e.userId === memberId || e.userId === member.$id) &&
                    e.startTime?.startsWith(month.substring(0, 4)) // year match at minimum
                );
                // Filter for entries within the selected month
                const monthEntries = memberTimeEntries.filter(e => {
                    const entryDate = e.startTime?.substring(0, 7);
                    return entryDate === month;
                });
                const inProgressHours = monthEntries.reduce((sum, e) => sum + (e.duration || 0), 0);

                // Count tasks
                const memberTasks = tasksRes.documents.filter(t =>
                    t.assigneeId === memberId || t.assigneeId === member.$id
                );

                return {
                    id: member.$id,
                    userId: memberId,
                    name: member.name,
                    email: member.email,
                    attendanceHours: Math.round(attendanceHours * 100) / 100,
                    inProgressHours: Math.round(inProgressHours * 100) / 100,
                    daysPresent: uniqueDays,
                    totalSessions: memberAttendance.length,
                    taskCount: memberTasks.length,
                    timeEntries: monthEntries
                };
            });

            setReportData(data);
        } catch (error) {
            console.error("Error generating report:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filtered tasks for the Task Report
    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            const matchesMember = filterMember === 'all' || task.assigneeId === filterMember;
            const matchesStatus = filterStatus === 'all' || task.statusId === filterStatus;
            return matchesMember && matchesStatus;
        });
    }, [tasks, filterMember, filterStatus]);

    // Task stats by status
    const taskStatsByStatus = useMemo(() => {
        const stats = {};
        statuses.forEach(s => {
            stats[s.$id] = { name: s.name, color: s.color, count: 0, filtered: 0 };
        });
        tasks.forEach(t => { if (stats[t.statusId]) stats[t.statusId].count++; });
        filteredTasks.forEach(t => { if (stats[t.statusId]) stats[t.statusId].filtered++; });
        return stats;
    }, [tasks, filteredTasks, statuses]);

    // Task stats by member
    const taskStatsByMember = useMemo(() => {
        const stats = {};
        teamMembers.forEach(m => {
            stats[m.userId || m.$id] = { name: m.name, total: 0, byStatus: {} };
            statuses.forEach(s => { stats[m.userId || m.$id].byStatus[s.$id] = 0; });
        });
        tasks.forEach(t => {
            const key = t.assigneeId;
            if (stats[key]) {
                stats[key].total++;
                if (stats[key].byStatus[t.statusId] !== undefined) {
                    stats[key].byStatus[t.statusId]++;
                }
            }
        });
        return stats;
    }, [tasks, teamMembers, statuses]);

    // Get time entries for a specific task (include all entries, even very short ones)
    const getTaskTimeEntries = (taskId) => {
        return timeEntries.filter(e => e.taskId === taskId);
    };

    const getTaskTotalHours = (taskId) => {
        const entries = getTaskTimeEntries(taskId);
        return entries.reduce((sum, e) => {
            if (e.duration > 0) {
                // Completed time entry
                return sum + e.duration;
            } else if (e.startTime && e.duration === 0) {
                // Currently in-progress entry — calculate live duration
                const elapsed = (new Date() - new Date(e.startTime)) / 3600000;
                return sum + Math.max(elapsed, 0);
            }
            return sum;
        }, 0);
    };

    // Format estimated time for display
    // Handles decimal estimatedHours (e.g. 0.17 = ~10m) and legacy estimatedMinutes
    const formatEstimated = (task) => {
        const hours = task.estimatedHours || 0;
        const minutes = task.estimatedMinutes || 0;
        // If estimatedMinutes exists, use legacy format; otherwise convert decimal hours to minutes
        const totalMin = minutes > 0 ? (Math.floor(hours) * 60 + minutes) : Math.round(hours * 60);
        if (totalMin <= 0) return null;
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    };

    const totalAttendanceHours = reportData.reduce((sum, d) => sum + d.attendanceHours, 0);
    const totalInProgressHours = reportData.reduce((sum, d) => sum + d.inProgressHours, 0);

    const formatHours = (h) => {
        if (!h || h <= 0) return '0h 0m';
        const totalSeconds = Math.round(h * 3600);
        if (totalSeconds < 60) return `${totalSeconds}s`;
        const hrs = Math.floor(h);
        const mins = Math.round((h - hrs) * 60);
        if (hrs > 0) return `${hrs}h ${mins}m`;
        return `${mins}m`;
    };

    const tabs = [
        { id: 'hours', label: 'Hours & Activity', icon: Clock },
        { id: 'tasks', label: 'Task Reports', icon: ClipboardList }
    ];

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Reports</h1>
                    <p className="mt-1 text-sm text-gray-500">Activity tracking and task status overview.</p>
                </div>
                <div className="flex items-center bg-white p-2 rounded-lg border border-gray-300">
                    <Calendar className="text-gray-500 mr-2 h-5 w-5" />
                    <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                        className="border-none focus:ring-0 text-gray-700 text-sm font-medium" />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-8">
                {tabs.map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}>
                        <tab.icon className="h-4 w-4 mr-2" />{tab.label}
                    </button>
                ))}
            </div>

            {/* ──── HOURS & ACTIVITY TAB ──── */}
            {activeTab === 'hours' && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
                        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 p-6">
                            <dt className="text-sm font-medium text-gray-500 truncate mb-1 flex items-center">
                                <Play className="h-4 w-4 mr-1.5 text-green-500" />
                                Total In-Progress Hours
                            </dt>
                            <dd className="text-3xl font-bold text-gray-900">{formatHours(totalInProgressHours)}</dd>
                            <p className="text-xs text-gray-400 mt-1">Auto-tracked from task status</p>
                        </div>
                        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 p-6">
                            <dt className="text-sm font-medium text-gray-500 truncate mb-1 flex items-center">
                                <LogIn className="h-4 w-4 mr-1.5 text-indigo-500" />
                                Total Check-In Hours
                            </dt>
                            <dd className="text-3xl font-bold text-gray-900">{formatHours(totalAttendanceHours)}</dd>
                            <p className="text-xs text-gray-400 mt-1">From attendance check-in/out</p>
                        </div>
                        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 p-6">
                            <dt className="text-sm font-medium text-gray-500 truncate mb-1 flex items-center">
                                <Users className="h-4 w-4 mr-1.5 text-purple-500" />
                                Team Members
                            </dt>
                            <dd className="text-3xl font-bold text-gray-900">{teamMembers.length}</dd>
                            <p className="text-xs text-gray-400 mt-1">{reportData.filter(d => d.daysPresent > 0).length} active this month</p>
                        </div>
                    </div>

                    {/* Member Breakdown Table */}
                    <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                        <div className="px-6 py-5 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">Member Activity Breakdown</h3>
                            <p className="text-xs text-gray-400 mt-1">Hours are calculated based on In-Progress task time</p>
                        </div>
                        {loading ? (
                            <div className="p-12 text-center text-gray-500">Loading Report Data...</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                <span className="flex items-center gap-1">
                                                    <Play className="h-3 w-3 text-green-500" /> In-Progress Hours
                                                </span>
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                <span className="flex items-center gap-1">
                                                    <LogIn className="h-3 w-3 text-indigo-500" /> Check-In Hours
                                                </span>
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Present</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tasks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {reportData.map((data) => (
                                            <tr key={data.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">
                                                            {data.name?.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900">{data.name}</p>
                                                            {data.email && <p className="text-xs text-gray-400">{data.email}</p>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm font-bold text-green-600">{formatHours(data.inProgressHours)}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm text-indigo-600">{formatHours(data.attendanceHours)}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{data.daysPresent} days</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{data.totalSessions}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{data.taskCount}</td>
                                            </tr>
                                        ))}
                                        {reportData.length === 0 && (
                                            <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500 italic">No data found.</td></tr>
                                        )}
                                        {reportData.length > 0 && (
                                            <tr className="bg-gray-50 font-semibold">
                                                <td className="px-6 py-4 text-sm text-gray-900">Total</td>
                                                <td className="px-6 py-4 text-sm text-green-700">{formatHours(totalInProgressHours)}</td>
                                                <td className="px-6 py-4 text-sm text-indigo-700">{formatHours(totalAttendanceHours)}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">-</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{reportData.reduce((s, d) => s + d.totalSessions, 0)}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{reportData.reduce((s, d) => s + d.taskCount, 0)}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ──── TASK REPORTS TAB ──── */}
            {activeTab === 'tasks' && (
                <>
                    {/* Status Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                        {statuses.map((status) => (
                            <div key={status.$id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }}></div>
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{status.name}</span>
                                </div>
                                <p className="text-3xl font-extrabold text-gray-900">{taskStatsByStatus[status.$id]?.count || 0}</p>
                                <p className="text-xs text-gray-400 mt-1">tasks</p>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex items-end flex-wrap gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                <Users className="inline h-3 w-3 mr-1" /> Filter by Member
                            </label>
                            <select value={filterMember} onChange={(e) => setFilterMember(e.target.value)}
                                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="all">All Members</option>
                                {teamMembers.map(m => (<option key={m.$id} value={m.userId || m.$id}>{m.name}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                <Filter className="inline h-3 w-3 mr-1" /> Filter by Status
                            </label>
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="all">All Statuses</option>
                                {statuses.map(s => (<option key={s.$id} value={s.$id}>{s.name}</option>))}
                            </select>
                        </div>
                        <div className="text-sm text-gray-500 pb-1">
                            Showing <strong className="text-gray-900">{filteredTasks.length}</strong> of {tasks.length} tasks
                        </div>
                    </div>

                    {/* Member × Status Matrix */}
                    <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden mb-8">
                        <div className="px-6 py-5 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                <BarChart3 className="h-5 w-5 mr-2 text-indigo-500" />
                                Tasks by Member & Status
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                                        {statuses.map(s => (
                                            <th key={s.$id} className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: s.color }}>
                                                <div className="flex items-center justify-center gap-1">
                                                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }}></div>
                                                    {s.name}
                                                </div>
                                            </th>
                                        ))}
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-green-600 uppercase tracking-wider">
                                            <span className="flex items-center justify-center gap-1"><Play className="h-3 w-3" /> Hours</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {teamMembers.map((m) => {
                                        const key = m.userId || m.$id;
                                        const memberStats = taskStatsByMember[key];
                                        const memberReport = reportData.find(r => r.userId === key);
                                        if (!memberStats) return null;
                                        return (
                                            <tr key={m.$id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">{m.name?.substring(0, 2).toUpperCase()}</div>
                                                        <span className="text-sm font-medium text-gray-900">{m.name}</span>
                                                    </div>
                                                </td>
                                                {statuses.map(s => (
                                                    <td key={s.$id} className="px-4 py-4 text-center">
                                                        <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-bold ${memberStats.byStatus[s.$id] > 0 ? 'text-white' : 'text-gray-300 bg-gray-50'
                                                            }`} style={memberStats.byStatus[s.$id] > 0 ? { backgroundColor: s.color } : {}}>
                                                            {memberStats.byStatus[s.$id]}
                                                        </span>
                                                    </td>
                                                ))}
                                                <td className="px-4 py-4 text-center"><span className="text-sm font-bold text-gray-900">{memberStats.total}</span></td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="text-sm font-bold text-green-600">{formatHours(memberReport?.inProgressHours || 0)}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {teamMembers.length === 0 && (
                                        <tr><td colSpan={statuses.length + 3} className="px-6 py-12 text-center text-gray-500 italic">No data available.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Filtered Task List (with time tracked, estimated vs actual, quality) */}
                    <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                        <div className="px-6 py-5 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">
                                Filtered Tasks
                                <span className="ml-2 text-sm font-normal text-gray-400">({filteredTasks.length} tasks)</span>
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignee</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Estimated</span>
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">
                                            <span className="flex items-center gap-1"><Play className="h-3 w-3" /> Actual</span>
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-yellow-600 uppercase tracking-wider">
                                            <span className="flex items-center gap-1"><Star className="h-3 w-3" /> Quality</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredTasks.map(task => {
                                        const taskStatus = statuses.find(s => s.$id === task.statusId);
                                        const totalHrs = getTaskTotalHours(task.$id);
                                        const est = formatEstimated(task);
                                        const estHours = task.estimatedHours || 0;
                                        const estMins = task.estimatedMinutes || 0;
                                        const estTotalMin = estMins > 0 ? (Math.floor(estHours) * 60 + estMins) : Math.round(estHours * 60);
                                        const actualMin = totalHrs * 60;
                                        const isOverEstimate = estTotalMin > 0 && actualMin > estTotalMin;
                                        return (
                                            <tr key={task.$id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <p className="text-sm font-medium text-gray-900">{task.title}</p>
                                                    {task.description && <p className="text-xs text-gray-400 truncate max-w-xs">{task.description}</p>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm text-gray-700">{task.assigneeName || 'Unassigned'}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {taskStatus ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: taskStatus.color }}>{taskStatus.name}</span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">{task.status || 'Unknown'}</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${task.priority === 'high' ? 'bg-red-100 text-red-700' :
                                                        task.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-emerald-100 text-emerald-700'
                                                        }`}>{task.priority}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {est ? (
                                                        <span className="text-sm font-medium text-blue-600">{est}</span>
                                                    ) : (
                                                        <span className="text-xs text-gray-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {totalHrs > 0 ? (
                                                        <div>
                                                            <span className={`text-sm font-bold ${isOverEstimate ? 'text-red-600' : 'text-green-600'}`}>{formatHours(totalHrs)}</span>
                                                            {est && (
                                                                <p className={`text-[10px] mt-0.5 ${isOverEstimate ? 'text-red-400' : 'text-green-400'}`}>
                                                                    {isOverEstimate ? '⚠ Over estimate' : '✓ Within estimate'}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-0.5">
                                                        {[1, 2, 3, 4, 5].map(s => (
                                                            <Star key={s} className={`h-3.5 w-3.5 ${s <= (task.qualityRating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                                                        ))}
                                                    </div>
                                                    {task.qualityRating > 0 && <span className="text-[10px] text-gray-400">{task.qualityRating}/5</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredTasks.length === 0 && (
                                        <tr><td colSpan="7" className="px-6 py-12 text-center text-gray-500 italic">No tasks match the current filters.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
