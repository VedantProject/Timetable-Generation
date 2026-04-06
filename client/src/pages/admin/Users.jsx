import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { UserPlus, Shield, User, GraduationCap, Power, PowerOff, Loader2 } from 'lucide-react';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'faculty', department: '' });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      await api.patch(`/admin/users/${id}`, { isActive: !currentStatus });
      setUsers(users.map(u => u._id === id ? { ...u, isActive: !currentStatus } : u));
    } catch (error) {
      alert("Failed to update user status");
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/users', { ...formData, password: 'password123' }); // default password for demo
      setIsModalOpen(false);
      setFormData({ name: '', email: '', role: 'faculty', department: '' });
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to create user");
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800"><Shield size={12} className="mr-1"/> Admin</span>;
      case 'faculty': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><User size={12} className="mr-1"/> Faculty</span>;
      case 'student': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><GraduationCap size={12} className="mr-1"/> Student</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
          <p className="text-slate-500 mt-1">Manage system administrators, faculty members, and student access.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all shadow-md hover:shadow-lg transform active:scale-95"
        >
          <UserPlus size={18} className="mr-2" />
          Add New User
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64 text-indigo-500">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold tracking-wider border-b border-gray-100">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-800">{u.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 container">{u.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getRoleBadge(u.role)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600">{u.department || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 rounded-md text-xs font-semibold ${u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={() => handleToggleStatus(u._id, u.isActive)}
                        className={`p-2 rounded-lg transition-colors ${u.isActive ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                        title={u.isActive ? "Deactivate User" : "Activate User"}
                      >
                        {u.isActive ? <PowerOff size={18} /> : <Power size={18} />}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                      No users found in the system.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform scale-100">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">Add New User</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
                <input required type="text" className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" 
                       value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
                <input required type="email" className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" 
                       value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Role</label>
                  <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white"
                          value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                    <option value="faculty">Faculty</option>
                    <option value="admin">Admin</option>
                    <option value="student">Student</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Department</label>
                  <input type="text" className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" 
                         value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} />
                </div>
              </div>
              
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-md shadow-indigo-200 transition-all active:scale-95">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
