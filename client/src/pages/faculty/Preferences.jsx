import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Save, Loader2, Info } from 'lucide-react';

const Preferences = () => {
  const [semester, setSemester] = useState('Fall 2024');
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState({
    maxWeeklyHours: 40,
    unavailableSlots: [],
    preferredSlots: [],
    isLocked: false
  });

  const fetchPreferences = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/faculty/preferences/${semester}`);
      if (data && Object.keys(data).length > 0) {
        setPreferences({
          maxWeeklyHours: data.maxWeeklyHours || 40,
          unavailableSlots: data.unavailableSlots || [],
          preferredSlots: data.preferredSlots || [],
          isLocked: data.isLocked || false
        });
      } else {
        // Reset defaults if none
        setPreferences({ maxWeeklyHours: 40, unavailableSlots: [], preferredSlots: [], isLocked: false });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, [semester]);

  const handleSlotClick = (day, period) => {
    if (preferences.isLocked) return;

    const isUnavailable = preferences.unavailableSlots.find(s => s.day === day && s.period === period);
    const isPreferred = preferences.preferredSlots.find(s => s.day === day && s.period === period);

    let newUnavailable = [...preferences.unavailableSlots];
    let newPreferred = [...preferences.preferredSlots];

    // State machine: White (none) -> Yellow (Preferred) -> Red (Unavailable) -> White (none)
    if (!isUnavailable && !isPreferred) {
      // White -> Yellow
      newPreferred.push({ day, period });
    } else if (isPreferred) {
      // Yellow -> Red
      newPreferred = newPreferred.filter(s => !(s.day === day && s.period === period));
      newUnavailable.push({ day, period });
    } else if (isUnavailable) {
      // Red -> White
      newUnavailable = newUnavailable.filter(s => !(s.day === day && s.period === period));
    }

    setPreferences(prev => ({
      ...prev,
      unavailableSlots: newUnavailable,
      preferredSlots: newPreferred
    }));
  };

  const handleSave = async () => {
    try {
      await api.post('/faculty/preferences', { semester, ...preferences });
      alert("Preferences saved successfully!");
    } catch (error) {
      alert(error.response?.data?.message || "Failed to save preferences.");
    }
  };

  const getSlotColor = (day, period) => {
    if (preferences.unavailableSlots.find(s => s.day === day && s.period === period)) return "bg-rose-500 hover:bg-rose-600 outline-rose-700";
    if (preferences.preferredSlots.find(s => s.day === day && s.period === period)) return "bg-amber-400 hover:bg-amber-500 outline-amber-600";
    return "bg-slate-100 hover:bg-slate-200 outline-slate-300";
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periods = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">My Preferences</h2>
          <p className="text-slate-500 mt-1">Submit your availability before the administrative deadline.</p>
        </div>
        <div className="flex items-center space-x-4">
          <select value={semester} onChange={e => setSemester(e.target.value)} className="px-4 py-2 border rounded-xl outline-none font-semibold">
            <option value="Fall 2024">Fall 2024</option>
            <option value="Spring 2025">Spring 2025</option>
          </select>
          <button 
            disabled={preferences.isLocked}
            onClick={handleSave} 
            className="flex items-center px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
          >
            <Save size={18} className="mr-2" />
            {preferences.isLocked ? 'Locked' : 'Save Constraints'}
          </button>
        </div>
      </div>

      {preferences.isLocked && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center text-rose-700">
          <Info className="mr-3" />
          <p className="font-semibold">The preference portal is locked for {semester}. Please contact your administrator for any changes.</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row gap-8">
        
        <div className="flex-1 overflow-x-auto">
          <h3 className="font-bold text-lg mb-4 text-slate-800">Weekly Availability Matrix</h3>
          {loading ? (
             <div className="flex justify-center py-20 text-emerald-500"><Loader2 className="animate-spin" size={32}/></div>
          ) : (
            <table className="w-full text-center border-collapse table-fixed min-w-[600px]">
              <thead>
                <tr>
                  <th className="p-2 border-b-2 text-slate-500 uppercase text-xs w-24">Day</th>
                  {periods.map(p => <th key={p} className="p-2 border-b-2 text-slate-500 uppercase text-xs">P{p}</th>)}
                </tr>
              </thead>
              <tbody>
                {days.map(day => (
                  <tr key={day}>
                    <td className="p-2 font-bold text-slate-600 text-sm">{day}</td>
                    {periods.map(period => (
                      <td key={period} className="p-1">
                        <button 
                          onClick={() => handleSlotClick(day, period)}
                          disabled={preferences.isLocked}
                          className={`w-full h-12 rounded-lg transition-all outline outline-1 outline-offset-[-1px] shadow-sm ${getSlotColor(day, period)} ${preferences.isLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                        ></button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="w-full md:w-64 space-y-6">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
            <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wider">Legend</h4>
            <div className="space-y-3">
              <div className="flex items-center"><div className="w-4 h-4 bg-slate-100 border border-slate-300 rounded mr-3"></div><span className="text-sm font-medium text-slate-600">Available</span></div>
              <div className="flex items-center"><div className="w-4 h-4 bg-amber-400 rounded mr-3"></div><span className="text-sm font-medium text-slate-600">Preferred</span></div>
              <div className="flex items-center"><div className="w-4 h-4 bg-rose-500 rounded mr-3"></div><span className="text-sm font-medium text-slate-600">Unavailable</span></div>
            </div>
            <p className="text-xs text-slate-400 mt-4 leading-relaxed">Click grid slots to cycle through states.</p>
          </div>

          <div>
             <label className="block text-sm font-bold text-slate-700 mb-2">Max Weekly Teaching Hours</label>
             <input type="number" min="0" disabled={preferences.isLocked} value={preferences.maxWeeklyHours} onChange={e => setPreferences({...preferences, maxWeeklyHours: parseInt(e.target.value)})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-lg text-slate-800 disabled:bg-slate-100" />
          </div>
        </div>

      </div>
    </div>
  );
};

export default Preferences;
