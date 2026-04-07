import React, { useState, useEffect, useContext } from 'react';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { XCircle, RefreshCw, CalendarOff, Loader2 } from 'lucide-react';

const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const EXTRA_ALLOWED_DAYS = ['Saturday'];
const DEFAULT_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

const getIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

const CancelMakeup = () => {
  const { user } = useContext(AuthContext);
  const [semester, setSemester] = useState('Fall 2024');
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [constraint, setConstraint] = useState(null);
  
  // Reschedule Modal State
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [makeupForm, setMakeupForm] = useState({ newDay: 'Monday', newPeriod: 1, newRoomId: '' });
  const [isExtraOpen, setIsExtraOpen] = useState(false);
  const [extraForm, setExtraForm] = useState({ newDay: 'Monday', newPeriod: 1, newRoomId: '' });
  const [rooms, setRooms] = useState([]);

  const workingDays = constraint?.workingDays?.length ? constraint.workingDays : DEFAULT_DAYS;
  const scheduleDays = [...new Set([...workingDays, ...EXTRA_ALLOWED_DAYS])];
  const breakPeriods = new Set((constraint?.breakPeriods || []).map(Number));
  const schedulePeriods = Array.from(
    { length: Number(constraint?.periodsPerDay) || DEFAULT_PERIODS.length },
    (_, index) => index + 1
  );

  const selectedRoomOptions = rooms.filter(room => {
    if (!selectedEntry) return true;
    return !!room.isLab === !!selectedEntry.isLab;
  });
  const selectedExtraRoomOptions = rooms.filter(room => {
    if (!selectedEntry) return true;
    return !!room.isLab === !!selectedEntry.isLab;
  });

  const getLinkedMakeup = (entryId) =>
    entries.find(entry => entry.isMakeup && getIdString(entry.originalEntryId) === getIdString(entryId));

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ttRes, csRes] = await Promise.all([
        api.get(`/timetable/${semester}`),
        api.get(`/faculty/constraints/${semester}`)
      ]);
      
      if (ttRes.data && ttRes.data.entries) {
        // Filter classes belonging to the faculty
        const facEntries = ttRes.data.entries.filter(e => getIdString(e.facultyId) === getIdString(user._id));
        setEntries(facEntries);
      }
      
      if (csRes.data && csRes.data.rooms) {
        setConstraint(csRes.data);
        setRooms(csRes.data.rooms);
        if(csRes.data.rooms.length > 0) {
          setMakeupForm(prev => ({ ...prev, newRoomId: csRes.data.rooms[0]._id }));
          setExtraForm(prev => ({ ...prev, newRoomId: csRes.data.rooms[0]._id }));
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
    const currentEntry = entries.find(entry => entry._id === entryId);
    const isRemovingCancel = currentEntry?.isCancelled;
    const message = isRemovingCancel
      ? "Remove the cancel status and restore this class for students?"
      : "Are you sure you want to cancel this class? Students will see it as class canceled.";
    if(!window.confirm(message)) return;
    try {
      await api.patch(`/faculty/timetable/entry/${entryId}/cancel`);
      alert(isRemovingCancel ? "Class restored." : "Class canceled.");
      fetchData();
    } catch (error) {
      alert("Error updating class cancellation.");
    }
  };

  const handleOpenReschedule = (entry) => {
    const matchingRooms = rooms.filter(room => !!room.isLab === !!entry.isLab);
    setSelectedEntry(entry);
    setMakeupForm({ newDay: scheduleDays[0] || 'Monday', newPeriod: schedulePeriods[0] || 1, newRoomId: matchingRooms[0]?._id || '' });
    setIsRescheduleOpen(true);
  };

  const handleOpenExtraClass = (entry) => {
    const matchingRooms = rooms.filter(room => !!room.isLab === !!entry.isLab);
    setSelectedEntry(entry);
    setExtraForm({ newDay: scheduleDays[0] || 'Monday', newPeriod: schedulePeriods[0] || 1, newRoomId: matchingRooms[0]?._id || '' });
    setIsExtraOpen(true);
  };

  const submitMakeup = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/faculty/timetable/makeup', {
        originalEntryId: selectedEntry._id,
        ...makeupForm
      });
      await fetchData();
      alert(data?.message || "Makeup class scheduled successfully!");
      setIsRescheduleOpen(false);
    } catch (error) {
      const status = error.response?.status;
      const message =
        error.response?.data?.details ||
        error.response?.data?.message ||
        "Failed to schedule.";

      if (status === 409) {
        alert(`Conflict Detected:\n${message}`);
      } else {
        alert(message);
      }
    }
  };

  const submitExtraClass = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/faculty/timetable/extra-class', {
        sourceEntryId: selectedEntry._id,
        ...extraForm
      });
      await fetchData();
      alert(data?.message || "Extra class scheduled successfully!");
      setIsExtraOpen(false);
    } catch (error) {
      const status = error.response?.status;
      const message =
        error.response?.data?.details ||
        error.response?.data?.message ||
        "Failed to schedule the extra class.";

      if (status === 409) {
        alert(`Conflict Detected:\n${message}`);
      } else {
        alert(message);
      }
    }
  };

  const handleDeleteExtraClass = async (entryId) => {
    if (!window.confirm("Delete this extra class completely from the timetable?")) return;

    try {
      const { data } = await api.delete(`/faculty/timetable/entry/${entryId}/extra-class`);
      await fetchData();
      alert(data?.message || "Extra class deleted successfully!");
    } catch (error) {
      alert(error.response?.data?.message || "Failed to delete the extra class.");
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

  const regularEntries = entries.filter(e => !e.isMakeup && !e.isExtraClass);
  const extraEntries = entries.filter(e => e.isExtraClass);
  const makeupEntries = entries.filter(e => e.isMakeup);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manage Classes</h2>
          <p className="text-slate-500 mt-1">Cancel regular classes, schedule makeup sessions, and add extra classes in conflict-free slots.</p>
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
            {regularEntries.map(entry => (
              <div key={entry._id} className={`border p-5 rounded-2xl transition-all shadow-sm ${entry.isCancelled ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-emerald-100 hover:shadow-md'}`}>
                {(() => {
                  const linkedMakeup = getLinkedMakeup(entry._id);

                  return (
                    <>
                
                      <div className="flex justify-between items-start mb-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getDayColor(entry.day)}`}>
                          {entry.day} • P{entry.period}
                        </span>
                        <div className="flex items-center gap-2">
                          {linkedMakeup && (
                            <span className="bg-indigo-100 text-indigo-700 font-bold text-[10px] px-2 py-1 rounded">MAKEUP EXISTS</span>
                          )}
                          {entry.isCancelled && <span className="bg-rose-100 text-rose-700 font-bold text-[10px] px-2 py-1 rounded">CANCELLED</span>}
                        </div>
                      </div>

                      <h3 className={`font-black text-xl mb-1 ${entry.isCancelled ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {entry.courseId?.courseCode} - {entry.sectionId}
                      </h3>
                      <p className="text-sm font-semibold text-slate-500 mb-2">{entry.roomId?.roomId} | {entry.isLab ? 'Laboratory' : 'Theory'}</p>
                      {linkedMakeup && (
                        <p className="text-xs text-indigo-700 font-semibold mb-4">
                          Makeup scheduled for {linkedMakeup.day} P{linkedMakeup.period}. Restore this class to remove it.
                        </p>
                      )}

                      <div className="flex space-x-2 border-t pt-4 border-slate-100">
                        {!entry.isCancelled ? (
                          <>
                            <button 
                              onClick={() => handleCancelClass(entry._id)}
                              className="flex-1 flex justify-center items-center py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold rounded-lg transition-colors text-sm"
                            >
                              <XCircle size={16} className="mr-2" /> Cancel Class
                            </button>
                            <button 
                              onClick={() => handleOpenExtraClass(entry)}
                              className="flex-1 flex justify-center items-center py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold rounded-lg transition-colors text-sm"
                            >
                              <RefreshCw size={16} className="mr-2" /> Add Extra Class
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => handleCancelClass(entry._id)}
                              className="flex-1 flex justify-center items-center py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold rounded-lg transition-colors text-sm"
                            >
                              <RefreshCw size={16} className="mr-2" /> Remove Cancel
                            </button>
                            <button 
                              onClick={() => handleOpenReschedule(entry)}
                              disabled={!!linkedMakeup}
                              className="flex-1 flex justify-center items-center py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed font-semibold rounded-lg transition-colors text-sm"
                            >
                              <RefreshCw size={16} className="mr-2" /> Schedule Makeup
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            ))}

            {extraEntries.map(entry => (
              <div key={entry._id} className="border p-5 rounded-2xl transition-all shadow-sm bg-amber-50 border-amber-200">
                <div className="flex justify-between items-start mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getDayColor(entry.day)}`}>
                    {entry.day} • P{entry.period}
                  </span>
                  <span className="bg-amber-100 text-amber-700 font-bold text-[10px] px-2 py-1 rounded">EXTRA CLASS</span>
                </div>

                <h3 className="font-black text-xl mb-1 text-slate-800">
                  {entry.courseId?.courseCode} - {entry.sectionId}
                </h3>
                <p className="text-sm font-semibold text-slate-500 mb-2">{entry.roomId?.roomId} | {entry.isLab ? 'Laboratory' : 'Theory'}</p>
                <p className="text-xs text-amber-700 font-semibold mb-4">
                  This extra class is already visible in the shared timetable for admin and students.
                </p>

                <div className="flex space-x-2 border-t pt-4 border-slate-100">
                  <button 
                    onClick={() => handleDeleteExtraClass(entry._id)}
                    className="flex-1 flex justify-center items-center py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold rounded-lg transition-colors text-sm"
                  >
                    <XCircle size={16} className="mr-2" />
                    Delete Extra Class
                  </button>
                </div>
              </div>
            ))}

            {makeupEntries.map(entry => (
              <div key={entry._id} className="border p-5 rounded-2xl transition-all shadow-sm bg-indigo-50 border-indigo-200">
                <div className="flex justify-between items-start mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getDayColor(entry.day)}`}>
                    {entry.day} • P{entry.period}
                  </span>
                  <span className="bg-indigo-100 text-indigo-700 font-bold text-[10px] px-2 py-1 rounded">MAKEUP</span>
                </div>

                <h3 className="font-black text-xl mb-1 text-slate-800">
                  {entry.courseId?.courseCode} - {entry.sectionId}
                </h3>
                <p className="text-sm font-semibold text-slate-500 mb-2">{entry.roomId?.roomId} | {entry.isLab ? 'Laboratory' : 'Theory'}</p>
                <p className="text-xs text-indigo-700 font-semibold">
                  This rescheduled class is already live for admin and students.
                </p>
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
                      {scheduleDays.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                 </div>
                 
                 <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Select Period</label>
                    <select required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={makeupForm.newPeriod} onChange={e => setMakeupForm({...makeupForm, newPeriod: parseInt(e.target.value)})}>
                      {schedulePeriods.map(p => <option key={p} value={p} disabled={breakPeriods.has(p)}>Period {p}{breakPeriods.has(p) ? ' (Break)' : ''}</option>)}
                    </select>
                 </div>

                 <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Select Available Room</label>
                    <select required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={makeupForm.newRoomId} onChange={e => setMakeupForm({...makeupForm, newRoomId: e.target.value})}>
                      {selectedRoomOptions.map(r => <option key={r._id} value={r._id}>{r.roomId} (Cap: {r.capacity})</option>)}
                    </select>
                    <p className="text-xs text-slate-400 mt-2">
                      {selectedEntry?.isLab ? 'Only lab rooms are shown for lab reschedules.' : 'Only theory rooms are shown for theory reschedules.'}
                    </p>
                 </div>

                 <div className="pt-4 flex space-x-3">
                   <button type="button" onClick={() => setIsRescheduleOpen(false)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold">Cancel</button>
                   <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700">Check & Confirm</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {isExtraOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-amber-50">
                <h3 className="text-lg font-bold text-amber-900 flex items-center">
                   <RefreshCw size={18} className="mr-2" /> Schedule Extra Class
                </h3>
                <button onClick={() => setIsExtraOpen(false)} className="text-amber-400 hover:text-amber-600 font-bold">&times;</button>
              </div>

              <form onSubmit={submitExtraClass} className="p-6 space-y-4">
                 <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Select Day</label>
                    <select required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" value={extraForm.newDay} onChange={e => setExtraForm({...extraForm, newDay: e.target.value})}>
                      {scheduleDays.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <p className="text-xs text-slate-400 mt-2">Saturday is available as the soft extra scheduling day when needed.</p>
                 </div>

                 <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Select Period</label>
                    <select required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" value={extraForm.newPeriod} onChange={e => setExtraForm({...extraForm, newPeriod: parseInt(e.target.value)})}>
                      {schedulePeriods.map(p => <option key={p} value={p} disabled={breakPeriods.has(p)}>Period {p}{breakPeriods.has(p) ? ' (Break)' : ''}</option>)}
                    </select>
                 </div>

                 <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Select Available Room</label>
                    <select required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" value={extraForm.newRoomId} onChange={e => setExtraForm({...extraForm, newRoomId: e.target.value})}>
                      {selectedExtraRoomOptions.map(r => <option key={r._id} value={r._id}>{r.roomId} (Cap: {r.capacity})</option>)}
                    </select>
                    <p className="text-xs text-slate-400 mt-2">
                      {selectedEntry?.isLab ? 'Only lab rooms are shown for extra lab blocks.' : 'Only theory rooms are shown for extra classes.'}
                    </p>
                 </div>

                 <div className="pt-4 flex space-x-3">
                   <button type="button" onClick={() => setIsExtraOpen(false)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold">Cancel</button>
                   <button type="submit" className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-bold shadow-md hover:bg-amber-600">Check & Confirm</button>
                 </div>
              </form>
           </div>
        </div>
      )}

    </div>
  );
};

export default CancelMakeup;
