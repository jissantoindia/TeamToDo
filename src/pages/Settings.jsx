import { useState, useEffect } from 'react';
import { databases, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { ID, Query } from 'appwrite';
import { Plus, Trash2, Key, Tag, GripVertical, Palette, Layers } from 'lucide-react';

const DEFAULT_COLORS = [
    '#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#22c55e',
    '#ef4444', '#ec4899', '#06b6d4', '#f97316', '#6366f1'
];

export default function Settings() {
    const [roles, setRoles] = useState([]);
    const [taskStatuses, setTaskStatuses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('roles');

    // Tech Stack state
    const [techStacks, setTechStacks] = useState([]);
    const [newStackName, setNewStackName] = useState('');
    const [newStackDescription, setNewStackDescription] = useState('');

    // Role state
    const [newRoleName, setNewRoleName] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState([]);
    const [editingRole, setEditingRole] = useState(null);
    const [editName, setEditName] = useState('');
    const [editPermissions, setEditPermissions] = useState([]);

    // Task Status state
    const [newStatusName, setNewStatusName] = useState('');
    const [newStatusColor, setNewStatusColor] = useState('#6366f1');
    const [editingStatus, setEditingStatus] = useState(null);
    const [editStatusName, setEditStatusName] = useState('');
    const [editStatusColor, setEditStatusColor] = useState('');

    const PERMISSIONS = [
        { id: 'manage_projects', label: 'Manage Projects' },
        { id: 'manage_tasks', label: 'Manage Tasks' },
        { id: 'manage_team', label: 'Manage Team' },
        { id: 'manage_leaves', label: 'Manage Leaves' },
        { id: 'approve_leaves', label: 'Approve Leaves' },
        { id: 'view_reports', label: 'View Reports' },
        { id: 'manage_roles', label: 'Manage Roles' },
        { id: 'ai_task_creator', label: 'AI Task Creator' }
    ];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [rolesRes, statusesRes, stacksRes] = await Promise.all([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.ROLES),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TASK_STATUSES, [Query.orderAsc('order')]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TECH_STACKS).catch(() => ({ documents: [] }))
            ]);
            setRoles(rolesRes.documents);
            setTaskStatuses(statusesRes.documents);
            setTechStacks(stacksRes.documents);
        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setLoading(false);
        }
    };

    // ──── ROLE CRUD ────
    const handleAddRole = async (e) => {
        e.preventDefault();
        if (!newRoleName.trim()) return;
        try {
            await databases.createDocument(DATABASE_ID, COLLECTIONS.ROLES, ID.unique(), {
                name: newRoleName,
                permissions: selectedPermissions
            });
            setNewRoleName('');
            setSelectedPermissions([]);
            fetchData();
        } catch (error) {
            console.error("Error creating role:", error);
            alert("Failed to create role.");
        }
    };

    const handleDeleteRole = async (id) => {
        if (!window.confirm("Delete this role?")) return;
        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.ROLES, id);
            setRoles(roles.filter(r => r.$id !== id));
        } catch (error) {
            console.error("Error deleting role:", error);
        }
    };

    const togglePermission = (permId) => {
        setSelectedPermissions(prev =>
            prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
        );
    };

    const startEditRole = (role) => {
        setEditingRole(role.$id);
        setEditName(role.name);
        setEditPermissions(role.permissions || []);
    };

    const cancelEdit = () => {
        setEditingRole(null);
        setEditName('');
        setEditPermissions([]);
    };

    const toggleEditPermission = (permId) => {
        setEditPermissions(prev =>
            prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
        );
    };

    const handleUpdateRole = async (roleId) => {
        if (!editName.trim()) return;
        try {
            await databases.updateDocument(DATABASE_ID, COLLECTIONS.ROLES, roleId, {
                name: editName,
                permissions: editPermissions
            });
            fetchData();
            cancelEdit();
        } catch (error) {
            console.error("Error updating role:", error);
        }
    };

    // ──── TASK STATUS CRUD ────
    const handleAddStatus = async (e) => {
        e.preventDefault();
        if (!newStatusName.trim()) return;
        try {
            const maxOrder = taskStatuses.reduce((max, s) => Math.max(max, s.order || 0), 0);
            await databases.createDocument(DATABASE_ID, COLLECTIONS.TASK_STATUSES, ID.unique(), {
                name: newStatusName,
                color: newStatusColor,
                order: maxOrder + 1
            });
            setNewStatusName('');
            setNewStatusColor('#6366f1');
            fetchData();
        } catch (error) {
            console.error("Error creating status:", error);
            alert("Failed to create status: " + (error?.message || error));
        }
    };

    const handleDeleteStatus = async (id) => {
        if (!window.confirm("Delete this task status? Tasks using it will show as 'No Status'.")) return;
        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.TASK_STATUSES, id);
            setTaskStatuses(taskStatuses.filter(s => s.$id !== id));
        } catch (error) {
            console.error("Error deleting status:", error);
        }
    };

    const startEditStatus = (status) => {
        setEditingStatus(status.$id);
        setEditStatusName(status.name);
        setEditStatusColor(status.color || '#6366f1');
    };

    const cancelEditStatus = () => {
        setEditingStatus(null);
        setEditStatusName('');
        setEditStatusColor('');
    };

    const handleUpdateStatus = async (statusId) => {
        if (!editStatusName.trim()) return;
        try {
            await databases.updateDocument(DATABASE_ID, COLLECTIONS.TASK_STATUSES, statusId, {
                name: editStatusName,
                color: editStatusColor
            });
            fetchData();
            cancelEditStatus();
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const moveStatusOrder = async (statusId, direction) => {
        const idx = taskStatuses.findIndex(s => s.$id === statusId);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= taskStatuses.length) return;

        try {
            const currentOrder = taskStatuses[idx].order;
            const swapOrder = taskStatuses[swapIdx].order;

            await Promise.all([
                databases.updateDocument(DATABASE_ID, COLLECTIONS.TASK_STATUSES, taskStatuses[idx].$id, { order: swapOrder }),
                databases.updateDocument(DATABASE_ID, COLLECTIONS.TASK_STATUSES, taskStatuses[swapIdx].$id, { order: currentOrder })
            ]);
            fetchData();
        } catch (error) {
            console.error("Error reordering:", error);
        }
    };

    // ──── TECH STACK CRUD ────
    const handleAddStack = async (e) => {
        e.preventDefault();
        if (!newStackName.trim()) return;
        try {
            await databases.createDocument(DATABASE_ID, COLLECTIONS.TECH_STACKS, ID.unique(), {
                name: newStackName.trim(),
                description: newStackDescription.trim()
            });
            setNewStackName('');
            setNewStackDescription('');
            fetchData();
        } catch (error) {
            console.error("Error creating tech stack:", error);
            alert("Failed to create tech stack: " + (error?.message || error));
        }
    };

    const handleDeleteStack = async (id) => {
        if (!window.confirm("Delete this tech stack?")) return;
        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.TECH_STACKS, id);
            setTechStacks(techStacks.filter(s => s.$id !== id));
        } catch (error) {
            console.error("Error deleting tech stack:", error);
        }
    };

    const tabs = [
        { id: 'roles', label: 'Roles & Permissions', icon: Key },
        { id: 'statuses', label: 'Task Statuses', icon: Tag },
        { id: 'stacks', label: 'Tech Stacks', icon: Layers }
    ];

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-8">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Settings</h1>
            <p className="text-sm text-gray-500 mb-8">Manage roles, permissions, and task workflow statuses.</p>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-8">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <tab.icon className="h-4 w-4 mr-2" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ──── ROLES TAB ──── */}
            {activeTab === 'roles' && (
                <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-6 py-6 border-b border-gray-100">
                        <h3 className="text-lg leading-6 font-bold text-gray-900 flex items-center">
                            <Key className="h-5 w-5 mr-2 text-indigo-500" />
                            Role Management
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Create roles and assign specific permissions to control access.
                        </p>
                    </div>

                    <div className="px-6 py-6 bg-gray-50/50">
                        <form onSubmit={handleAddRole} className="space-y-6">
                            <div>
                                <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role Name</label>
                                <input
                                    type="text" id="role"
                                    className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-lg p-2.5 bg-white"
                                    placeholder="e.g. Project Manager"
                                    value={newRoleName}
                                    onChange={(e) => setNewRoleName(e.target.value)}
                                />
                            </div>
                            <div>
                                <span className="block text-sm font-medium text-gray-700 mb-2">Permissions</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {PERMISSIONS.map((perm) => (
                                        <div key={perm.id} className="relative flex items-start">
                                            <div className="flex items-center h-5">
                                                <input
                                                    id={`perm-${perm.id}`}
                                                    type="checkbox"
                                                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                                                    checked={selectedPermissions.includes(perm.id)}
                                                    onChange={() => togglePermission(perm.id)}
                                                />
                                            </div>
                                            <div className="ml-3 text-sm">
                                                <label htmlFor={`perm-${perm.id}`} className="font-medium text-gray-700 cursor-pointer">{perm.label}</label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-all"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Create Role
                            </button>
                        </form>
                    </div>

                    <div className="border-t border-gray-100">
                        <ul className="divide-y divide-gray-100">
                            {roles.map((role) => (
                                <li key={role.$id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                                    {editingRole === role.$id ? (
                                        <div className="space-y-4">
                                            <input
                                                type="text"
                                                className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                            />
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {PERMISSIONS.map((perm) => (
                                                    <label key={perm.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                                                            checked={editPermissions.includes(perm.id)}
                                                            onChange={() => toggleEditPermission(perm.id)}
                                                        />
                                                        {perm.label}
                                                    </label>
                                                ))}
                                            </div>
                                            <div className="flex justify-end gap-2 pt-2">
                                                <button onClick={cancelEdit} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                                                <button onClick={() => handleUpdateRole(role.$id)} className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Save</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-sm font-bold text-indigo-600 truncate">{role.name}</p>
                                                    <div className="flex gap-2 ml-4">
                                                        <button onClick={() => startEditRole(role)} className="text-gray-400 hover:text-indigo-600 p-1 rounded-full hover:bg-indigo-50" title="Edit Role">
                                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                        <button onClick={() => handleDeleteRole(role.$id)} className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50" title="Delete Role">
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {role.permissions?.length > 0 ? (
                                                        role.permissions.map(p => (
                                                            <span key={p} className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                                                {PERMISSIONS.find(perm => perm.id === p)?.label || p}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">No permissions</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            ))}
                            {roles.length === 0 && !loading && (
                                <li className="px-6 py-8 text-center text-gray-500 italic">No roles yet. Create one above.</li>
                            )}
                        </ul>
                    </div>
                </div>
            )}

            {/* ──── TASK STATUSES TAB ──── */}
            {activeTab === 'statuses' && (
                <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-6 py-6 border-b border-gray-100">
                        <h3 className="text-lg leading-6 font-bold text-gray-900 flex items-center">
                            <Tag className="h-5 w-5 mr-2 text-indigo-500" />
                            Task Status Management
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Define your task workflow stages. These appear as columns in the Kanban board.
                        </p>
                    </div>

                    {/* Add New Status */}
                    <div className="px-6 py-6 bg-gray-50/50 border-b border-gray-100">
                        <form onSubmit={handleAddStatus} className="flex items-end gap-4">
                            <div className="flex-grow">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status Name</label>
                                <input
                                    type="text"
                                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-lg p-2.5 bg-white"
                                    placeholder="e.g. QA Testing"
                                    value={newStatusName}
                                    onChange={(e) => setNewStatusName(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        className="h-10 w-10 border border-gray-300 rounded-lg cursor-pointer"
                                        value={newStatusColor}
                                        onChange={(e) => setNewStatusColor(e.target.value)}
                                    />
                                    <div className="flex gap-1">
                                        {DEFAULT_COLORS.slice(0, 5).map(c => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setNewStatusColor(c)}
                                                className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${newStatusColor === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="inline-flex items-center px-4 py-2.5 border border-transparent shadow-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-all whitespace-nowrap"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Status
                            </button>
                        </form>
                    </div>

                    {/* Status List */}
                    <div>
                        <ul className="divide-y divide-gray-100">
                            {taskStatuses.map((status, index) => (
                                <li key={status.$id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                                    {editingStatus === status.$id ? (
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="text"
                                                className="flex-grow border border-gray-300 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                                value={editStatusName}
                                                onChange={(e) => setEditStatusName(e.target.value)}
                                            />
                                            <input
                                                type="color"
                                                className="h-9 w-9 border border-gray-300 rounded-lg cursor-pointer"
                                                value={editStatusColor}
                                                onChange={(e) => setEditStatusColor(e.target.value)}
                                            />
                                            <button onClick={() => handleUpdateStatus(status.$id)} className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Save</button>
                                            <button onClick={cancelEditStatus} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {/* Reorder buttons */}
                                                <div className="flex flex-col">
                                                    <button
                                                        onClick={() => moveStatusOrder(status.$id, 'up')}
                                                        disabled={index === 0}
                                                        className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"
                                                    >
                                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => moveStatusOrder(status.$id, 'down')}
                                                        disabled={index === taskStatuses.length - 1}
                                                        className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"
                                                    >
                                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </button>
                                                </div>

                                                {/* Color dot */}
                                                <div
                                                    className="h-5 w-5 rounded-full shadow-sm border border-white"
                                                    style={{ backgroundColor: status.color || '#6366f1' }}
                                                ></div>

                                                {/* Name and order */}
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">{status.name}</p>
                                                    <p className="text-xs text-gray-400">Order: {status.order}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="text-xs font-medium px-3 py-1 rounded-full text-white"
                                                    style={{ backgroundColor: status.color || '#6366f1' }}
                                                >
                                                    Preview
                                                </span>
                                                <button
                                                    onClick={() => startEditStatus(status)}
                                                    className="text-gray-400 hover:text-indigo-600 p-1.5 rounded-full hover:bg-indigo-50 transition-colors"
                                                    title="Edit Status"
                                                >
                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteStatus(status.$id)}
                                                    className="text-gray-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                                                    title="Delete Status"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            ))}
                            {taskStatuses.length === 0 && !loading && (
                                <li className="px-6 py-12 text-center text-gray-500">
                                    <Tag className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                                    <p className="text-sm font-medium text-gray-900">No task statuses defined</p>
                                    <p className="text-xs text-gray-400 mt-1">Create statuses like "New", "In Progress", "Done" to organize your tasks.</p>
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
            )}

            {/* ──── TECH STACKS TAB ──── */}
            {activeTab === 'stacks' && (
                <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-6 py-6 border-b border-gray-100">
                        <h3 className="text-lg leading-6 font-bold text-gray-900 flex items-center">
                            <Layers className="h-5 w-5 mr-2 text-indigo-500" />
                            Tech Stack Management
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Define technology stacks available for the AI Task Creator (e.g., Flutter, Laravel, React, Node.js).
                        </p>
                    </div>

                    <div className="px-6 py-6 bg-gray-50/50 border-b border-gray-100">
                        <form onSubmit={handleAddStack} className="space-y-3">
                            <div className="flex items-end gap-4">
                                <div className="flex-grow">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Stack Name</label>
                                    <input
                                        type="text"
                                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-lg p-2.5 bg-white"
                                        placeholder="e.g. Flutter, Laravel, React Native"
                                        value={newStackName}
                                        onChange={(e) => setNewStackName(e.target.value)}
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="inline-flex items-center px-4 py-2.5 border border-transparent shadow-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-all whitespace-nowrap"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Stack
                                </button>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional — libraries, tools, conventions, etc.)</span></label>
                                <textarea
                                    rows={3}
                                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-lg p-2.5 bg-white"
                                    placeholder="e.g. Uses Flutter 3.x with BLoC pattern, Dio for HTTP, Hive for local storage, GoRouter for navigation. Follow Material Design 3 guidelines."
                                    value={newStackDescription}
                                    onChange={(e) => setNewStackDescription(e.target.value)}
                                />
                            </div>
                        </form>
                    </div>

                    <div>
                        <ul className="divide-y divide-gray-100">
                            {techStacks.map((stack) => (
                                <li key={stack.$id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <Layers className="h-4 w-4 text-indigo-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-900">{stack.name}</p>
                                                {stack.description && (
                                                    <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{stack.description}</p>
                                                )}
                                                {!stack.description && (
                                                    <p className="text-xs text-gray-400 mt-0.5 italic">No description added</p>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteStack(stack.$id)}
                                            className="text-gray-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors flex-shrink-0"
                                            title="Delete Stack"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                            {techStacks.length === 0 && !loading && (
                                <li className="px-6 py-12 text-center text-gray-500">
                                    <Layers className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                                    <p className="text-sm font-medium text-gray-900">No tech stacks defined</p>
                                    <p className="text-xs text-gray-400 mt-1">Add stacks like "Flutter", "Laravel", "React" for the AI Task Creator.</p>
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
