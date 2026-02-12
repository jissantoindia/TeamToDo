import { useState } from 'react';
import { databases, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { ID } from 'appwrite';
import { useAuth } from '../context/AuthContext';
import { X } from 'lucide-react';

export default function TimeLogModal({ task, onClose, onSave }) {
    const { user } = useAuth();
    const [entry, setEntry] = useState({
        date: new Date().toISOString().split('T')[0],
        duration: '',
        notes: '' // We didn't define notes in schema but we can ignore it or add it later
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.TIME_ENTRIES,
                ID.unique(),
                {
                    taskId: task.$id,
                    userId: user.$id,
                    startTime: new Date(entry.date).toISOString(), // Simplified: just use date as start
                    duration: parseFloat(entry.duration)
                }
            );
            onSave();
            onClose();
        } catch (error) {
            console.error("Error logging time:", error);
            alert("Failed to log time.");
        }
    };

    return (
        <div className="fixed z-20 inset-0 overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-black/60 transition-opacity" onClick={onClose}></div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                <div className="relative z-10 inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full sm:p-6">
                    <div className="absolute top-0 right-0 pt-4 pr-4">
                        <button onClick={onClose} className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none">
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                    <div>
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Log Time for: {task.title}</h3>
                        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Date</label>
                                <input
                                    type="date"
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={entry.date}
                                    onChange={(e) => setEntry({ ...entry, date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Duration (Hours)</label>
                                <input
                                    type="number"
                                    step="0.25"
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="e.g. 1.5"
                                    value={entry.duration}
                                    onChange={(e) => setEntry({ ...entry, duration: e.target.value })}
                                />
                            </div>
                            <div className="mt-5">
                                <button
                                    type="submit"
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                                >
                                    Log Time
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
