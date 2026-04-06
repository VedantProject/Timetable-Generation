import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Save, Plus, Trash2, Home, Loader2 } from 'lucide-react';

const Constraints = () => {
  const [loading, setLoading] = useState(false);
  const [semester, setSemester] = useState('Fall 2024');
  const [department, setDepartment] = useState('CSE');

  const [settings, setSettings] = useState({
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    periodsPerDay: 8,
    periodDuration: 60,
    breakPeriods: [4]
  });

  const [rooms, setRooms] = useState([]);
  const [newRoom, setNewRoom] = useState({ roomId: '', capacity: 60, isLab: false, building: '' });

  const fetchConstraints = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/constraints/${semester}`);
      if (data) {
        setSettings({
          workingDays: data.workingDays || [],
          periodsPerDay: data.periodsPerDay || 8,
          periodDuration: data.periodDuration || 60,
          breakPeriods: data.breakPeriods || []
        });
        setRooms(data.rooms || []);
      }
    } catch (error) {
       // If 404, we just use defaults, no constraints yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConstraints();
    // eslint-disable-next-line
  }, [semester]);

  const toggleDay = (day) => {
    setSettings(prev => ({
      ...prev,
      workingDays: prev.workingDays.includes(day) 
        ? prev.workingDays.filter(d => d !== day) 
        : [...prev.workingDays, day]
    }));
  };

  const handleSave = async () => {
    try {
      const payload = {
        semester,
        department,
        ...settings,
        rooms 
      };
      
      // Let's assume we save room mappings later or the backend just accepts IDs. 
      // Actually, since we didn't write an explicit Room CRUD, we will mock the room creations here and just push them.
      // For a robust system, Room needs its own endpoint. For this demo, let's just alert success for settings.
      const { data } = await api.post('/admin/constraints', payload);
      if (data && data.rooms) {
         setRooms(data.rooms);
      }
      alert('Constraints saved successfully!');
    } catch (err) {
      alert('Failed to save constraints. Check connection.');
    }
  };

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Global Constraints</h2>
          <p className="text-slate-500 mt-1">Configure foundational logic for the scheduling algorithm.</p>
        </div>
        <button onClick={handleSave} className="flex items-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95">
          <Save size={18} className="mr-2" />
          Save Configurations
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Settings Panel */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Scheduling Rules</h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Semester Target</label>
                  <input type="text" value={semester} onChange={e => setSemester(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
               </div>
               <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Department</label>
                  <input type="text" value={department} onChange={e => setDepartment(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Periods Per Day</label>
                  <input type="number" min="1" max="15" value={settings.periodsPerDay} onChange={e => setSettings({...settings, periodsPerDay: parseInt(e.target.value)})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
               </div>
               <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Period Duration (mins)</label>
                  <input type="number" min="1" value={settings.periodDuration} onChange={e => setSettings({...settings, periodDuration: parseInt(e.target.value)})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
               </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Working Days</label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map(day => (
                  <button key={day} onClick={() => toggleDay(day)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${settings.workingDays.includes(day) ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
               <label className="block text-sm font-semibold text-slate-700 mb-1">Break Periods (Comma separated numbers)</label>
               <input type="text" placeholder="e.g. 4, 5" value={settings.breakPeriods.join(', ')} onChange={e => setSettings({...settings, breakPeriods: e.target.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n))})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

          </div>
        </div>

        {/* Room Management Panel */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[500px]">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Room Inventory</h3>
          
          {/* Note: In a complete application, rooms should be saved properly before mapping IDs */}
          <div className="flex space-x-2 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <input type="text" placeholder="Room ID" value={newRoom.roomId} onChange={e => setNewRoom({...newRoom, roomId: e.target.value})} className="flex-1 px-3 py-2 border rounded-lg text-sm" />
            <input type="number" placeholder="Cap" value={newRoom.capacity} onChange={e => setNewRoom({...newRoom, capacity: parseInt(e.target.value)})} className="w-20 px-3 py-2 border rounded-lg text-sm" />
            <div className="flex items-center space-x-1">
              <input type="checkbox" id="lab" checked={newRoom.isLab} onChange={e => setNewRoom({...newRoom, isLab: e.target.checked})} />
              <label htmlFor="lab" className="text-xs font-semibold">Lab</label>
            </div>
            <button 
              onClick={() => { if(newRoom.roomId) setRooms([...rooms, {...newRoom, _id: 'temp_'+Date.now()}]); setNewRoom({ roomId: '', capacity: 60, isLab: false, building: '' }); }}
              className="bg-emerald-500 text-white px-3 py-2 rounded-lg hover:bg-emerald-600 font-medium text-sm flex items-center"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
            {rooms.length === 0 ? <p className="text-slate-400 text-center text-sm mt-4">No rooms added yet.</p> : 
            rooms.map((room, i) => (
              <div key={i} className="flex justify-between items-center p-3 rounded-xl border border-slate-100 bg-white shadow-sm">
                <div className="flex items-center">
                  <Home size={18} className="text-indigo-400 mr-3" />
                  <div>
                    <h4 className="font-bold text-slate-700 text-sm">{room.roomId}</h4>
                    <p className="text-xs text-slate-500">Cap: {room.capacity} | {room.isLab ? 'Lab' : 'Theory'}</p>
                  </div>
                </div>
                <button onClick={() => setRooms(rooms.filter((r, idx) => idx !== i))} className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
};

export default Constraints;
