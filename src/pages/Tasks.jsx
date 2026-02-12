import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { databases, client, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { ID, Query } from 'appwrite';
import { useAuth } from '../context/AuthContext';
import {
    Plus, Search, Filter, Calendar, Clock, X, Trash2, ChevronDown, Play, Star, ArrowLeft, FolderKanban
} from 'lucide-react';

export default function Tasks() {
    const { user, hasPermission } = useAuth();
    const { projectId: urlProjectId } = useParams(); // from /projects/:projectId route
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [members, setMembers] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [timeEntries, setTimeEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [viewMode, setViewMode] = useState('board');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterAssignee, setFilterAssignee] = useState(user?.$id || 'all');

    // Track if we've set the default filter
    const defaultFilterSet = useRef(!!user?.$id);

    // Auto-select "Me" filter when user loads
    useEffect(() => {
        if (user?.$id && !defaultFilterSet.current) {
            setFilterAssignee(user.$id);
            defaultFilterSet.current = true;
        }
    }, [user]);
    const [filterPriority, setFilterPriority] = useState('all');
    const [filterProject, setFilterProject] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '', description: '', priority: 'medium',
        estimatedHours: 0, estimatedMinutes: 0, dueDate: '', projectId: '',
        assigneeId: '', assigneeName: ''
    });

    // Drag & Drop state
    const [draggedTaskId, setDraggedTaskId] = useState(null);
    const [dragOverColumn, setDragOverColumn] = useState(null);

    // Assignee picker & rating state
    const [assigneePickerTaskId, setAssigneePickerTaskId] = useState(null);
    const [ratingTaskId, setRatingTaskId] = useState(null);
    const assigneePickerRef = useRef(null);
    const ratingRef = useRef(null);

    // Track the "In Progress" status ID
    const inProgressStatusId = useMemo(() => {
        const s = statuses.find(s => s.name?.toLowerCase() === 'in progress');
        return s?.$id || null;
    }, [statuses]);

    // Find "Completed"/"Approved" status IDs for quality rating
    const completedStatusIds = useMemo(() => {
        return statuses
            .filter(s => ['completed', 'approved', 'done'].includes(s.name?.toLowerCase()))
            .map(s => s.$id);
    }, [statuses]);

    // Check if current user is the assignee of a task
    const isMyTask = useCallback((task) => {
        return task.assigneeId === user?.$id;
    }, [user]);

    // Check if current user is admin/manager (can assign, create, rate)
    const isManager = useMemo(() => {
        return hasPermission('manage_tasks');
    }, [hasPermission]);

    // Close pickers on outside clicks
    useEffect(() => {
        const handleClick = (e) => {
            if (assigneePickerRef.current && !assigneePickerRef.current.contains(e.target)) {
                setAssigneePickerTaskId(null);
            }
            if (ratingRef.current && !ratingRef.current.contains(e.target)) {
                setRatingTaskId(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    useEffect(() => { fetchData(); }, []);

    // ─── APPWRITE REALTIME SUBSCRIPTION ───
    useEffect(() => {
        const channel = `databases.${DATABASE_ID}.collections.${COLLECTIONS.TASKS}.documents`;
        const unsubscribe = client.subscribe(channel, (response) => {
            const event = response.events[0];
            const doc = response.payload;

            if (event.includes('.create')) {
                setTasks(prev => {
                    if (prev.find(t => t.$id === doc.$id)) return prev;
                    return [...prev, doc];
                });
            } else if (event.includes('.update')) {
                setTasks(prev => prev.map(t => t.$id === doc.$id ? doc : t));
            } else if (event.includes('.delete')) {
                setTasks(prev => prev.filter(t => t.$id !== doc.$id));
            }
        });
        return () => unsubscribe();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [tasksRes, projectsRes, membersRes, statusesRes, timeEntriesRes] = await Promise.all([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TASKS, [Query.orderAsc('$createdAt'), Query.limit(200)]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TASK_STATUSES, [Query.orderAsc('order')]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TIME_ENTRIES, [Query.limit(500)])
            ]);
            setTasks(tasksRes.documents);
            setProjects(projectsRes.documents);
            setMembers(membersRes.documents);
            setStatuses(statusesRes.documents);
            setTimeEntries(timeEntriesRes.documents);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Determine the effective project filter (URL param takes priority)
    const activeProjectId = urlProjectId || (filterProject !== 'all' ? filterProject : null);
    const activeProject = activeProjectId ? projects.find(p => p.$id === activeProjectId) : null;

    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            // Filter out tasks with invalid/deleted statuses (orphans)
            // This ensures List view matches Board view (which only shows valid columns)
            if (statuses.length > 0) {
                const isValidStatus = statuses.some(s => s.$id === task.statusId);
                if (!isValidStatus) return false;
            }

            // Role-based visibility: non-managers see only their own tasks
            if (!isManager) {
                const isOwn = task.assigneeId === user?.$id;
                if (!isOwn) return false;
            }

            // Project filter (URL-based or dropdown)
            if (activeProjectId && task.projectId !== activeProjectId) return false;

            const matchesSearch = !searchQuery ||
                task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                task.description?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesAssignee = filterAssignee === 'all' || task.assigneeId === filterAssignee;
            const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
            return matchesSearch && matchesAssignee && matchesPriority;
        });
    }, [tasks, statuses, searchQuery, filterAssignee, filterPriority, isManager, user, activeProjectId]);

    const tasksByStatus = useMemo(() => {
        const grouped = {};
        statuses.forEach(s => { grouped[s.$id] = []; });
        grouped['unassigned'] = [];
        filteredTasks.forEach(task => {
            if (task.statusId && grouped[task.statusId]) {
                grouped[task.statusId].push(task);
            } else {
                grouped['unassigned'].push(task);
            }
        });
        return grouped;
    }, [filteredTasks, statuses]);

    // Convert estimated time for display
    // Supports both legacy format (estimatedHours + estimatedMinutes as separate integers) 
    // and new format (estimatedHours as decimal, e.g. 2.5 = 2h 30m)
    const formatEstimated = (task) => {
        const hours = task.estimatedHours || 0;
        const minutes = task.estimatedMinutes || 0;
        // If estimatedMinutes exists, use legacy format
        const totalMin = minutes > 0 ? (Math.floor(hours) * 60 + minutes) : Math.round(hours * 60);
        if (totalMin <= 0) return null;
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    };

    // Get accumulated actual time for a task (sum of all completed In Progress periods)
    const getActualTime = useCallback((taskId) => {
        const entries = timeEntries.filter(e => e.taskId === taskId && e.duration > 0);
        const totalHours = entries.reduce((sum, e) => sum + (e.duration || 0), 0);
        return { totalHours, sessionCount: entries.length };
    }, [timeEntries]);

    // Format hours to readable string
    const formatHours = (h) => {
        if (!h || h <= 0) return null;
        const totalSeconds = Math.round(h * 3600);
        if (totalSeconds < 60) return `${totalSeconds}s`;
        const hrs = Math.floor(h);
        const mins = Math.round((h - hrs) * 60);
        if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
        if (hrs > 0) return `${hrs}h`;
        return `${mins}m`;
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        try {
            const firstStatus = statuses[0];
            // Combine hours + minutes into a decimal estimatedHours value
            const totalEstHours = (parseInt(newTask.estimatedHours) || 0) + (parseInt(newTask.estimatedMinutes) || 0) / 60;
            const payload = {
                title: newTask.title,
                description: newTask.description || '',
                priority: newTask.priority,
                estimatedHours: Math.round(totalEstHours * 100) / 100,
                dueDate: newTask.dueDate ? new Date(newTask.dueDate).toISOString() : null,
                projectId: newTask.projectId || '',
                statusId: firstStatus?.$id || '',
                status: firstStatus?.name?.toLowerCase() || 'new',
                creatorId: user?.$id || '',
                creatorName: user?.name || '',
                assigneeId: newTask.assigneeId || user?.$id || '',
                assigneeName: newTask.assigneeName || user?.name || '',
            };
            await databases.createDocument(DATABASE_ID, COLLECTIONS.TASKS, ID.unique(), payload);
            setShowModal(false);
            setNewTask({ title: '', description: '', priority: 'medium', estimatedHours: 0, estimatedMinutes: 0, dueDate: '', projectId: '', assigneeId: '', assigneeName: '' });
        } catch (error) {
            console.error("Error creating task:", error);
            alert("Failed to create task: " + (error?.message || error));
        }
    };

    // ─── AUTO TIME TRACKING ───
    const autoTrackTime = async (taskId, oldStatusId, newStatusId, task) => {
        const wasInProgress = oldStatusId === inProgressStatusId;
        const nowInProgress = newStatusId === inProgressStatusId;
        if (!inProgressStatusId) return;

        if (!wasInProgress && nowInProgress) {
            try {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.TIME_ENTRIES, ID.unique(), {
                    taskId, userId: task.assigneeId || user?.$id || '',
                    startTime: new Date().toISOString(), duration: 0
                });
            } catch (err) { console.error("Error starting time tracking:", err); }
        } else if (wasInProgress && !nowInProgress) {
            try {
                const openEntries = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TIME_ENTRIES, [
                    Query.equal('taskId', taskId), Query.equal('duration', 0),
                    Query.orderDesc('$createdAt'), Query.limit(1)
                ]);
                if (openEntries.documents.length > 0) {
                    const entry = openEntries.documents[0];
                    const durationHours = (new Date() - new Date(entry.startTime)) / 3600000;
                    await databases.updateDocument(DATABASE_ID, COLLECTIONS.TIME_ENTRIES, entry.$id, {
                        duration: Math.round(durationHours * 1000000) / 1000000  // 6 decimal places for precision
                    });
                }
            } catch (err) { console.error("Error stopping time tracking:", err); }
        }
    };

    const handleMoveTask = useCallback(async (taskId, newStatusId) => {
        const task = tasks.find(t => t.$id === taskId);
        if (!task) return;
        const oldStatusId = task.statusId || '';
        if (oldStatusId === newStatusId) return;

        // ── PERMISSION CHECK: only assignee can change their task status ──
        if (task.assigneeId !== user?.$id) {
            alert("Only the assignee can change the status of their task.");
            return;
        }

        const newStatus = statuses.find(s => s.$id === newStatusId);
        setTasks(prev => prev.map(t =>
            t.$id === taskId ? { ...t, statusId: newStatusId, status: newStatus?.name?.toLowerCase() || '' } : t
        ));

        databases.updateDocument(DATABASE_ID, COLLECTIONS.TASKS, taskId, {
            statusId: newStatusId, status: newStatus?.name?.toLowerCase() || ''
        }).catch(err => {
            console.error("Error moving task:", err);
            setTasks(prev => prev.map(t =>
                t.$id === taskId ? { ...t, statusId: oldStatusId, status: task?.status || '' } : t
            ));
        });

        autoTrackTime(taskId, oldStatusId, newStatusId, task);
    }, [tasks, statuses, inProgressStatusId, user]);

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm("Delete this task?")) return;
        try {
            setTasks(prev => prev.filter(t => t.$id !== taskId));
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.TASKS, taskId);
        } catch (error) { console.error("Error deleting task:", error); fetchData(); }
    };

    const handleReassign = useCallback(async (taskId, memberId) => {
        const member = members.find(m => m.$id === memberId || m.userId === memberId);
        const updates = { assigneeId: member?.userId || memberId, assigneeName: member?.name || '' };
        setTasks(prev => prev.map(t => t.$id === taskId ? { ...t, ...updates } : t));
        setAssigneePickerTaskId(null);
        databases.updateDocument(DATABASE_ID, COLLECTIONS.TASKS, taskId, updates)
            .catch(err => { console.error("Error reassigning:", err); fetchData(); });
    }, [members]);

    // ─── QUALITY RATING ───
    const handleRateTask = useCallback(async (taskId, rating) => {
        setTasks(prev => prev.map(t => t.$id === taskId ? { ...t, qualityRating: rating } : t));
        setRatingTaskId(null);
        databases.updateDocument(DATABASE_ID, COLLECTIONS.TASKS, taskId, { qualityRating: rating })
            .catch(err => { console.error("Error rating task:", err); fetchData(); });
    }, []);

    // ─── DRAG & DROP ───
    const handleDragStart = useCallback((e, taskId) => {
        const task = tasks.find(t => t.$id === taskId);
        // Only task owner can drag (even managers can't drag others' tasks)
        if (task && task.assigneeId !== user?.$id) {
            e.preventDefault();
            return;
        }
        setDraggedTaskId(taskId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', taskId);
        requestAnimationFrame(() => {
            const el = document.getElementById(`task-card-${taskId}`);
            if (el) el.style.opacity = '0.4';
        });
    }, [tasks, user]);

    const handleDragEnd = useCallback(() => {
        if (draggedTaskId) {
            const el = document.getElementById(`task-card-${draggedTaskId}`);
            if (el) el.style.opacity = '1';
        }
        setDraggedTaskId(null);
        setDragOverColumn(null);
    }, [draggedTaskId]);

    const handleDragOver = useCallback((e, statusId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverColumn(statusId);
    }, []);

    const handleDragLeave = useCallback((e, statusId) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const { clientX, clientY } = e;
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
            if (dragOverColumn === statusId) setDragOverColumn(null);
        }
    }, [dragOverColumn]);

    const handleDrop = useCallback((e, statusId) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId && statusId) handleMoveTask(taskId, statusId);
        setDragOverColumn(null);
        setDraggedTaskId(null);
    }, [handleMoveTask]);

    const priorityConfig = {
        high: { color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
        medium: { color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
        low: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
    };

    const getAssigneeName = (task) => {
        if (task.assigneeName) return task.assigneeName;
        const member = members.find(m => m.userId === task.assigneeId || m.$id === task.assigneeId);
        return member?.name || 'Unassigned';
    };
    const getAssigneeInitials = (task) => {
        const name = getAssigneeName(task);
        return name === 'Unassigned' ? '?' : name.substring(0, 2).toUpperCase();
    };

    const taskStats = useMemo(() => {
        const stats = {};
        statuses.forEach(s => { stats[s.$id] = tasks.filter(t => t.statusId === s.$id).length; });
        stats.total = tasks.length;
        return stats;
    }, [tasks, statuses]);

    const isTaskInProgress = (task) => task.statusId === inProgressStatusId;
    const isTaskCompleted = (task) => completedStatusIds.includes(task.statusId);
    const canDragTask = (task) => task.assigneeId === user?.$id;

    // ─── TASK CARD ───
    const TaskCard = ({ task }) => {
        const isPickerOpen = assigneePickerTaskId === task.$id;
        const isRatingOpen = ratingTaskId === task.$id;
        const inProgress = isTaskInProgress(task);
        const completed = isTaskCompleted(task);
        const draggable = canDragTask(task);
        const est = formatEstimated(task);

        return (
            <div id={`task-card-${task.$id}`}
                className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 p-4 mb-3 group
                    ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
                    ${draggedTaskId === task.$id ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-100'}
                    ${inProgress ? 'ring-2 ring-green-200 border-green-300' : ''}
                    ${!draggable ? 'opacity-90' : ''}`}
                draggable={draggable ? "true" : "false"}
                onDragStart={(e) => handleDragStart(e, task.$id)}
                onDragEnd={handleDragEnd}
            >
                <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 mr-2">
                        <h4 className="text-sm font-semibold text-gray-900 leading-tight">{task.title}</h4>
                        {inProgress && (
                            <span className="flex items-center gap-1 bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md animate-pulse">
                                <Play className="h-2.5 w-2.5 fill-current" /> TRACKING
                            </span>
                        )}
                        {!draggable && (
                            <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-medium">NOT YOURS</span>
                        )}
                    </div>
                    {isManager && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.$id); }}
                            className="p-1 text-gray-300 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {task.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{task.description}</p>}

                <div className="flex items-center flex-wrap gap-2 mb-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${priorityConfig[task.priority]?.color || 'bg-gray-100 text-gray-700'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${priorityConfig[task.priority]?.dot || 'bg-gray-400'}`}></span>
                        {task.priority}
                    </span>
                    {est && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Est: {est}
                        </span>
                    )}
                    {(() => {
                        const { totalHours, sessionCount } = getActualTime(task.$id);
                        const actual = formatHours(totalHours);
                        if (!actual) return null;
                        const est2 = (task.estimatedHours || 0) + (task.estimatedMinutes || 0) / 60;
                        const isOver = est2 > 0 && totalHours > est2;
                        return (
                            <span className={`text-xs px-2 py-0.5 rounded-md border flex items-center gap-1 ${isOver ? 'text-red-600 bg-red-50 border-red-100' : 'text-green-600 bg-green-50 border-green-100'
                                }`}>
                                <Play className="h-3 w-3" /> {actual}
                                {sessionCount > 1 && <span className="text-[9px] opacity-70">({sessionCount}x)</span>}
                            </span>
                        );
                    })()}
                    {task.projectId && (
                        <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            {projects.find(p => p.$id === task.projectId)?.name || 'Project'}
                        </span>
                    )}
                </div>

                {/* Quality Rating (for completed tasks) */}
                {completed && (
                    <div className="mb-3 relative" ref={isRatingOpen ? ratingRef : null}>
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400 font-medium mr-1">Quality:</span>
                            {[1, 2, 3, 4, 5].map(star => (
                                <button key={star} onClick={(e) => { e.stopPropagation(); setRatingTaskId(isRatingOpen ? null : task.$id); }}
                                    className="focus:outline-none">
                                    <Star className={`h-3.5 w-3.5 transition-colors ${star <= (task.qualityRating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                                </button>
                            ))}
                            {task.qualityRating > 0 && <span className="text-[10px] text-gray-400 ml-1">{task.qualityRating}/5</span>}
                        </div>
                        {isRatingOpen && (
                            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-30 p-2 flex gap-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button key={star} onClick={(e) => { e.stopPropagation(); handleRateTask(task.$id, star); }}
                                        className="p-1 hover:bg-yellow-50 rounded transition-colors">
                                        <Star className={`h-5 w-5 ${star <= (task.qualityRating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Footer: Assignee + Date */}
                <div className="flex items-center justify-between relative">
                    <div className="relative" ref={isPickerOpen ? assigneePickerRef : null}>
                        {isManager ? (
                            /* Managers can click to reassign */
                            <button onClick={(e) => { e.stopPropagation(); setAssigneePickerTaskId(isPickerOpen ? null : task.$id); }}
                                className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1 transition-all ${isPickerOpen ? 'bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200' : 'text-gray-600 hover:bg-gray-100'}`}>
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${getAssigneeName(task) === 'Unassigned' ? 'bg-gray-300' : 'bg-gradient-to-br from-indigo-400 to-purple-500'}`}>{getAssigneeInitials(task)}</div>
                                <span className="max-w-[80px] truncate font-medium">{getAssigneeName(task)}</span>
                                <ChevronDown className={`h-3 w-3 transition-transform ${isPickerOpen ? 'rotate-180' : ''}`} />
                            </button>
                        ) : (
                            /* Non-managers just see assignee name (no picker) */
                            <div className="flex items-center gap-1.5 text-xs text-gray-600 px-2 py-1">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${getAssigneeName(task) === 'Unassigned' ? 'bg-gray-300' : 'bg-gradient-to-br from-indigo-400 to-purple-500'}`}>{getAssigneeInitials(task)}</div>
                                <span className="max-w-[80px] truncate font-medium">{getAssigneeName(task)}</span>
                            </div>
                        )}
                        {isPickerOpen && isManager && (
                            <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1">
                                <div className="px-3 py-2 border-b border-gray-100">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Assign to</p>
                                </div>
                                <div className="max-h-48 overflow-y-auto py-1">
                                    {members.map(m => {
                                        const isSelected = task.assigneeId === m.userId || task.assigneeId === m.$id;
                                        return (
                                            <button key={m.$id} onClick={(e) => { e.stopPropagation(); handleReassign(task.$id, m.$id); }}
                                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                                                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${isSelected ? 'bg-indigo-500' : 'bg-gradient-to-br from-gray-400 to-gray-500'}`}>{m.name?.substring(0, 2).toUpperCase()}</div>
                                                <div className="flex-1 min-w-0"><p className="font-medium truncate">{m.name}</p>{m.email && <p className="text-[10px] text-gray-400 truncate">{m.email}</p>}</div>
                                                {isSelected && <svg className="h-4 w-4 text-indigo-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {task.dueDate && (
                            <span className="text-xs text-gray-400 flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-full mx-auto px-4 sm:px-6 md:px-8 py-8">
            {/* Project Header (when viewing a specific project) */}
            {activeProject && (
                <div className="mb-6 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-3">
                        <Link to="/projects" className="text-gray-400 hover:text-indigo-600 transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <FolderKanban className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">{activeProject.name}</h2>
                            <p className="text-xs text-gray-500">{activeProject.description || 'Project tasks'}</p>
                        </div>
                        {activeProject.status && (
                            <span className={`ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${activeProject.status === 'active' ? 'bg-green-100 text-green-800' :
                                activeProject.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                                    activeProject.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-blue-100 text-blue-800'
                                }`}>{activeProject.status}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                        {isManager ? 'Tasks' : 'My Tasks'}
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        {filteredTasks.length}{isManager ? ` of ${tasks.length}` : ''} task{filteredTasks.length !== 1 ? 's' : ''}
                        {' · '}{statuses.map(s => {
                            const count = filteredTasks.filter(t => t.statusId === s.$id).length;
                            return `${count} ${s.name}`;
                        }).join(' · ')}
                    </p>
                    <div className="mt-0.5 flex items-center gap-3">
                        <span className="text-xs text-green-600 flex items-center gap-1"><Play className="h-3 w-3 fill-current" /> Auto-tracks in "In Progress"</span>
                        <span className="text-xs text-blue-500 flex items-center gap-1">⚡ Live sync across users</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-gray-100 rounded-lg p-1 flex">
                        <button onClick={() => setViewMode('board')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'board' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Board</button>
                        <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>List</button>
                    </div>
                    {isManager && (
                        <button onClick={() => setShowModal(true)} className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-all">
                            <Plus className="-ml-1 mr-2 h-5 w-5" />New Task
                        </button>
                    )}
                </div>
            </div>

            {/* Search & Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
                <div className="flex items-center gap-3">
                    <div className="relative flex-grow">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-gray-400" /></div>
                        <input type="text" className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 py-2 sm:text-sm border border-gray-200 rounded-lg"
                            placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    {/* Assignee quick-filter for managers */}
                    {isManager && (
                        <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[160px]">
                            <option value="all">All Members</option>
                            {members.map(m => (<option key={m.$id} value={m.userId || m.$id}>{m.name}</option>))}
                        </select>
                    )}
                    <button onClick={() => setShowFilters(!showFilters)}
                        className={`inline-flex items-center px-4 py-2 border shadow-sm text-sm font-medium rounded-lg transition-colors ${showFilters ? 'border-indigo-300 text-indigo-700 bg-indigo-50' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'}`}>
                        <Filter className="h-4 w-4 mr-2" />Filters
                    </button>
                </div>
                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4">
                        {/* Project filter (only when not in a specific project view) */}
                        {!urlProjectId && (
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Project</label>
                                <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
                                    <option value="all">All Projects</option>
                                    {projects.map(p => (<option key={p.$id} value={p.$id}>{p.name}</option>))}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
                                <option value="all">All</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                            </select>
                        </div>
                        {(filterAssignee !== 'all' || filterPriority !== 'all' || filterProject !== 'all') && (
                            <button onClick={() => { setFilterAssignee('all'); setFilterPriority('all'); setFilterProject('all'); }} className="self-end text-xs text-red-500 hover:text-red-700 flex items-center mb-1"><X className="h-3 w-3 mr-1" />Clear All</button>
                        )}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>
            ) : viewMode === 'board' ? (
                <div className="flex gap-5 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
                    {statuses.map((status) => {
                        const isDragOver = dragOverColumn === status.$id && draggedTaskId;
                        const columnTasks = tasksByStatus[status.$id] || [];
                        const isInProgressCol = status.$id === inProgressStatusId;
                        return (
                            <div key={status.$id} className="flex-shrink-0 w-80">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }}></div>
                                        <h3 className="font-bold text-sm text-gray-800">{status.name}</h3>
                                        <span className="bg-gray-100 text-gray-600 text-xs font-medium rounded-full px-2 py-0.5">{columnTasks.length}</span>
                                        {isInProgressCol && <span className="flex items-center gap-1 text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md font-medium"><Clock className="h-3 w-3" /> Auto-tracked</span>}
                                    </div>
                                </div>
                                <div className={`rounded-xl p-3 min-h-[200px] border-2 border-dashed transition-all duration-200 ${isDragOver ? 'border-indigo-400 bg-indigo-50/60 shadow-inner' : 'border-transparent bg-gray-50/70'}`}
                                    onDragOver={(e) => handleDragOver(e, status.$id)}
                                    onDragLeave={(e) => handleDragLeave(e, status.$id)}
                                    onDrop={(e) => handleDrop(e, status.$id)}>
                                    {isDragOver && columnTasks.length === 0 && (
                                        <div className="flex items-center justify-center h-20 rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50 mb-3">
                                            <p className="text-xs font-medium text-indigo-500">{isInProgressCol ? '⏱ Drop to start tracking' : 'Drop here'}</p>
                                        </div>
                                    )}
                                    {columnTasks.length === 0 && !isDragOver ? (
                                        <div className="flex items-center justify-center h-32 text-xs text-gray-400 italic">No tasks</div>
                                    ) : columnTasks.map(task => (<TaskCard key={task.$id} task={task} />))}
                                    {isDragOver && columnTasks.length > 0 && (
                                        <div className="flex items-center justify-center h-12 rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50 mt-1">
                                            <p className="text-xs font-medium text-indigo-500">{isInProgressCol ? '⏱ Drop to start tracking' : 'Drop here'}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* LIST VIEW */
                <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignee</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Est. Time</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual Time</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quality</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredTasks.map((task) => {
                                    const taskStatus = statuses.find(s => s.$id === task.statusId);
                                    const inProg = isTaskInProgress(task);
                                    const canChange = task.assigneeId === user?.$id;
                                    const est = formatEstimated(task);
                                    return (
                                        <tr key={task.$id} className={`hover:bg-gray-50 transition-colors ${inProg ? 'bg-green-50/30' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium text-gray-900">{task.title}</p>
                                                    {inProg && <span className="flex items-center gap-1 bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md animate-pulse"><Play className="h-2.5 w-2.5 fill-current" /> TRACKING</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {canChange ? (
                                                    <select value={task.statusId || ''} onChange={(e) => handleMoveTask(task.$id, e.target.value)}
                                                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white" style={{ color: taskStatus?.color || '#6b7280' }}>
                                                        {statuses.map(s => (<option key={s.$id} value={s.$id}>{s.name}</option>))}
                                                    </select>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: taskStatus?.color || '#6b7280' }}>{taskStatus?.name || task.status}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isManager ? (
                                                    <select value={task.assigneeId || ''} onChange={(e) => handleReassign(task.$id, e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white">
                                                        <option value="">Unassigned</option>
                                                        {members.map(m => (<option key={m.$id} value={m.userId || m.$id}>{m.name}</option>))}
                                                    </select>
                                                ) : (
                                                    <span className="text-xs text-gray-600">{getAssigneeName(task)}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4"><span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${priorityConfig[task.priority]?.color || 'bg-gray-100'}`}>{task.priority}</span></td>
                                            <td className="px-6 py-4 text-xs text-gray-500">{est || '-'}</td>
                                            <td className="px-6 py-4">
                                                {(() => {
                                                    const { totalHours, sessionCount } = getActualTime(task.$id);
                                                    const actual = formatHours(totalHours);
                                                    if (!actual) return <span className="text-xs text-gray-400">-</span>;
                                                    const estTotal = (task.estimatedHours || 0) + (task.estimatedMinutes || 0) / 60;
                                                    const isOver = estTotal > 0 && totalHours > estTotal;
                                                    return (
                                                        <span className={`text-xs font-medium ${isOver ? 'text-red-600' : 'text-green-600'}`}>
                                                            {actual}
                                                            {sessionCount > 1 && <span className="text-[9px] text-gray-400 ml-1">({sessionCount} sessions)</span>}
                                                            {isOver && <span className="ml-1">⚠️</span>}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-0.5">
                                                    {[1, 2, 3, 4, 5].map(s => (
                                                        <button key={s} onClick={() => handleRateTask(task.$id, s)} className="focus:outline-none">
                                                            <Star className={`h-3.5 w-3.5 ${s <= (task.qualityRating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 hover:text-yellow-300'}`} />
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {isManager ? (
                                                    <button onClick={() => handleDeleteTask(task.$id)} className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                                                ) : (
                                                    <span className="text-xs text-gray-300">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredTasks.length === 0 && <tr><td colSpan="8" className="px-6 py-16 text-center text-gray-500 text-sm">No tasks found.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create Task Modal */}
            {showModal && (
                <div className="fixed z-50 inset-0 overflow-y-auto" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-black/60 transition-opacity" onClick={() => setShowModal(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="relative z-10 inline-block align-bottom bg-white rounded-2xl px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                            <div className="absolute top-0 right-0 pt-4 pr-4">
                                <button type="button" onClick={() => setShowModal(false)} className="bg-white rounded-md text-gray-400 hover:text-gray-500"><X className="h-6 w-6" /></button>
                            </div>
                            <div className="flex items-center mb-5">
                                <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center mr-3"><Plus className="h-5 w-5 text-indigo-600" /></div>
                                <div>
                                    <h3 className="text-lg leading-6 font-bold text-gray-900">Create New Task</h3>
                                    <p className="text-sm text-gray-500">Starts as "{statuses[0]?.name || 'New'}" — time tracks automatically</p>
                                </div>
                            </div>
                            <form onSubmit={handleCreateTask} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Title *</label>
                                    <input type="text" required className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 sm:text-sm"
                                        value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="What needs to be done?" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Description</label>
                                    <textarea rows={3} className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 sm:text-sm"
                                        value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Add details..." />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Project</label>
                                        <select className="mt-1 block w-full bg-white border border-gray-300 rounded-lg shadow-sm py-2 px-3 sm:text-sm"
                                            value={newTask.projectId} onChange={(e) => setNewTask({ ...newTask, projectId: e.target.value })}>
                                            <option value="">No Project</option>
                                            {projects.map(p => (<option key={p.$id} value={p.$id}>{p.name}</option>))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Priority</label>
                                        <select className="mt-1 block w-full bg-white border border-gray-300 rounded-lg shadow-sm py-2 px-3 sm:text-sm"
                                            value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}>
                                            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Assignee Picker */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                                    <div className="space-y-1">
                                        <label className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${!newTask.assigneeId ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200' : 'border-gray-200 hover:border-gray-300'}`}>
                                            <input type="radio" name="assignee" value="" checked={!newTask.assigneeId}
                                                onChange={() => setNewTask({ ...newTask, assigneeId: '', assigneeName: '' })} className="sr-only" />
                                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">{user?.name?.substring(0, 2).toUpperCase() || 'ME'}</div>
                                            <div className="flex-1"><p className="text-sm font-medium text-gray-900">Myself</p><p className="text-xs text-gray-400">Auto-assign to you</p></div>
                                        </label>
                                        <div className="max-h-40 overflow-y-auto space-y-1">
                                            {members.map(m => {
                                                const mId = m.userId || m.$id;
                                                const isSelected = newTask.assigneeId === mId;
                                                return (
                                                    <label key={m.$id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${isSelected ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200' : 'border-gray-200 hover:border-gray-300'}`}>
                                                        <input type="radio" name="assignee" value={mId} checked={isSelected}
                                                            onChange={() => setNewTask({ ...newTask, assigneeId: mId, assigneeName: m.name })} className="sr-only" />
                                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${isSelected ? 'bg-indigo-500' : 'bg-gradient-to-br from-gray-400 to-gray-500'}`}>{m.name?.substring(0, 2).toUpperCase()}</div>
                                                        <div className="flex-1"><p className="text-sm font-medium text-gray-900">{m.name}</p>{m.email && <p className="text-xs text-gray-400">{m.email}</p>}</div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Due Date</label>
                                        <input type="date" className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 sm:text-sm"
                                            value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Estimated Time</label>
                                        <div className="mt-1 flex gap-2">
                                            <div className="flex-1">
                                                <input type="number" min="0" className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 sm:text-sm"
                                                    value={newTask.estimatedHours} onChange={(e) => setNewTask({ ...newTask, estimatedHours: e.target.value })} placeholder="0" />
                                                <span className="text-[10px] text-gray-400 mt-0.5 block">hours</span>
                                            </div>
                                            <div className="flex-1">
                                                <input type="number" min="0" max="59" className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 sm:text-sm"
                                                    value={newTask.estimatedMinutes} onChange={(e) => setNewTask({ ...newTask, estimatedMinutes: e.target.value })} placeholder="0" />
                                                <span className="text-[10px] text-gray-400 mt-0.5 block">minutes</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 sm:mt-6 flex gap-3 justify-end">
                                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm">Create Task</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
