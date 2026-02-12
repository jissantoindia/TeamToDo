import { useState, useEffect } from 'react';
import { databases, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { ID, Query } from 'appwrite';
import { Functions } from 'appwrite';
import { client } from '../lib/appwrite';
import { Plus, Trash2, Mail, Send, RefreshCw, CheckCircle, Clock } from 'lucide-react';

const functions = new Functions(client);
const FUNCTION_ID = 'team-invite';

export default function Team() {
    const [members, setMembers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [resendingId, setResendingId] = useState(null);
    const [newMember, setNewMember] = useState({
        name: '',
        email: '',
        roleId: '',
        employeeId: '',
        mobile: '',
        gender: '',
        hourlyRate: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [membersRes, rolesRes] = await Promise.all([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.ROLES)
            ]);
            setMembers(membersRes.documents);
            setRoles(rolesRes.documents);

            if (rolesRes.documents.length > 0) {
                setNewMember(prev => ({ ...prev, roleId: rolesRes.documents[0].$id }));
            }
        } catch (error) {
            console.error("Error fetching team data:", error);
        } finally {
            setLoading(false);
        }
    };

    const getRoleName = (roleId) => {
        const role = roles.find(r => r.$id === roleId);
        return role ? role.name : 'Team Member';
    };

    // Call Appwrite Cloud Function
    const callFunction = async (payload) => {
        const execution = await functions.createExecution(
            FUNCTION_ID,
            JSON.stringify(payload),
            false, // async
            '/',   // path
            'POST' // method
        );
        const response = JSON.parse(execution.responseBody);
        if (execution.responseStatusCode >= 400) {
            throw new Error(response.error || 'Function execution failed');
        }
        return response;
    };

    // Invite member via Appwrite Cloud Function
    const handleAddMember = async (e) => {
        e.preventDefault();
        setInviting(true);
        try {
            const data = await callFunction({
                action: 'invite',
                name: newMember.name,
                email: newMember.email,
                roleId: newMember.roleId,
                roleName: getRoleName(newMember.roleId),
                employeeId: newMember.employeeId || undefined,
                mobile: newMember.mobile || undefined,
                gender: newMember.gender || undefined,
                hourlyRate: newMember.hourlyRate ? parseFloat(newMember.hourlyRate) : undefined,
            });

            alert(`✅ ${data.message}`);
            setShowModal(false);
            setNewMember({ name: '', email: '', roleId: roles[0]?.$id || '', employeeId: '', mobile: '', gender: '', hourlyRate: '' });
            fetchData();
        } catch (error) {
            console.error("Error inviting member:", error);
            alert("Failed to invite member: " + (error?.message || error));
        } finally {
            setInviting(false);
        }
    };

    // Resend invitation email via Cloud Function
    const handleResendInvite = async (member) => {
        setResendingId(member.$id);
        try {
            const data = await callFunction({
                action: 'resend',
                memberId: member.$id,
                name: member.name,
                email: member.email,
                roleName: getRoleName(member.roleId),
            });

            alert(`✅ ${data.message}`);
            fetchData();
        } catch (error) {
            console.error("Error resending invite:", error);
            alert("Failed to resend: " + (error?.message || error));
        } finally {
            setResendingId(null);
        }
    };

    const handleDeleteMember = async (id) => {
        if (!window.confirm("Are you sure you want to remove this member?")) return;
        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, id);
            setMembers(members.filter(m => m.$id !== id));
        } catch (error) {
            console.error("Error removing member:", error);
        }
    };

    const getStatusBadge = (member) => {
        if (member.inviteStatus === 'accepted') {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                <Clock className="h-3 w-3 mr-1" />
                Pending
            </span>
        );
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Team Management</h1>
                    <p className="mt-1 text-sm text-gray-500">Invite and manage your team members.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                >
                    <Plus className="-ml-1 mr-2 h-5 w-5" />
                    Invite Member
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <div className="bg-white shadow-sm overflow-hidden sm:rounded-xl border border-gray-100">
                    <ul className="divide-y divide-gray-100">
                        {members.length === 0 ? (
                            <li className="px-4 py-16 text-center text-gray-500">
                                <div className="mx-auto h-12 w-12 text-gray-400 flex items-center justify-center rounded-full bg-gray-50 mb-3">
                                    <Send className="h-6 w-6" />
                                </div>
                                <h3 className="text-sm font-medium text-gray-900">No team members yet</h3>
                                <p className="mt-1 text-sm text-gray-500">Invite someone to get started!</p>
                            </li>
                        ) : (
                            members.map((member) => (
                                <li key={member.$id} className="hover:bg-gray-50 transition-colors duration-150">
                                    <div className="px-4 py-5 flex items-center sm:px-6">
                                        {/* Avatar */}
                                        <div className="flex-shrink-0 mr-4">
                                            <div className={`h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md ${member.inviteStatus === 'accepted'
                                                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                                                    : 'bg-gradient-to-br from-gray-400 to-gray-500'
                                                }`}>
                                                {member.name?.substring(0, 2).toUpperCase()}
                                            </div>
                                        </div>

                                        <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                                            <div className="truncate">
                                                <div className="flex items-center text-sm gap-2">
                                                    <p className="font-bold text-gray-900 truncate">{member.name}</p>
                                                    <span className="flex-shrink-0 font-normal text-indigo-700 bg-indigo-50 px-2 rounded-full text-xs flex items-center">
                                                        {getRoleName(member.roleId)}
                                                    </span>
                                                    {getStatusBadge(member)}
                                                </div>
                                                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                                                    <div className="flex items-center text-sm text-gray-500">
                                                        <Mail className="flex-shrink-0 mr-1.5 h-3.5 w-3.5 text-gray-400" />
                                                        <span className="text-xs">{member.email}</span>
                                                    </div>
                                                    {member.employeeId && (
                                                        <span className="text-xs text-gray-400">ID: {member.employeeId}</span>
                                                    )}
                                                    {member.mobile && (
                                                        <span className="text-xs text-gray-400">📱 {member.mobile}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-4 flex-shrink-0 sm:mt-0 sm:ml-5 flex items-center space-x-2">
                                                {member.inviteStatus !== 'accepted' && (
                                                    <button
                                                        onClick={() => handleResendInvite(member)}
                                                        disabled={resendingId === member.$id}
                                                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                                                        title="Resend Invitation Email"
                                                    >
                                                        {resendingId === member.$id ? (
                                                            <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                                        ) : (
                                                            <Send className="h-3.5 w-3.5 mr-1.5" />
                                                        )}
                                                        {resendingId === member.$id ? 'Sending...' : 'Resend Invite'}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteMember(member.$id)}
                                                    className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
                                                    title="Remove Member"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            )}

            {/* Invite Member Modal */}
            {showModal && (
                <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-black/60 transition-opacity" onClick={() => setShowModal(false)}></div>
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
                                <div className="flex items-center mb-1">
                                    <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center mr-3">
                                        <Send className="h-5 w-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg leading-6 font-bold text-gray-900" id="modal-title">Invite Team Member</h3>
                                        <p className="text-sm text-gray-500">An invitation email will be sent automatically.</p>
                                    </div>
                                </div>
                                <form onSubmit={handleAddMember} className="mt-6 space-y-5">
                                    <div>
                                        <label htmlFor="memberName" className="block text-sm font-medium text-gray-700">Full Name *</label>
                                        <input
                                            type="text"
                                            id="memberName"
                                            required
                                            className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={newMember.name}
                                            onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="memberEmail" className="block text-sm font-medium text-gray-700">Email Address *</label>
                                        <input
                                            type="email"
                                            id="memberEmail"
                                            required
                                            className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={newMember.email}
                                            onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                                        />
                                        <p className="text-xs text-gray-400 mt-1">A welcome email with login instructions will be sent to this address.</p>
                                    </div>
                                    <div>
                                        <label htmlFor="memberRole" className="block text-sm font-medium text-gray-700">Role *</label>
                                        <select
                                            id="memberRole"
                                            required
                                            className="mt-1 block w-full bg-white border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={newMember.roleId}
                                            onChange={(e) => setNewMember({ ...newMember, roleId: e.target.value })}
                                        >
                                            {roles.map(role => (
                                                <option key={role.$id} value={role.$id}>{role.name}</option>
                                            ))}
                                            {roles.length === 0 && <option value="">No roles defined</option>}
                                        </select>
                                        {roles.length === 0 && (
                                            <p className="mt-2 text-sm text-red-500">Please create roles in Settings first.</p>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700">Employee ID</label>
                                            <input
                                                type="text"
                                                id="employeeId"
                                                className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                value={newMember.employeeId}
                                                onChange={(e) => setNewMember({ ...newMember, employeeId: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="mobile" className="block text-sm font-medium text-gray-700">Mobile</label>
                                            <input
                                                type="tel"
                                                id="mobile"
                                                className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                value={newMember.mobile}
                                                onChange={(e) => setNewMember({ ...newMember, mobile: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
                                            <select
                                                id="gender"
                                                className="mt-1 block w-full bg-white border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                value={newMember.gender}
                                                onChange={(e) => setNewMember({ ...newMember, gender: e.target.value })}
                                            >
                                                <option value="">Select</option>
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="hourlyRate" className="block text-sm font-medium text-gray-700">Hourly Rate (₹)</label>
                                            <input
                                                type="number"
                                                id="hourlyRate"
                                                min="0"
                                                step="0.01"
                                                className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                value={newMember.hourlyRate}
                                                onChange={(e) => setNewMember({ ...newMember, hourlyRate: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Info banner */}
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start">
                                        <Mail className="h-5 w-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-blue-700">
                                            A <strong>welcome email</strong> with a link to set their password will be sent to the member. They can log in after setting their password.
                                        </p>
                                    </div>

                                    <div className="mt-6 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                                            onClick={() => setShowModal(false)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={inviting}
                                            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {inviting ? (
                                                <>
                                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                                    Sending Invite...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="h-4 w-4 mr-2" />
                                                    Send Invitation
                                                </>
                                            )}
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
