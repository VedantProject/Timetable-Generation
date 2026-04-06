import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { CalendarDays, Loader2, MapPin } from 'lucide-react';

const CLASS_OPTIONS = [
  { value: '2-A', label: '2nd Sec A', year: 2, sectionId: 'A' },
  { value: '2-B', label: '2nd Sec B', year: 2, sectionId: 'B' },
  { value: '3-A', label: '3rd Sec A', year: 3, sectionId: 'A' },
  { value: '3-B', label: '3rd Sec B', year: 3, sectionId: 'B' },
];

const StudentSchedule = () => {
  const [semester, setSemester] = useState('Fall 2024');
  const [selectedClass, setSelectedClass] = useState('2-A');
  const [loading, setLoading] = useState(true);
  const [timetable, setTimetable] = useState(null);

  useEffect(() => {
    const fetchTimetable = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/timetable/${semester}`);
        // Students should only see published timetables
        if (data && data.status === 'published') {
          setTimetable(data);
        } else {
          setTimetable(null);
        }
      } catch (error) {
        setTimetable(null);
      } finally {
        setLoading(false);
      }
    };
    fetchTimetable();
  }, [semester]);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periods = [1, 2, 3, 4, 5, 6, 7, 8];
  const activeClass = CLASS_OPTIONS.find(option => option.value === selectedClass) || CLASS_OPTIONS[0];
  const visibleEntries = timetable?.entries?.filter(entry =>
    entry.year === activeClass.year && entry.sectionId === activeClass.sectionId
  ) || [];

  return (
    <div className="space-y-6 animate-fade-in-up flex flex-col h-full">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Class Schedule</h2>
          <p className="text-slate-500 mt-1">Review your weekly classes and lab blocks mapping.</p>
        </div>
        <div className="flex space-x-3">
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="px-4 py-2 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 focus:ring-2 focus:ring-amber-500 bg-amber-50">
            {CLASS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select value={semester} onChange={e => setSemester(e.target.value)} className="px-4 py-2 border border-slate-200 rounded-xl outline-none font-semibold focus:ring-2 focus:ring-amber-500 bg-slate-50">
            <option value="Fall 2024">Fall 2024</option>
            <option value="Spring 2025">Spring 2025</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col min-h-[500px]">
        {loading ? (
          <div className="flex-1 flex justify-center items-center text-amber-500"><Loader2 className="animate-spin" size={32}/></div>
        ) : !timetable ? (
           <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
             <CalendarDays size={64} className="mb-4 opacity-50" />
             <h3 className="text-xl font-bold text-slate-600 mb-2">Timetable Pending</h3>
             <p className="text-center">The timetable for {semester} has not been published yet.</p>
           </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto flex-1 p-4 bg-slate-50/50">
            <table className="w-full text-left border-collapse bg-white shadow-sm ring-1 ring-slate-200">
              <thead className="bg-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="border border-slate-200 p-3 text-slate-600 font-bold uppercase text-xs w-24">Day</th>
                  {periods.map(p => (
                    <th key={p} className="border border-slate-200 p-3 text-center text-slate-600 font-bold uppercase text-xs">P{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map(day => (
                  <tr key={day}>
                    <td className="border border-slate-200 p-3 font-semibold text-slate-700 bg-slate-50">
                      {day}
                    </td>
                    {periods.map(period => {
                      const entries = visibleEntries.filter(e => 
                        e.day === day && 
                        e.period === period
                      );

                      return (
                        <td key={`${day}-${period}`} className="border border-slate-200 h-24 min-w-[140px] max-w-[160px] p-2 align-top hover:bg-slate-50 transition-colors">
                          <div className="flex flex-col gap-2 h-full">
                            {entries.map(e => (
                              <div key={e._id} className={`p-3 h-full rounded-xl shadow-sm border flex flex-col ${
                                e.isCancelled 
                                ? 'bg-rose-50 border-rose-200 opacity-60' 
                                : e.isMakeup 
                                ? 'bg-purple-50 border-purple-200' 
                                : e.isLab 
                                ? 'bg-amber-50 border-amber-200' 
                                : 'bg-white border-slate-200 relative overflow-hidden'
                              }`}>
                                {!e.isLab && !e.isCancelled && !e.isMakeup && (
                                  <div className="absolute top-0 right-0 w-1 h-full bg-indigo-400"></div>
                                )}
                                
                                <div className="flex justify-between items-start mb-1">
                                  <span className={`text-sm font-black ${e.isCancelled ? 'line-through text-rose-700' : 'text-slate-800'}`}>
                                    {e.courseId?.courseCode}
                                  </span>
                                </div>
                                <p className={`text-xs font-semibold truncate ${e.isCancelled ? 'text-rose-600' : 'text-slate-500'}`}>
                                  {e.facultyId?.name?.split(' ')[0]}
                                </p>
                                
                                <div className="mt-auto space-y-1">
                                  <div className="flex items-center text-xs text-slate-600 font-medium">
                                    <MapPin size={12} className="mr-1 opacity-70"/> {e.roomId?.roomId}
                                  </div>
                                </div>

                                {e.isCancelled && <div className="mt-1 text-[10px] font-bold text-rose-600">CLASS CANCELED</div>}
                                {e.isMakeup && <div className="mt-1 text-[10px] font-bold text-purple-600">📌 MAKEUP</div>}
                                {e.isLab && !e.isCancelled && !e.isMakeup && <div className="mt-1 text-[10px] font-bold text-amber-600">🧪 LAB</div>}
                              </div>
                            ))}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default StudentSchedule;
