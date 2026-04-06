import React, { useState, useEffect, useContext } from 'react';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { CalendarDays, Loader2, MapPin, Clock } from 'lucide-react';

const FacultySchedule = () => {
  const { user } = useContext(AuthContext);
  const [semester, setSemester] = useState('Fall 2024');
  const [loading, setLoading] = useState(true);
  const [timetable, setTimetable] = useState(null);

  useEffect(() => {
    const fetchTimetable = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/admin/timetable/${semester}`);
        // Only show if published, or if we allow faculty to see drafts? 
        // Prompt says "Student – Read-only view... of published" 
        // "Faculty - Schedule view". Usually they can see drafts to review. Let's allow it but label it.
        setTimetable(data);
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

  return (
    <div className="space-y-6 animate-fade-in-up flex flex-col h-full">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">My Schedule</h2>
          <p className="text-slate-500 mt-1">Review your mapped classes and laboratory sessions.</p>
        </div>
        <select value={semester} onChange={e => setSemester(e.target.value)} className="px-4 py-2 border rounded-xl outline-none font-semibold focus:ring-2 focus:ring-emerald-500 bg-slate-50">
          <option value="Fall 2024">Fall 2024</option>
          <option value="Spring 2025">Spring 2025</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col min-h-[500px]">
        {loading ? (
          <div className="flex-1 flex justify-center items-center text-emerald-500"><Loader2 className="animate-spin" size={32}/></div>
        ) : !timetable ? (
           <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
             <CalendarDays size={64} className="mb-4 opacity-50" />
             <h3 className="text-xl font-bold text-slate-600 mb-2">No Timetable Available</h3>
             <p className="text-center">The timetable for {semester} has not been published yet.</p>
           </div>
        ) : (
          <>
            {timetable.status === 'draft' && (
              <div className="bg-amber-50 text-amber-700 p-3 text-center text-sm font-bold border-b border-amber-200">
                Notice: This timetable is currently a DRAFT. Changes may occur before publication.
              </div>
            )}
            
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
                        // Filter entries that belong to this faculty
                        const entries = timetable.entries.filter(e => 
                          e.day === day && 
                          e.period === period && 
                          e.facultyId?._id === user._id
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
                                  : 'bg-emerald-50 border-emerald-200'
                                }`}>
                                  <div className="flex justify-between items-start mb-1">
                                    <span className={`text-sm font-black ${e.isCancelled ? 'line-through text-rose-700' : 'text-slate-800'}`}>
                                      {e.courseId?.courseCode}
                                    </span>
                                    <span className="text-[10px] bg-white px-2 py-0.5 rounded-md font-bold shadow-sm border border-slate-100 text-slate-600">
                                      Sec {e.sectionId}
                                    </span>
                                  </div>
                                  
                                  <div className="mt-auto space-y-1">
                                    <div className="flex items-center text-xs text-slate-600 font-medium">
                                      <MapPin size={12} className="mr-1 opacity-70"/> {e.roomId?.roomId}
                                    </div>
                                    <div className="flex items-center text-xs text-slate-500">
                                       <Clock size={12} className="mr-1 opacity-70"/> Period {e.period}
                                    </div>
                                  </div>

                                  {e.isCancelled && <div className="mt-1 text-[10px] font-bold text-rose-600">❌ CANCELLED</div>}
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
          </>
        )}
      </div>

    </div>
  );
};

export default FacultySchedule;
