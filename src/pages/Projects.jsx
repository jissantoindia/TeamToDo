import { useState, useEffect } from 'react';
import { databases, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { ID, Query } from 'appwrite';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, FolderKanban, Calendar, Building2, DollarSign } from 'lucide-react';

export default function Projects() {
    const { user } = useAuth();
    const [projects, setProjects] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    const [newProject, setNewProject] = useState({
        name: '',
        description: '',
        status: 'active',
        startDate: '',
        endDate: '',
        deadline: '',
        customerId: '',
        customerName: '',
        priority: 'medium',
        budget: ''
    });

    useEffect(() => {
        fetchProjects();
        fetchCustomers();
    }, []);

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.PROJECTS,
                [Query.orderDesc('$createdAt')]
            );
            setProjects(response.documents);
        } catch (error) {
            console.error("Failed to fetch projects:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomers = async () => {
        try {
            const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.CUSTOMERS);
            setCustomers(response.documents);
        } catch (error) {
            console.error("Failed to fetch customers:", error);
        }
    };

    const handleCreateProject = async (e) => {
        e.preventDefault();
        if (!user) {
            alert("You must be logged in to create a project.");
            return;
        }
        try {
            // Find customer name from customerId
            const selectedCustomer = customers.find(c => c.$id === newProject.customerId);

            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.PROJECTS,
                ID.unique(),
                {
                    name: newProject.name,
                    description: newProject.description,
                    status: newProject.status,
                    ownerId: user.$id,
                    startDate: newProject.startDate ? new Date(newProject.startDate).toISOString() : null,
                    endDate: newProject.endDate ? new Date(newProject.endDate).toISOString() : null,
                    deadline: newProject.deadline ? new Date(newProject.deadline).toISOString() : null,
                    customerId: newProject.customerId || null,
                    customerName: selectedCustomer?.name || '',
                    priority: newProject.priority,
                    budget: newProject.budget ? parseFloat(newProject.budget) : 0
                }
            );
            setShowModal(false);
            setNewProject({ name: '', description: '', status: 'active', startDate: '', endDate: '', deadline: '', customerId: '', customerName: '', priority: 'medium', budget: '' });
            fetchProjects();
        } catch (error) {
            console.error("Failed to create project:", error);
            alert("Error creating project. Ensure your Appwrite 'projects' collection has attributes: deadline(string), customerId(string), customerName(string), priority(string), budget(float).");
        }
    };

    const statusColors = {
        active: 'bg-green-100 text-green-800',
        planning: 'bg-blue-100 text-blue-800',
        completed: 'bg-gray-100 text-gray-800',
        paused: 'bg-yellow-100 text-yellow-800'
    };

    const priorityColors = {
        low: 'bg-gray-100 text-gray-600',
        medium: 'bg-yellow-100 text-yellow-700',
        high: 'bg-red-100 text-red-700'
    };

    const filteredProjects = projects.filter(p => {
        const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.customerName?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterStatus === 'all' || p.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    const isOverdue = (deadline) => {
        if (!deadline) return false;
        return new Date(deadline) < new Date();
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Projects</h1>
                    <p className="mt-1 text-sm text-gray-500">Manage your ongoing projects and track progress.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                >
                    <Plus className="-ml-1 mr-2 h-5 w-5" />
                    New Project
                </button>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8 flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <div className="relative flex-grow w-full sm:w-auto">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-lg"
                        placeholder="Search by project or customer name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <select
                    className="block w-full sm:w-40 bg-white border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="all">All Statuses</option>
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                </select>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
            ) : filteredProjects.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-dashed border-gray-300">
                    <div className="mx-auto h-12 w-12 text-gray-400 flex items-center justify-center rounded-full bg-gray-50">
                        <FolderKanban className="h-6 w-6" />
                    </div>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No projects</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by creating a new project.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredProjects.map((project) => (
                        <div key={project.$id} className="bg-white group overflow-hidden shadow-sm rounded-xl border border-gray-100 hover:shadow-md transition-all duration-200">
                            <div className="px-5 py-5">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{project.name}</h3>
                                    <div className="flex gap-1.5 flex-shrink-0 ml-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[project.status] || 'bg-gray-100 text-gray-800'}`}>
                                            {project.status}
                                        </span>
                                        {project.priority && (
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${priorityColors[project.priority] || ''}`}>
                                                {project.priority}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <p className="mt-2 text-sm text-gray-500 line-clamp-2 h-10">
                                    {project.description || "No description provided."}
                                </p>

                                {/* Customer Badge */}
                                {project.customerName && (
                                    <div className="mt-3 flex items-center">
                                        <Building2 className="h-4 w-4 text-blue-500 mr-1.5 flex-shrink-0" />
                                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full truncate">
                                            {project.customerName}
                                        </span>
                                    </div>
                                )}

                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
                                    <div className="flex items-center">
                                        <Calendar className="h-3.5 w-3.5 mr-1" />
                                        <span className="font-medium mr-1">Start:</span>
                                        {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'TBD'}
                                    </div>
                                    <div className="flex items-center">
                                        <Calendar className="h-3.5 w-3.5 mr-1" />
                                        <span className="font-medium mr-1">End:</span>
                                        {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'TBD'}
                                    </div>
                                </div>

                                {project.deadline && (
                                    <div className={`mt-2 text-xs flex items-center ${isOverdue(project.deadline) && project.status !== 'completed' ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                        <span className="mr-1">🎯</span>
                                        Deadline: {new Date(project.deadline).toLocaleDateString()}
                                        {isOverdue(project.deadline) && project.status !== 'completed' && (
                                            <span className="ml-2 bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">Overdue</span>
                                        )}
                                    </div>
                                )}

                                {project.budget > 0 && (
                                    <div className="mt-2 flex items-center text-xs text-gray-400">
                                        <DollarSign className="h-3.5 w-3.5 mr-1 text-green-500" />
                                        Budget: <span className="font-medium text-green-600 ml-1">₹{project.budget?.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                            <div className="bg-gray-50 px-5 py-3 border-t border-gray-100">
                                <div className="text-sm">
                                    <Link to={`/projects/${project.$id}`} className="font-medium text-indigo-600 hover:text-indigo-700 flex items-center transition-colors">
                                        View details <span aria-hidden="true" className="ml-1">&rarr;</span>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Project Modal */}
            {showModal && (
                <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div
                            className="fixed inset-0 bg-black/60 transition-opacity"
                            aria-hidden="true"
                            onClick={() => setShowModal(false)}
                        ></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="relative z-10 inline-block align-bottom bg-white rounded-2xl px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                            <div className="absolute top-0 right-0 pt-4 pr-4">
                                <button
                                    type="button"
                                    className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                                    onClick={() => setShowModal(false)}
                                >
                                    <span className="sr-only">Close</span>
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div>
                                <h3 className="text-lg leading-6 font-bold text-gray-900" id="modal-title">Create New Project</h3>
                                <p className="mt-1 text-sm text-gray-500">Fill in the details to kickstart your new project.</p>
                                <form onSubmit={handleCreateProject} className="mt-6 space-y-5">
                                    <div>
                                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Project Name *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            id="name"
                                            required
                                            className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={newProject.name}
                                            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                                        <textarea
                                            name="description"
                                            id="description"
                                            rows={2}
                                            className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={newProject.description}
                                            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                                        />
                                    </div>

                                    {/* Customer Selection */}
                                    <div>
                                        <label htmlFor="customer" className="block text-sm font-medium text-gray-700">Customer</label>
                                        <select
                                            id="customer"
                                            className="mt-1 block w-full bg-white border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={newProject.customerId}
                                            onChange={(e) => setNewProject({ ...newProject, customerId: e.target.value })}
                                        >
                                            <option value="">-- No Customer --</option>
                                            {customers.map(c => (
                                                <option key={c.$id} value={c.$id}>
                                                    {c.name} {c.company ? `(${c.company})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-400 mt-1">Link this project to a customer.</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                                            <select
                                                id="status"
                                                className="mt-1 block w-full bg-white border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                value={newProject.status}
                                                onChange={(e) => setNewProject({ ...newProject, status: e.target.value })}
                                            >
                                                <option value="planning">Planning</option>
                                                <option value="active">Active</option>
                                                <option value="paused">Paused</option>
                                                <option value="completed">Completed</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="priority" className="block text-sm font-medium text-gray-700">Priority</label>
                                            <select
                                                id="priority"
                                                className="mt-1 block w-full bg-white border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                value={newProject.priority}
                                                onChange={(e) => setNewProject({ ...newProject, priority: e.target.value })}
                                            >
                                                <option value="low">Low</option>
                                                <option value="medium">Medium</option>
                                                <option value="high">High</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Start Date</label>
                                            <input
                                                type="date"
                                                id="startDate"
                                                className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                value={newProject.startDate}
                                                onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">End Date</label>
                                            <input
                                                type="date"
                                                id="endDate"
                                                className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                value={newProject.endDate}
                                                onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="deadline" className="block text-sm font-medium text-gray-700">Deadline</label>
                                            <input
                                                type="date"
                                                id="deadline"
                                                className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                value={newProject.deadline}
                                                onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="budget" className="block text-sm font-medium text-gray-700">Budget (₹)</label>
                                        <input
                                            type="number"
                                            id="budget"
                                            step="0.01"
                                            min="0"
                                            className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            placeholder="0.00"
                                            value={newProject.budget}
                                            onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
                                        />
                                    </div>

                                    <div className="mt-6 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                                            onClick={() => setShowModal(false)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm transition-colors"
                                        >
                                            Create Project
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
