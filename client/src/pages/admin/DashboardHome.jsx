import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Activity, Clock, Box, Users as UsersIcon } from 'lucide-react';
import api from '../../api/axios';

const DashboardHome = () => {
  const { user } = useContext(AuthContext);
  const [dashboardStats, setDashboardStats] = useState({
    totalUsers: 0,
    activeCourses: 0,
    schedulesGenerated: 0,
    systemStatus: 'Healthy',
  });

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const { data } = await api.get('/admin/dashboard/stats');
        setDashboardStats({
          totalUsers: data.totalUsers ?? 0,
          activeCourses: data.activeCourses ?? 0,
          schedulesGenerated: data.schedulesGenerated ?? 0,
          systemStatus: data.systemStatus || 'Healthy',
        });
      } catch (error) {
        console.error('Failed to fetch dashboard stats', error);
      }
    };

    fetchDashboardStats();
  }, []);
  
  const stats = [
    { title: "Total Users", value: dashboardStats.totalUsers, icon: <UsersIcon size={24} className="text-blue-500"/>, color: "bg-blue-50" },
    { title: "Active Courses", value: dashboardStats.activeCourses, icon: <Box size={24} className="text-emerald-500"/>, color: "bg-emerald-50" },
    { title: "Schedules Generated", value: dashboardStats.schedulesGenerated, icon: <Clock size={24} className="text-purple-500"/>, color: "bg-purple-50" },
    { title: "System Status", value: dashboardStats.systemStatus, icon: <Activity size={24} className="text-rose-500"/>, color: "bg-rose-50" },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200">
        <h1 className="text-3xl font-black mb-2">Welcome back, {user?.name.split(' ')[0]}! 👋</h1>
        <p className="text-indigo-100 font-medium max-w-xl">
          Here is what's happening with your Institutional Timetables today. Explore the sidebar to manage constraints, faculty, and generate new schedules.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center hover:shadow-md transition-shadow">
            <div className={`p-4 rounded-xl ${stat.color} mr-4`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">{stat.title}</p>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardHome;
