import React, { useContext } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { 
  CalendarDays, 
  Settings, 
  CalendarOff, 
  LogOut 
} from 'lucide-react';

const FacultyLayout = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'My Schedule', path: '/faculty', icon: <CalendarDays size={20} />, exact: true },
    { name: 'My Preferences', path: '/faculty/preferences', icon: <Settings size={20} /> },
    { name: 'Cancel/Reschedule', path: '/faculty/manage-classes', icon: <CalendarOff size={20} /> }
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 shadow-xl flex flex-col justify-between transition-all duration-300">
        <div>
          <div className="h-20 flex items-center justify-center border-b border-slate-800 bg-slate-950/50">
            <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-wider">
              FACULTY PORTAL
            </h1>
          </div>
          
          <div className="flex flex-col p-4 space-y-2 mt-4">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 rounded-xl transition-all duration-300 group ${
                    isActive 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/50' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`
                }
              >
                <div className="mr-3 transition-transform duration-300 group-hover:scale-110">
                  {item.icon}
                </div>
                <span className="font-semibold text-sm">{item.name}</span>
              </NavLink>
            ))}
          </div>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 bg-slate-950/30 border-t border-slate-800">
          <div className="flex items-center mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold shadow-md">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user?.name}</p>
              <p className="text-xs text-emerald-300 truncate">{user?.department}</p>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-2 text-sm font-semibold text-red-400 bg-red-400/10 hover:bg-red-500 hover:text-white rounded-lg transition-colors duration-200"
          >
            <LogOut size={16} className="mr-2" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 overflow-y-auto bg-slate-50/50 relative">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-emerald-100/50 to-transparent -z-10 pointer-events-none"></div>
        <div className="p-8">
          <Outlet />
        </div>
      </div>
      
    </div>
  );
};

export default FacultyLayout;
