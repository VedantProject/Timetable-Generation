import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { CalendarDays, Save, CheckCircle, AlertCircle, RefreshCw, Loader2, ArrowRight } from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// --- Draggable Cell Component ---
const DraggableCell = ({ entry, onMove }) => {
  const [{ isDragging }, dragRef] = useDrag({
    type: 'CLASS_CELL',
    item: { entryId: entry._id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    })
  });

  return (
    <div 
      ref={dragRef} 
      className={`p-2 h-full w-full rounded-md shadow-sm border transition-all cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'} ${entry.isLab ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-200'}`}
    >
      <div className="text-xs font-bold whitespace-nowrap overflow-hidden text-ellipsis text-slate-800">
        {entry.courseId?.courseCode} - {entry.sectionId}
      </div>
      <div className="text-[10px] text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">
        {entry.roomId?.roomId} | {entry.facultyId?.name?.split(' ')[0]}
      </div>
      {entry.isLab && <div className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1 mt-1 rounded inline-block">LAB</div>}
    </div>
  );
};

// --- Droppable Slot Component ---
const DroppableSlot = ({ day, period, entries, onMove }) => {
  const [{ isOver }, dropRef] = useDrop({
    accept: 'CLASS_CELL',
    drop: (item) => onMove(item.entryId, day, period),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    })
  });

  return (
    <td 
      ref={dropRef} 
      className={`border border-slate-200 h-20 min-w-[120px] max-w-[150px] p-1 align-top transition-colors ${isOver ? 'bg-indigo-100/50 outline outline-2 outline-indigo-400 outline-offset-[-2px]' : 'bg-white hover:bg-slate-50'}`}
    >
      <div className="flex flex-col gap-1 h-full">
        {entries.map(e => <DraggableCell key={e._id} entry={e} onMove={onMove} />)}
      </div>
    </td>
  );
};

const Timetable = () => {
  const [semester, setSemester] = useState('Fall 2024');
  const [department, setDepartment] = useState('CSE');
  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [progressLog, setProgressLog] = useState("");

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/timetable/${semester}`);
      setTimetable(data);
    } catch (error) {
      setTimetable(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, [semester]);

  // Polling hook
  useEffect(() => {
    let interval;
    if (jobId && generating) {
      interval = setInterval(async () => {
        try {
          const { data } = await api.get(`/admin/timetable/generate/status/${jobId}`);
          if (data.status === 'completed') {
            setGenerating(false);
            setJobId(null);
            setProgressLog("Success! Timetable generated.");
            fetchTimetable();
          } else if (data.status === 'failed') {
            setGenerating(false);
            setJobId(null);
            setProgressLog(`Generation Failed: ${data.error}`);
            alert(`Generation Failed: ${data.error}`);
          } else {
            setProgressLog("Running graph coloring algorithm and allocating blocks... Please wait.");
          }
        } catch (e) {
          console.error(e);
        }
      }, 2000); // poll every 2s
    }
    return () => clearInterval(interval);
  }, [jobId, generating]);

  const handleGenerate = async () => {
    try {
      const { data } = await api.post('/admin/timetable/generate', { semester, department });
      setJobId(data.jobId);
      setGenerating(true);
      setProgressLog("Starting worker thread...");
    } catch (error) {
      alert(error.response?.data?.message || "Failed to start generation");
    }
  };

  const handlePublish = async () => {
    try {
      if(!window.confirm("Publishing will lock faculty preferences and make the timetable visible to students. Continue?")) return;
      await api.patch(`/admin/timetable/${semester}/publish`);
      alert("Timetable Published Successfully!");
      fetchTimetable();
    } catch (error) {
      alert("Failed to publish timetable.");
    }
  };

  const handleMove = async (entryId, newDay, newPeriod) => {
    try {
      // Find current entry room so we don't throw an error if no room changed, just assuming moving to same room at different time for now
      // In a real app we'd open a modal to select a new room. For simple Drag Drop, we keep the same Room and just move the time.
      const entry = timetable.entries.find(e => e._id === entryId);
      if(!entry) return;

      await api.patch(`/admin/timetable/entry/${entryId}/move`, {
        newDay,
        newPeriod,
        newRoomId: entry.roomId._id
      });
      // success, fetch again or update optimistically
      fetchTimetable();
    } catch (error) {
      alert(`Conflict Detected:\n${error.response?.data?.details || "Unknown conflict"}`);
    }
  };

  // Build grid map
  const periods = [1, 2, 3, 4, 5, 6, 7, 8];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-6 animate-fade-in-up flex flex-col h-full">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Timetable Generator</h2>
            <p className="text-slate-500 mt-1">Initialize AI-driven generation and perform manual conflict overrides via drag-and-drop.</p>
          </div>
          <div className="flex space-x-3 items-center">
            {timetable && timetable.status === 'draft' && (
              <button onClick={handlePublish} className="flex items-center px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold rounded-xl transition-all shadow-sm">
                <CheckCircle size={18} className="mr-2" /> Publish System
              </button>
            )}
            <button 
              onClick={handleGenerate} 
              disabled={generating}
              className="flex items-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
            >
              {generating ? <Loader2 size={18} className="mr-2 animate-spin" /> : <RefreshCw size={18} className="mr-2" />}
              {generating ? 'Processing...' : 'Generate New Timetable'}
            </button>
          </div>
        </div>

        {/* Polling StatusBar */}
        {generating && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl flex items-center shadow-sm flex-shrink-0">
            <Loader2 className="animate-spin text-blue-500 mr-4" size={24} />
            <div>
              <h4 className="font-bold text-blue-800">Generation Algorithm Active</h4>
              <p className="text-blue-600 text-sm">{progressLog}</p>
            </div>
          </div>
        )}

        {/* Grid View */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col min-h-[500px]">
          {loading ? (
            <div className="flex-1 flex justify-center items-center text-indigo-500"><Loader2 className="animate-spin" size={32}/></div>
          ) : !timetable ? (
             <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
               <CalendarDays size={64} className="mb-4 opacity-50" />
               <h3 className="text-xl font-bold text-slate-600 mb-2">No Timetable Generated</h3>
               <p className="text-center max-w-sm">There is no saved timetable for {semester}. Please generate it using the algorithm button above.</p>
             </div>
          ) : (
            <>
              <div className="p-4 border-b flex justify-between bg-slate-50 items-center">
                 <div className="flex items-center space-x-2">
                   <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${timetable.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                     {timetable.status}
                   </span>
                   <span className="text-sm font-semibold text-slate-600">ID: {timetable._id}</span>
                 </div>
                 <div className="text-sm text-slate-500 font-medium">Use drag and drop to manually override any class placement.</div>
              </div>
              <div className="overflow-x-auto overflow-y-auto flex-1 p-4 bg-slate-50/50">
                <table className="w-full text-left border-collapse bg-white shadow-sm ring-1 ring-slate-200">
                  <thead className="bg-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="border border-slate-200 p-3 text-slate-600 font-bold uppercase text-xs w-24">Day / Period</th>
                      {periods.map(p => (
                        <th key={p} className="border border-slate-200 p-3 text-center text-slate-600 font-bold uppercase text-xs">Period {p}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(day => (
                      <tr key={day}>
                        <td className="border border-slate-200 p-3 font-semibold text-slate-700 bg-slate-50 relative">
                          <span className="sticky left-0">{day}</span>
                        </td>
                        {periods.map(period => {
                          const entries = timetable.entries.filter(e => e.day === day && e.period === period);
                          return <DroppableSlot key={`${day}-${period}`} day={day} period={period} entries={entries} onMove={handleMove} />
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
    </DndProvider>
  );
};

export default Timetable;
