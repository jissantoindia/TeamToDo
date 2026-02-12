import { useState, useEffect } from 'react';
import { databases, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { ID, Query } from 'appwrite';
import { Plus, Search, Trash2, Building2, Mail, Phone, MapPin, Globe } from 'lucide-react';

export default function Customers() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingCustomer, setEditingCustomer] = useState(null);

    const [newCustomer, setNewCustomer] = useState({
        name: '',
        email: '',
        phone: '',
        company: '',
        address: '',
        website: '',
        notes: ''
    });

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.CUSTOMERS,
                [Query.orderDesc('$createdAt')]
            );
            setCustomers(response.documents);
        } catch (error) {
            console.error("Error fetching customers:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.CUSTOMERS,
                ID.unique(),
                { ...newCustomer }
            );
            setShowModal(false);
            setNewCustomer({ name: '', email: '', phone: '', company: '', address: '', website: '', notes: '' });
            fetchCustomers();
        } catch (error) {
            console.error("Error creating customer:", error);
            alert("Failed to create customer. Ensure 'customers' collection exists in Appwrite with attributes: name(string), email(string), phone(string), company(string), address(string), website(string), notes(string).");
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.CUSTOMERS,
                editingCustomer.$id,
                {
                    name: newCustomer.name,
                    email: newCustomer.email,
                    phone: newCustomer.phone,
                    company: newCustomer.company,
                    address: newCustomer.address,
                    website: newCustomer.website,
                    notes: newCustomer.notes
                }
            );
            setEditingCustomer(null);
            setShowModal(false);
            setNewCustomer({ name: '', email: '', phone: '', company: '', address: '', website: '', notes: '' });
            fetchCustomers();
        } catch (error) {
            console.error("Error updating customer:", error);
            alert("Failed to update customer.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this customer? Projects linked to this customer won't be deleted.")) return;
        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.CUSTOMERS, id);
            setCustomers(customers.filter(c => c.$id !== id));
        } catch (error) {
            console.error("Error deleting customer:", error);
        }
    };

    const openEdit = (customer) => {
        setEditingCustomer(customer);
        setNewCustomer({
            name: customer.name || '',
            email: customer.email || '',
            phone: customer.phone || '',
            company: customer.company || '',
            address: customer.address || '',
            website: customer.website || '',
            notes: customer.notes || ''
        });
        setShowModal(true);
    };

    const openCreate = () => {
        setEditingCustomer(null);
        setNewCustomer({ name: '', email: '', phone: '', company: '', address: '', website: '', notes: '' });
        setShowModal(true);
    };

    const filteredCustomers = customers.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Customers</h1>
                    <p className="mt-1 text-sm text-gray-500">Manage your clients and link them to projects.</p>
                </div>
                <button
                    onClick={openCreate}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                >
                    <Plus className="-ml-1 mr-2 h-5 w-5" />
                    Add Customer
                </button>
            </div>

            {/* Search */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8 flex items-center">
                <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-lg"
                        placeholder="Search customers by name, company, or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
            ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-dashed border-gray-300">
                    <Building2 className="mx-auto h-12 w-12 text-gray-300" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No customers</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by adding your first customer.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredCustomers.map((customer) => (
                        <div key={customer.$id} className="bg-white group overflow-hidden shadow-sm rounded-xl border border-gray-100 hover:shadow-md transition-all duration-200">
                            <div className="px-5 py-5">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center">
                                        <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md mr-3 flex-shrink-0">
                                            {customer.name?.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="text-md font-bold text-gray-900 truncate">{customer.name}</h3>
                                            {customer.company && (
                                                <p className="text-xs text-indigo-600 font-medium">{customer.company}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => openEdit(customer)} className="text-gray-400 hover:text-indigo-600 p-1 rounded-full hover:bg-indigo-50 transition-colors" title="Edit">
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button onClick={() => handleDelete(customer.$id)} className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors" title="Delete">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-4 space-y-2 text-sm text-gray-500">
                                    {customer.email && (
                                        <div className="flex items-center">
                                            <Mail className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                                            <span className="truncate">{customer.email}</span>
                                        </div>
                                    )}
                                    {customer.phone && (
                                        <div className="flex items-center">
                                            <Phone className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                                            <span>{customer.phone}</span>
                                        </div>
                                    )}
                                    {customer.address && (
                                        <div className="flex items-center">
                                            <MapPin className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                                            <span className="truncate">{customer.address}</span>
                                        </div>
                                    )}
                                    {customer.website && (
                                        <div className="flex items-center">
                                            <Globe className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                                            <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate">{customer.website}</a>
                                        </div>
                                    )}
                                </div>
                                {customer.notes && (
                                    <p className="mt-3 text-xs text-gray-400 border-t border-gray-50 pt-3 line-clamp-2">{customer.notes}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create / Edit Modal */}
            {showModal && (
                <div className="fixed z-50 inset-0 overflow-y-auto" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-black/60 transition-opacity" onClick={() => { setShowModal(false); setEditingCustomer(null); }}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="relative z-10 inline-block align-bottom bg-white rounded-2xl px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                            <h3 className="text-lg leading-6 font-bold text-gray-900 mb-1">
                                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                            </h3>
                            <p className="text-sm text-gray-500 mb-5">
                                {editingCustomer ? 'Update the customer details below.' : 'Fill in the details for the new customer.'}
                            </p>
                            <form onSubmit={editingCustomer ? handleUpdate : handleCreate} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">Customer Name *</label>
                                        <input type="text" required className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Email</label>
                                        <input type="email" className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Phone</label>
                                        <input type="tel" className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Company</label>
                                        <input type="text" className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" value={newCustomer.company} onChange={(e) => setNewCustomer({ ...newCustomer, company: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Website</label>
                                        <input type="url" className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="https://..." value={newCustomer.website} onChange={(e) => setNewCustomer({ ...newCustomer, website: e.target.value })} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">Address</label>
                                        <input type="text" className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">Notes</label>
                                        <textarea rows={2} className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" value={newCustomer.notes} onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })} />
                                    </div>
                                </div>
                                <div className="mt-5 flex justify-end gap-3">
                                    <button type="button" className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50" onClick={() => { setShowModal(false); setEditingCustomer(null); }}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm">
                                        {editingCustomer ? 'Update Customer' : 'Add Customer'}
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
