import { useState, useEffect, useCallback } from 'react';
import { databases, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { ID, Query } from 'appwrite';
import { useAuth } from '../context/AuthContext';
import {
    Upload, FileText, Sparkles, Trash2, Plus, Edit3, Check, X, Clock,
    Calendar, User, FolderKanban, Layers, ChevronDown, ChevronRight,
    AlertCircle, Loader2, GripVertical, Save, Gauge
} from 'lucide-react';

const TIME_MODES = [
    { id: 'wipe_coding', label: '🤖 Wipe Coding', desc: 'AI Agent Speed (Extremely Fast)', promptHint: 'Assume the developer is using an AI coding agent (Wipe Coding) that handles 90% of the implementation. Development time is drastically reduced. Give EXTREMELY aggressive estimates (70-80% less than normal). Most tasks should take 15-45 minutes max.' },
    { id: 'very_tight', label: '🔥 Very Tight', desc: 'Minimal buffer, experienced developer', promptHint: 'Give very aggressive, minimal time estimates. Assume the developer is highly experienced and fast. Keep estimates 40-50% below normal. Each task should be squeezed to the absolute minimum realistic time.' },
    { id: 'tight', label: '⚡ Tight', desc: 'Less buffer, efficient pace', promptHint: 'Give slightly tight time estimates with minimal buffer. Assume an efficient developer who works at a good pace. Keep estimates about 15-20% below normal.' },
    { id: 'normal', label: '⚖️ Balanced', desc: 'Standard estimates with reasonable buffer', promptHint: 'Give standard, realistic time estimates with a reasonable buffer for unexpected issues. Balance quality and speed.' },
    { id: 'relaxed', label: '🌿 Relaxed', desc: 'More buffer for quality & learning', promptHint: 'Give generous time estimates with extra buffer for code review, testing, learning, and quality assurance. Add about 20-30% more time than normal.' },
    { id: 'very_relaxed', label: '🏖️ Very Relaxed', desc: 'Maximum buffer, thorough work', promptHint: 'Give very generous time estimates. Include ample time for thorough testing, documentation, exploration, refactoring, and learning. Add about 50-70% more time than normal estimates.' }
];

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export default function AITaskCreator() {
    const { user } = useAuth();

    // Data
    const [projects, setProjects] = useState([]);
    const [members, setMembers] = useState([]);
    const [techStacks, setTechStacks] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form inputs
    const [pdfFile, setPdfFile] = useState(null);
    const [pdfFileName, setPdfFileName] = useState('');
    const [selectedProject, setSelectedProject] = useState('');
    const [selectedMember, setSelectedMember] = useState('');
    const [selectedStack, setSelectedStack] = useState('');
    const [startDate, setStartDate] = useState('');
    const [timeAllocation, setTimeAllocation] = useState('normal');

    // AI state
    const [generating, setGenerating] = useState(false);
    const [generatedTasks, setGeneratedTasks] = useState([]);
    const [aiError, setAiError] = useState('');

    // Edit state
    const [editingTaskIndex, setEditingTaskIndex] = useState(null);
    const [editTask, setEditTask] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // New task
    const [showAddTask, setShowAddTask] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '', description: '', priority: 'medium',
        estimatedHours: 0, estimatedMinutes: 30, dueDate: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [projectsRes, membersRes, stacksRes, statusesRes] = await Promise.all([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TECH_STACKS).catch(() => ({ documents: [] })),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TASK_STATUSES, [Query.orderAsc('order')])
            ]);
            setProjects(projectsRes.documents);
            setMembers(membersRes.documents);
            setTechStacks(stacksRes.documents);
            setStatuses(statusesRes.documents);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    // ─── PDF Handling ───
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            setPdfFile(file);
            setPdfFileName(file.name);
            setAiError('');
        } else if (file) {
            setAiError('Please upload a PDF file.');
            setPdfFile(null);
            setPdfFileName('');
        }
    };

    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    // ─── AI Generation ───
    const handleGenerate = useCallback(async () => {
        if (!pdfFile) return setAiError('Please upload a proposal PDF.');
        if (!selectedProject) return setAiError('Please select a project.');
        if (!selectedMember) return setAiError('Please select a team member.');
        if (!selectedStack) return setAiError('Please select a tech stack.');
        if (!startDate) return setAiError('Please select a starting date.');
        if (!GEMINI_API_KEY) return setAiError('Gemini API key is not configured. Add VITE_GEMINI_API_KEY to your .env file.');

        setGenerating(true);
        setAiError('');
        setGeneratedTasks([]);

        try {
            const base64PDF = await fileToBase64(pdfFile);
            const stackObj = techStacks.find(s => s.$id === selectedStack);
            const stackName = stackObj?.name || selectedStack;
            const stackDescription = stackObj?.description || '';
            const memberObj = members.find(m => (m.userId || m.$id) === selectedMember);
            const memberName = memberObj?.name || 'the assigned member';

            const timeMode = TIME_MODES.find(m => m.id === timeAllocation) || TIME_MODES[2];

            const prompt = `You are a professional project manager. Analyze this proposal PDF and break it down into individual development tasks SPECIFICALLY for the "${stackName}" technology stack.

Context:
- Technology Stack: ${stackName}${stackDescription ? `\n  Stack Details: ${stackDescription}` : ''}
- Developer: ${memberName}
- Project Start Date: ${startDate}
- Time Allocation Mode: ${timeMode.label} — ${timeMode.promptHint}

CRITICAL RULES:
1. **FILTER BY STACK**: Create tasks ONLY for ${stackName}.
   - If stack is "Flutter" or "Mobile", generate ONLY mobile app tasks (screens, widgets, API integration). IGNORE backend, database creation, or web admin panels.
   - If stack is "React", "Vue", or "Angular", generate ONLY frontend web tasks. IGNORE backend/mobile.
   - If stack is "Node", "Laravel", "Python", "Go", generate ONLY backend/API/database tasks. IGNORE frontend UI.
2. **TIME REDUCTION**: Follow the Time Allocation Mode strictly. If "Wipe Coding" is selected, assume AI does 90% of the work. Tasks should take minutes, not hours.
3. **SCOPE**: Do not hallucinate features not in the proposal. Stick to the PDF content but filtered for ${stackName}.

Generate a list of tasks. For each task, provide:
1. title: Clear task title
2. description: Detailed description
3. priority: "high", "medium", or "low"
4. estimatedHours: Integer (0 if < 1h)
5. estimatedMinutes: Integer (0-59)
6. daysFromStart: Integer (working days offset)

Respond ONLY with a JSON array. No markdown, no code blocks.
Example: [{"title":"Setup ${stackName} project","description":"Initialize project structure","priority":"high","estimatedHours":0,"estimatedMinutes":45,"daysFromStart":0}]`;

            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                inlineData: {
                                    mimeType: 'application/pdf',
                                    data: base64PDF
                                }
                            },
                            { text: prompt }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 65536
                    }
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData?.error?.message || `API error: ${response.status}`);
            }

            const data = await response.json();

            // Gemini 2.5 Flash uses thinking mode — response has multiple parts
            // The thinking part comes first, then the actual content
            const parts = data.candidates?.[0]?.content?.parts || [];
            let text = '';
            // Find the part that contains the JSON (skip thinking parts)
            for (const part of parts) {
                if (part.text && part.text.trim().startsWith('[')) {
                    text = part.text;
                    break;
                }
            }
            // If no part starts with [, get the last text part (actual response after thinking)
            if (!text) {
                for (let i = parts.length - 1; i >= 0; i--) {
                    if (parts[i].text) {
                        text = parts[i].text;
                        break;
                    }
                }
            }

            console.log('AI response text (first 500 chars):', text?.substring(0, 500));

            // Parse the JSON response
            let tasks;
            try {
                tasks = JSON.parse(text);
            } catch {
                // Try to extract JSON array from the text (might be wrapped in markdown or have extra text)
                const jsonMatch = text.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    try {
                        tasks = JSON.parse(jsonMatch[0]);
                    } catch {
                        throw new Error('Could not parse AI response. Please try again.');
                    }
                } else {
                    throw new Error('Could not parse AI response. Please try again.');
                }
            }

            if (!Array.isArray(tasks) || tasks.length === 0) {
                throw new Error('AI returned no tasks. Please try again with a more detailed PDF.');
            }

            // Calculate due dates from startDate
            const start = new Date(startDate);
            const enrichedTasks = tasks.map((task, index) => {
                const dueDate = new Date(start);
                const daysToAdd = task.daysFromStart || index;
                // Skip weekends
                let addedDays = 0;
                while (addedDays < daysToAdd) {
                    dueDate.setDate(dueDate.getDate() + 1);
                    if (dueDate.getDay() !== 0 && dueDate.getDay() !== 6) {
                        addedDays++;
                    }
                }
                return {
                    title: task.title || `Task ${index + 1}`,
                    description: task.description || '',
                    priority: ['high', 'medium', 'low'].includes(task.priority) ? task.priority : 'medium',
                    estimatedHours: Math.max(0, parseInt(task.estimatedHours) || 0),
                    estimatedMinutes: Math.min(59, Math.max(0, parseInt(task.estimatedMinutes) || 0)),
                    dueDate: dueDate.toISOString().split('T')[0]
                };
            });

            setGeneratedTasks(enrichedTasks);
        } catch (error) {
            console.error("AI generation error:", error);
            setAiError(error.message || 'Failed to generate tasks. Please try again.');
        } finally {
            setGenerating(false);
        }
    }, [pdfFile, selectedProject, selectedMember, selectedStack, startDate, timeAllocation, techStacks, members]);

    // ─── Task Editing ───
    const startEdit = (index) => {
        setEditingTaskIndex(index);
        setEditTask({ ...generatedTasks[index] });
    };

    const saveEdit = () => {
        if (editingTaskIndex === null) return;
        const updated = [...generatedTasks];
        updated[editingTaskIndex] = { ...editTask };
        setGeneratedTasks(updated);
        setEditingTaskIndex(null);
        setEditTask({});
    };

    const cancelEdit = () => {
        setEditingTaskIndex(null);
        setEditTask({});
    };

    const removeTask = (index) => {
        setGeneratedTasks(prev => prev.filter((_, i) => i !== index));
    };

    const addManualTask = () => {
        if (!newTask.title.trim()) return;
        setGeneratedTasks(prev => [...prev, { ...newTask }]);
        setNewTask({
            title: '', description: '', priority: 'medium',
            estimatedHours: 0, estimatedMinutes: 30,
            dueDate: startDate || new Date().toISOString().split('T')[0]
        });
        setShowAddTask(false);
    };

    // ─── Submit Tasks ───
    const handleSubmitAll = async () => {
        if (generatedTasks.length === 0) return;
        setSubmitting(true);

        try {
            const firstStatus = statuses[0];
            const member = members.find(m => (m.userId || m.$id) === selectedMember);

            const createPromises = generatedTasks.map(task => {
                // Combine hours + minutes into a single decimal for estimatedHours (double)
                const totalHours = (task.estimatedHours || 0) + (task.estimatedMinutes || 0) / 60;

                return databases.createDocument(DATABASE_ID, COLLECTIONS.TASKS, ID.unique(), {
                    title: task.title,
                    description: task.description || '',
                    priority: task.priority || 'medium',
                    estimatedHours: Math.round(totalHours * 100) / 100,
                    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
                    projectId: selectedProject,
                    statusId: firstStatus?.$id || '',
                    status: firstStatus?.name?.toLowerCase() || 'new',
                    creatorId: user?.$id || '',
                    creatorName: user?.name || '',
                    assigneeId: selectedMember,
                    assigneeName: member?.name || ''
                });
            });

            await Promise.all(createPromises);
            setSubmitted(true);
        } catch (error) {
            console.error("Error creating tasks:", error);
            setAiError('Failed to create some tasks: ' + (error?.message || error));
        } finally {
            setSubmitting(false);
        }
    };

    const resetAll = () => {
        setPdfFile(null);
        setPdfFileName('');
        setSelectedProject('');
        setSelectedMember('');
        setSelectedStack('');
        setStartDate('');
        setGeneratedTasks([]);
        setAiError('');
        setSubmitted(false);
    };

    // ─── Priority config ───
    const priorityConfig = {
        high: { color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
        medium: { color: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
        low: { color: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' }
    };

    const totalEstimate = generatedTasks.reduce((sum, t) => {
        return sum + (t.estimatedHours || 0) + (t.estimatedMinutes || 0) / 60;
    }, 0);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    // ─── Success Screen ───
    if (submitted) {
        return (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 py-16">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                    <div className="h-16 w-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Check className="h-8 w-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Tasks Created Successfully!</h2>
                    <p className="text-gray-500 mb-2">
                        <span className="font-semibold text-indigo-600">{generatedTasks.length}</span> tasks have been created and assigned to{' '}
                        <span className="font-semibold">{members.find(m => (m.userId || m.$id) === selectedMember)?.name}</span>
                    </p>
                    <p className="text-sm text-gray-400 mb-8">
                        Project: {projects.find(p => p.$id === selectedProject)?.name} · Stack: {techStacks.find(s => s.$id === selectedStack)?.name}
                    </p>
                    <div className="flex justify-center gap-4">
                        <button onClick={resetAll}
                            className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-all shadow-sm">
                            Create More Tasks
                        </button>
                        <a href="/tasks"
                            className="px-6 py-2.5 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-all">
                            View Tasks
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
                        <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">AI Task Creator</h1>
                        <p className="text-sm text-gray-500">Upload a proposal PDF and let AI break it down into actionable tasks</p>
                    </div>
                </div>
            </div>

            {/* Step 1: Configuration */}
            {generatedTasks.length === 0 && (
                <div className="space-y-6">
                    {/* PDF Upload */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="h-6 w-6 bg-indigo-100 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-600">1</span>
                            Upload Proposal
                        </h3>
                        <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-300 transition-colors">
                            {pdfFileName ? (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="h-12 w-12 bg-red-50 rounded-xl flex items-center justify-center">
                                        <FileText className="h-6 w-6 text-red-500" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-semibold text-gray-900">{pdfFileName}</p>
                                        <p className="text-xs text-gray-400">{(pdfFile.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    <button onClick={() => { setPdfFile(null); setPdfFileName(''); }}
                                        className="ml-4 text-gray-400 hover:text-red-500 p-1">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <label className="cursor-pointer">
                                    <Upload className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-sm font-medium text-gray-700">Click to upload or drag & drop</p>
                                    <p className="text-xs text-gray-400 mt-1">PDF files only (max 20MB)</p>
                                    <input type="file" accept=".pdf,application/pdf" onChange={handleFileChange} className="hidden" />
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Configuration Grid */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="h-6 w-6 bg-indigo-100 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-600">2</span>
                            Configure
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Project */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    <FolderKanban className="h-3.5 w-3.5 inline mr-1.5 text-gray-400" />Project
                                </label>
                                <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
                                    className="block w-full border border-gray-300 rounded-lg py-2.5 px-3 text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500">
                                    <option value="">Select a project...</option>
                                    {projects.map(p => (<option key={p.$id} value={p.$id}>{p.name}</option>))}
                                </select>
                            </div>

                            {/* Assignee */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    <User className="h-3.5 w-3.5 inline mr-1.5 text-gray-400" />Assign To
                                </label>
                                <select value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)}
                                    className="block w-full border border-gray-300 rounded-lg py-2.5 px-3 text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500">
                                    <option value="">Select a team member...</option>
                                    {members.map(m => (<option key={m.$id} value={m.userId || m.$id}>{m.name}</option>))}
                                </select>
                            </div>

                            {/* Tech Stack */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    <Layers className="h-3.5 w-3.5 inline mr-1.5 text-gray-400" />Tech Stack
                                </label>
                                <select value={selectedStack} onChange={(e) => setSelectedStack(e.target.value)}
                                    className="block w-full border border-gray-300 rounded-lg py-2.5 px-3 text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500">
                                    <option value="">Select a stack...</option>
                                    {techStacks.map(s => (<option key={s.$id} value={s.$id}>{s.name}</option>))}
                                </select>
                                {techStacks.length === 0 && (
                                    <p className="text-xs text-amber-600 mt-1">No stacks defined. Add them in <a href="/settings" className="underline">Settings → Tech Stacks</a>.</p>
                                )}
                            </div>

                            {/* Start Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    <Calendar className="h-3.5 w-3.5 inline mr-1.5 text-gray-400" />Starting Date
                                </label>
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                                    className="block w-full border border-gray-300 rounded-lg py-2.5 px-3 text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>

                            {/* Time Allocation */}
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    <Gauge className="h-3.5 w-3.5 inline mr-1.5 text-gray-400" />Time Allocation
                                </label>
                                <select value={timeAllocation} onChange={(e) => setTimeAllocation(e.target.value)}
                                    className="block w-full border border-gray-300 rounded-lg py-2.5 px-3 text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500">
                                    {TIME_MODES.map(mode => (
                                        <option key={mode.id} value={mode.id}>{mode.label} — {mode.desc}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Error */}
                    {aiError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-red-800">Error</p>
                                <p className="text-sm text-red-600">{aiError}</p>
                            </div>
                        </div>
                    )}

                    {/* Generate Button */}
                    <button onClick={handleGenerate} disabled={generating}
                        className={`w-full py-4 rounded-xl font-bold text-white text-base transition-all flex items-center justify-center gap-3 shadow-lg ${generating
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-purple-200 hover:shadow-purple-300'
                            }`}>
                        {generating ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Analyzing PDF & Generating Tasks...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-5 w-5" />
                                Generate Tasks with AI
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Step 2: Review Generated Tasks */}
            {generatedTasks.length > 0 && !submitted && (
                <div className="space-y-6">
                    {/* Summary Bar */}
                    <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl border border-purple-100 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 bg-purple-100 rounded-xl flex items-center justify-center">
                                    <Sparkles className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900">
                                        {generatedTasks.length} tasks generated
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Total estimate: {Math.floor(totalEstimate)}h {Math.round((totalEstimate % 1) * 60)}m
                                        {' · '}{generatedTasks.filter(t => t.priority === 'high').length} high priority
                                        {' · '}{generatedTasks.filter(t => t.priority === 'medium').length} medium
                                        {' · '}{generatedTasks.filter(t => t.priority === 'low').length} low
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setGeneratedTasks([]); setAiError(''); }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all">
                                    ← Re-configure
                                </button>
                                <button onClick={() => setShowAddTask(true)}
                                    className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-1.5">
                                    <Plus className="h-4 w-4" /> Add Task
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Error */}
                    {aiError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-600">{aiError}</p>
                        </div>
                    )}

                    {/* Add Manual Task Form */}
                    {showAddTask && (
                        <div className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-indigo-200 p-5">
                            <h4 className="text-sm font-bold text-gray-900 mb-3">Add Custom Task</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                <div className="sm:col-span-2">
                                    <input type="text" placeholder="Task title *" value={newTask.title}
                                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                        className="block w-full border border-gray-300 rounded-lg py-2 px-3 text-sm" />
                                </div>
                                <div className="sm:col-span-2">
                                    <textarea rows={2} placeholder="Description..." value={newTask.description}
                                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                        className="block w-full border border-gray-300 rounded-lg py-2 px-3 text-sm" />
                                </div>
                                <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                                    className="border border-gray-300 rounded-lg py-2 px-3 text-sm">
                                    <option value="high">High Priority</option>
                                    <option value="medium">Medium Priority</option>
                                    <option value="low">Low Priority</option>
                                </select>
                                <input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                                    className="border border-gray-300 rounded-lg py-2 px-3 text-sm" />
                                <div className="flex gap-2 items-center">
                                    <input type="number" min="0" placeholder="H" value={newTask.estimatedHours}
                                        onChange={(e) => setNewTask({ ...newTask, estimatedHours: parseInt(e.target.value) || 0 })}
                                        className="w-20 border border-gray-300 rounded-lg py-2 px-3 text-sm" />
                                    <span className="text-xs text-gray-400">h</span>
                                    <input type="number" min="0" max="59" placeholder="M" value={newTask.estimatedMinutes}
                                        onChange={(e) => setNewTask({ ...newTask, estimatedMinutes: parseInt(e.target.value) || 0 })}
                                        className="w-20 border border-gray-300 rounded-lg py-2 px-3 text-sm" />
                                    <span className="text-xs text-gray-400">m</span>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowAddTask(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                                <button onClick={addManualTask} className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Add</button>
                            </div>
                        </div>
                    )}

                    {/* Task List */}
                    <div className="space-y-3">
                        {generatedTasks.map((task, index) => (
                            <div key={index}
                                className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 overflow-hidden">
                                {editingTaskIndex === index ? (
                                    /* ─── Editing Mode ─── */
                                    <div className="p-5 space-y-3 bg-indigo-50/30">
                                        <input type="text" value={editTask.title}
                                            onChange={(e) => setEditTask({ ...editTask, title: e.target.value })}
                                            className="block w-full border border-gray-300 rounded-lg py-2 px-3 text-sm font-medium" />
                                        <textarea rows={2} value={editTask.description}
                                            onChange={(e) => setEditTask({ ...editTask, description: e.target.value })}
                                            className="block w-full border border-gray-300 rounded-lg py-2 px-3 text-sm" />
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <select value={editTask.priority} onChange={(e) => setEditTask({ ...editTask, priority: e.target.value })}
                                                className="border border-gray-300 rounded-lg py-2 px-3 text-sm">
                                                <option value="high">High</option>
                                                <option value="medium">Medium</option>
                                                <option value="low">Low</option>
                                            </select>
                                            <input type="date" value={editTask.dueDate}
                                                onChange={(e) => setEditTask({ ...editTask, dueDate: e.target.value })}
                                                className="border border-gray-300 rounded-lg py-2 px-3 text-sm" />
                                            <div className="flex gap-1 items-center">
                                                <input type="number" min="0" value={editTask.estimatedHours}
                                                    onChange={(e) => setEditTask({ ...editTask, estimatedHours: parseInt(e.target.value) || 0 })}
                                                    className="w-16 border border-gray-300 rounded-lg py-2 px-2 text-sm" />
                                                <span className="text-xs text-gray-400">h</span>
                                                <input type="number" min="0" max="59" value={editTask.estimatedMinutes}
                                                    onChange={(e) => setEditTask({ ...editTask, estimatedMinutes: parseInt(e.target.value) || 0 })}
                                                    className="w-16 border border-gray-300 rounded-lg py-2 px-2 text-sm" />
                                                <span className="text-xs text-gray-400">m</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2 pt-1">
                                            <button onClick={cancelEdit} className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                                            <button onClick={saveEdit} className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-1.5">
                                                <Check className="h-3.5 w-3.5" /> Save
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* ─── Display Mode ─── */
                                    <div className="p-4 flex items-start gap-4">
                                        <div className="flex-shrink-0 h-8 w-8 bg-gray-50 rounded-lg flex items-center justify-center text-xs font-bold text-gray-400 border border-gray-100">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <h4 className="font-semibold text-gray-900 text-sm">{task.title}</h4>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <button onClick={() => startEdit(index)}
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                                        <Edit3 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button onClick={() => removeTask(index)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            {task.description && (
                                                <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
                                            )}
                                            <div className="flex flex-wrap gap-2">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${priorityConfig[task.priority]?.color}`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${priorityConfig[task.priority]?.dot}`}></span>
                                                    {task.priority}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                                                    <Clock className="h-3 w-3" />
                                                    {task.estimatedHours}h {task.estimatedMinutes}m
                                                </span>
                                                {task.dueDate && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Submit Button */}
                    <div className="sticky bottom-4 z-10">
                        <button onClick={handleSubmitAll} disabled={submitting || generatedTasks.length === 0}
                            className={`w-full py-4 rounded-xl font-bold text-white text-base transition-all flex items-center justify-center gap-3 shadow-xl ${submitting
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-green-200'
                                }`}>
                            {submitting ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Creating {generatedTasks.length} Tasks...
                                </>
                            ) : (
                                <>
                                    <Save className="h-5 w-5" />
                                    Create {generatedTasks.length} Tasks & Assign to {members.find(m => (m.userId || m.$id) === selectedMember)?.name || 'Member'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
