import React, { useState, useEffect, useContext } from 'react';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { XCircle, RefreshCw, CalendarOff, Loader2 } from 'lucide-react';

const CancelMakeup = () => {
  const { user } = useContext(AuthContext);
  const [semester, setSemester] = useState('Fall 2024');
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  
  // Reschedule Modal State
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [makeupForm, setMakeupForm] = useState({ newDay: 'Monday', newPeriod: 1, newRoomId: '' });
  const [rooms, setRooms] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ttRes, csRes] = await Promise.all([
        api.get(`/admin/timetable/${semester}`),
        api.get(`/admin/constraints/${semester}`)
      ]);
      
      if (ttRes.data && ttRes.data.entries) {
        // Filter classes belonging to the faculty
        const facEntries = ttRes.data.entries.filter(e => e.facultyId?._id === user._id);
        setEntries(facEntries);
      }
      
      if (csRes.data && csRes.data.rooms) {
        setRooms(csRes.data.rooms);
        if(csRes.data.rooms.length > 0) {
           setMakeupForm(prev => ({ ...prev, newRoomId: csRes.data.rooms[0]._id }));
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [semester]);

  const handleCancelClass = async (entryId) => {
    if(!window.confirm("Are you sure you want to cancel this class? Students will be notified.")) return;
    try {
      await api.patch(`/faculty/timetable/entry/${entryId}/cancel`);
      alert("Class cancelled.");
      fetchData();
    } catch (error) {
      alert("Error cancelling class.");
    }
  };

  const handleOpenReschedule = (entry) => {
    setSelectedEntry(entry);
    setMakeupForm({ newDay: 'Monday', newPeriod: 1, newRoomId: rooms[0]?._id });
    setIsRescheduleOpen(true);
  };

  const submitMakeup = async (e) => {
    e.preventDefault();
    try {
      await api.post('/faculty/timetable/makeup', {
        originalEntryId: selectedEntry._id,
        ...makeupForm
      });
      alert("Makeup class scheduled successfully!");
      setIsRescheduleOpen(false);
      fetchData();
    } catch (error) {
      alert(`Conflict Detected:\n${error.response?.data?.details || "Failed to schedule."}`);
    }
  };

  const getDayColor = (day) => {
    const map = {
      'Monday': 'bg-blue-100 text-blue-700',
      'Tuesday': 'bg-indigo-100 text-indigo-700',
      'Wednesday': 'bg-purple-100 text-purple-700',
      'Thursday': 'bg-pink-100 text-pink-700',
      'Friday': 'bg-rose-100 text-rose-700'
    };
    return map[day] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manage Classes</h2>
          <p className="text-slate-500 mt-1">Cancel regular classes and schedule conflict-free makeup sessions.</p>
        </div>
        <select value={semester} onChange={e => setSemester(e.target.value)} className="px-4 py-2 border rounded-xl outline-none font-semibold focus:ring-2 focus:ring-emerald-500 bg-slate-50">
          <option value="Fall 2024">Fall 2024</option>
          <option value="Spring 2025">Spring 2025</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        {loading ? (
           <div className="flex justify-center p-12 text-emerald-500"><Loader2 className="animate-spin" size={32}/></div>
        ) : entries.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 text-slate-400">
             <CalendarOff size={48} className="mb-4 opacity-50" />
             <p>You have no classes scheduled for this semester.</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {entries.filter(e => !e.isMakeup).map(entry => (
              <div key={entry._id} className={`border p-5 rounded-2xl transition-all shadow-sm ${entry.isCancelled ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-emerald-100 hover:shadow-md'}`}>
                
                <div className="flex justify-between items-start mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getDayColor(entry.day)}`}>
                    {entry.day} • P{entry.period}
                  </span>
                  {entry.isCancelled && <span className="bg-rose-100 text-rose-700 font-bold text-[10px] px-2 py-1 rounded">CANCELLED</span>}
                </div>

                <h3 className={`font-black text-xl mb-1 ${entry.isCancelled ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                  {entry.courseId?.courseCode} - {entry.sectionId}
                </h3>
                <p className="text-sm font-semibold text-slate-500 mb-4">{entry.roomId?.roomId} | {entry.isLab ? 'Laboratory' : 'Theory'}</p>

                <div className="flex space-x-2 border-t pt-4 border-slate-100">
                  {!entry.isCancelled ? (
                    <button 
                      onClick={() => handleCancelClass(entry._id)}
                      className="flex-1 flex justify-center items-center py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold rounded-lg transition-colors text-sm"
                    >
                      <XCircle size={16} className="mr-2" /> Cancel Class
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleOpenReschedule(entry)}
                      className="flex-1 flex justify-center items-center py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-semibold rounded-lg transition-colors text-sm"
                    >
                      <RefreshCw size={16} className="mr-2" /> Schedule Makeup
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isRescheduleOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-indigo-50">
                <h3 className="text-lg font-bold text-indigo-900 flex items-center">
                   <RefreshCw size={18} className="mr-2" /> Schedule Makeup
                </h3>
                <button onClick={() => setIsRescheduleOpen(false)} className="text-indigo-400 hover:text-indigo-600 font-bold">&times;</button>
              </div>

              <form onSubmit={submitMakeup} className="p-6 space-y-4">
                 <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Select Day</label>
                    <select required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={makeupForm.newDay} onChange={e => setMakeupForm({...makeupForm, newDay: e.target.value})}>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                 </div>
                 
                 <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Select Period</label>
                    <select required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={makeupForm.newPeriod} onChange={e => setMakeupForm({...makeupForm, newPeriod: parseInt(e.target.value)})}>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(p => <option key={p} value={p}>Period {p}</option>)}
                    </select>
                 </div>

                 <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Select Available Room</label>
                    <select required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={makeupForm.newRoomId} onChange={e => setMakeupForm({...makeupForm, newRoomId: e.target.value})}>
                      {rooms.map(r => <option key={r._id} value={r._id}>{r.roomId} (Cap: {r.capacity})</option>)}
                    </select>
                 </div>

                 <div className="pt-4 flex space-x-3">
                   <button type="button" onClick={() => setIsRescheduleOpen(false)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold">Cancel</button>
                   <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700">Check & Confirm</button>
                 </div>
              </form>
           </div>
        </div>
      )}

    </div>
  );
};

export default CancelMakeup;
