import { useState, useEffect } from 'react';
import { databases, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { ID, Query } from 'appwrite';
import { useAuth } from '../context/AuthContext';
import { Plus, Calendar, Trash2, Sun, Gift, X } from 'lucide-react';

export default function Holidays() {
    const { user, hasPermission } = useAuth();
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const canManage = hasPermission('manage_roles');

    const [form, setForm] = useState({
        name: '', date: '', type: 'paid', description: ''
    });

    useEffect(() => {
        fetchHolidays();
    }, [selectedYear]);

    const fetchHolidays = async () => {
        setLoading(true);
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.HOLIDAYS,
                [Query.equal('year', selectedYear), Query.orderAsc('date'), Query.limit(100)]
            );
            setHolidays(response.documents);
        } catch (error) {
            console.error('Error fetching holidays:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const dateObj = new Date(form.date);
            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.HOLIDAYS,
                ID.unique(),
                {
                    name: form.name,
                    date: form.date,
                    type: form.type,
                    year: dateObj.getFullYear(),
                    description: form.description,
                    createdBy: user.$id
                }
            );
            setShowModal(false);
            setForm({ name: '', date: '', type: 'paid', description: '' });
            fetchHolidays();
        } catch (error) {
            console.error('Error creating holiday:', error);
            alert('Failed to create holiday.');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this holiday?')) return;
        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.HOLIDAYS, id);
            fetchHolidays();
        } catch (error) {
            console.error('Error deleting holiday:', error);
        }
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const currentYear = new Date().getFullYear();
    const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

    const paidCount = holidays.filter(h => h.type === 'paid').length;
    const optionalCount = holidays.filter(h => h.type === 'optional').length;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Holiday Calendar</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        View and manage company holidays. Paid holidays are auto-applied.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {yearOptions.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    {canManage && (
                        <button
                            onClick={() => setShowModal(true)}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-all"
                        >
                            <Plus className="-ml-1 mr-2 h-5 w-5" />
                            Add Holiday
                        </button>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{holidays.length}</p>
                            <p className="text-xs text-gray-500">Total Holidays</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                            <Gift className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{paidCount}</p>
                            <p className="text-xs text-gray-500">Paid Holidays</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                            <Sun className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{optionalCount}</p>
                            <p className="text-xs text-gray-500">Optional Holidays</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Holiday List */}
            <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="px-6 py-12 text-center text-gray-500">Loading holidays...</div>
                ) : holidays.length === 0 ? (
                    <div className="px-6 py-12 text-center text-gray-500 italic">
                        No holidays found for {selectedYear}. {canManage && 'Click "Add Holiday" to create one.'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Holiday</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                    {canManage && (
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {holidays.map((h) => {
                                    const isPast = new Date(h.date + 'T23:59:59') < new Date();
                                    return (
                                        <tr key={h.$id} className={isPast ? 'bg-gray-50/50 opacity-70' : ''}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {formatDate(h.date)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                                                {h.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${h.type === 'paid'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                    {h.type === 'paid' ? '✅ Paid' : '🔶 Optional'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                                {h.description || '—'}
                                            </td>
                                            {canManage && (
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => handleDelete(h.$id)}
                                                        className="text-red-500 hover:text-red-700 transition-colors">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add Holiday Modal */}
            {showModal && (
                <div className="fixed z-50 inset-0 overflow-y-auto" role="dialog">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-black/60 transition-opacity" onClick={() => setShowModal(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                        <div className="relative z-10 inline-block align-bottom bg-white rounded-2xl px-4 pt-5 pb-4 text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900">Add Holiday</h3>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Holiday Name</label>
                                    <input type="text" required
                                        className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="e.g., Christmas Day"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Date</label>
                                        <input type="date" required
                                            className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={form.date}
                                            onChange={(e) => setForm({ ...form, date: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Type</label>
                                        <select required
                                            className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={form.type}
                                            onChange={(e) => setForm({ ...form, type: e.target.value })}
                                        >
                                            <option value="paid">Paid Holiday</option>
                                            <option value="optional">Optional Holiday</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Description (optional)</label>
                                    <textarea rows={2}
                                        className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        placeholder="Additional details..."
                                    />
                                </div>
                                <div className="mt-5 sm:mt-6 flex flex-row gap-3">
                                    <button type="button" onClick={() => setShowModal(false)}
                                        className="flex-1 rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                                        Cancel
                                    </button>
                                    <button type="submit"
                                        className="flex-1 rounded-lg border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700">
                                        Create Holiday
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
