import { useState, useEffect } from 'react';
import { databases, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { ID, Query } from 'appwrite';
import { useAuth } from '../context/AuthContext';
import { Plus, Calendar, Check, X, FileText } from 'lucide-react';

export default function Leaves() {
    const { user, hasPermission } = useAuth();
    const [leaves, setLeaves] = useState([]);
    const [teamLeaves, setTeamLeaves] = useState([]); // For approvals if manager
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [userGender, setUserGender] = useState('');

    const canApproveLeaves = hasPermission('approve_leaves');

    const [application, setApplication] = useState({
        type: 'casual',
        startDate: '',
        endDate: '',
        reason: ''
    });

    useEffect(() => {
        if (user) {
            fetchUserGender();
            fetchLeaves();
            if (canApproveLeaves) {
                fetchTeamLeaves();
            }
        }
    }, [user, canApproveLeaves]);

    const fetchUserGender = async () => {
        try {
            // Find team member record for current user
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.TEAM_MEMBERS,
                [Query.equal('email', user.email)] // Assuming email is link
            );
            if (response.documents.length > 0) {
                setUserGender(response.documents[0].gender);
            }
        } catch (error) {
            console.error("Error fetching user details:", error);
        }
    };

    const fetchLeaves = async () => {
        setLoading(true);
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.LEAVES,
                [Query.equal('userId', user.$id), Query.orderDesc('startDate')]
            );
            setLeaves(response.documents);
        } catch (error) {
            console.error("Error fetching leaves:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTeamLeaves = async () => {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.LEAVES,
                [Query.equal('status', 'pending'), Query.orderDesc('startDate')]
            );
            setTeamLeaves(response.documents);
        } catch (error) {
            console.error("Error fetching team leaves:", error);
        }
    };

    const handleApply = async (e) => {
        e.preventDefault();
        try {
            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.LEAVES,
                ID.unique(),
                {
                    userId: user.$id,
                    userName: user.name,
                    startDate: application.startDate,
                    endDate: application.endDate,
                    type: application.type,
                    reason: application.reason,
                    status: 'pending'
                }
            );
            setShowModal(false);
            setApplication({ type: 'casual', startDate: '', endDate: '', reason: '' });
            fetchLeaves();
        } catch (error) {
            console.error("Error applying for leave:", error);
            alert("Failed to apply for leave.");
        }
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.LEAVES,
                id,
                { status: status }
            );
            fetchTeamLeaves(); // Refresh pending list
            fetchLeaves(); // Refresh my list if I approved my own
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const LEAVE_TYPES = [
        { id: 'casual', label: 'Casual Leave' },
        { id: 'sick', label: 'Sick Leave' },
        { id: 'earned', label: 'Earned Leave' },
        ...(userGender === 'female' ? [{ id: 'menstrual', label: 'Menstrual Leave' }] : [])
    ];

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Leave Management</h1>
                    <p className="mt-1 text-sm text-gray-500">Apply for leaves and manage team requests.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                >
                    <Plus className="-ml-1 mr-2 h-5 w-5" />
                    Apply for Leave
                </button>
            </div>

            {/* Pending Approvals (Visible to Admin/Manager) */}
            {canApproveLeaves && teamLeaves.length > 0 && (
                <div className="mb-10">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <FileText className="h-5 w-5 mr-2 text-orange-500" />
                        Pending Approvals
                    </h2>
                    <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                        <ul className="divide-y divide-gray-100">
                            {teamLeaves.map((leave) => (
                                <li key={leave.$id} className="p-6 hover:bg-gray-50 transition-colors">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                                        <div className="mb-4 sm:mb-0">
                                            <div className="flex items-center">
                                                <span className="font-bold text-gray-900">{leave.userName}</span>
                                                <span className="mx-2 text-gray-300">•</span>
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 capitalize">
                                                    {leave.type}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-sm text-gray-600">
                                                Reason: {leave.reason}
                                            </p>
                                            <div className="mt-2 flex items-center text-sm text-gray-500">
                                                <Calendar className="h-4 w-4 mr-1" />
                                                {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => handleStatusUpdate(leave.$id, 'approved')}
                                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                                            >
                                                <Check className="h-4 w-4 mr-1" /> Approve
                                            </button>
                                            <button
                                                onClick={() => handleStatusUpdate(leave.$id, 'rejected')}
                                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                                            >
                                                <X className="h-4 w-4 mr-1" /> Reject
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* My Leaves */}
            <h2 className="text-lg font-bold text-gray-900 mb-4">My Leaves</h2>
            <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {leaves.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-500 italic">No leave applications found.</td>
                                </tr>
                            ) : (
                                leaves.map((leave) => (
                                    <tr key={leave.$id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="capitalize text-sm text-gray-900 font-medium">{leave.type}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                            {leave.reason}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                ${leave.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                    leave.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                        'bg-yellow-100 text-yellow-800'}`}>
                                                {leave.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Apply Modal */}
            {showModal && (
                <div className="fixed z-50 inset-0 overflow-y-auto" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-black/60 transition-opacity" onClick={() => setShowModal(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="relative z-10 inline-block align-bottom bg-white rounded-2xl px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                            <h3 className="text-lg leading-6 font-bold text-gray-900 mb-4">Apply for Leave</h3>
                            <form onSubmit={handleApply} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Leave Type</label>
                                    <select
                                        required
                                        className="mt-1 block w-full bg-white border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        value={application.type}
                                        onChange={(e) => setApplication({ ...application, type: e.target.value })}
                                    >
                                        {LEAVE_TYPES.map(type => (
                                            <option key={type.id} value={type.id}>{type.label}</option>
                                        ))}
                                    </select>
                                    {application.type === 'menstrual' && (
                                        <p className="mt-1 text-xs text-pink-500">
                                            Note: Menstrual leave is typically granted for 1-2 days based on policy.
                                        </p>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Start Date</label>
                                        <input
                                            type="date"
                                            required
                                            className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={application.startDate}
                                            onChange={(e) => setApplication({ ...application, startDate: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">End Date</label>
                                        <input
                                            type="date"
                                            required
                                            className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={application.endDate}
                                            onChange={(e) => setApplication({ ...application, endDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Reason</label>
                                    <textarea
                                        rows={3}
                                        required
                                        className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        value={application.reason}
                                        onChange={(e) => setApplication({ ...application, reason: e.target.value })}
                                    />
                                </div>
                                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                                    <button
                                        type="submit"
                                        className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
                                    >
                                        Submit
                                    </button>
                                    <button
                                        type="button"
                                        className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                                        onClick={() => setShowModal(false)}
                                    >
                                        Cancel
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
