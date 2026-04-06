import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { CalendarDays, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';

// ── Period labels (based on constraints, with break indicator) ───────────────
const DEFAULT_DAYS    = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DEFAULT_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
const BREAK_PERIODS   = new Set([4]); // matches DB constraint

// ── Helpers ──────────────────────────────────────────────────────────────────
const getEntries = (timetable, day, period, sectionId) => {
  if (!timetable?.entries) return [];
  return timetable.entries.filter(
    e => e.day === day && e.period === period && e.sectionId === sectionId
  );
};

// Extract unique sections from timetable entries, sorted by year then name
const getSections = (timetable) => {
  if (!timetable?.entries?.length) return [];
  const raw = [...new Set(timetable.entries.map(e => e.sectionId))];
  return raw.sort();
};

// ── Section timetable grid ───────────────────────────────────────────────────
const SectionGrid = ({ timetable, sectionId }) => {
  const periods = DEFAULT_PERIODS;
  const days    = DEFAULT_DAYS;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-sm">
        <thead className="bg-slate-100 sticky top-0 z-10">
          <tr>
            <th className="border border-slate-200 p-3 text-slate-600 font-bold text-xs uppercase w-24">
              Day / Period
            </th>
            {periods.map(p => (
              <th key={p} className={`border border-slate-200 p-2 text-center text-xs font-bold uppercase w-28 ${BREAK_PERIODS.has(p) ? 'bg-orange-50 text-orange-600' : 'text-slate-600'}`}>
                {BREAK_PERIODS.has(p) ? `P${p} [Break]` : `P${p}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map(day => (
            <tr key={day}>
              <td className="border border-slate-200 p-3 font-semibold text-slate-700 bg-slate-50 text-xs whitespace-nowrap">
                {day}
              </td>
              {periods.map(period => {
                if (BREAK_PERIODS.has(period)) {
                  return (
                    <td key={period} className="border border-slate-200 bg-orange-50 text-center">
                      <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-wide">Break</span>
                    </td>
                  );
                }

                const entries = getEntries(timetable, day, period, sectionId);

                if (entries.length === 0) {
                  return (
                    <td key={period} className="border border-slate-200 bg-slate-50/50 h-16 text-center align-middle">
                      <span className="text-[10px] text-slate-300 font-medium">FREE</span>
                    </td>
                  );
                }

                // Render each entry in the slot (should normally be just one)
                return (
                  <td key={period} className="border border-slate-200 h-16 p-1 align-top">
                    {entries.map((e, i) => (
                      <div
                        key={e._id || i}
                        className={`p-1.5 rounded-md h-full flex flex-col justify-between text-left ${
                          e.isLab
                            ? 'bg-amber-50 border border-amber-200'
                            : 'bg-indigo-50 border border-indigo-200'
                        }`}
                      >
                        <div className="text-[11px] font-bold text-slate-800 leading-tight truncate">
                          {e.courseId?.courseCode || e.courseId || '—'}
                          {e.isLab && (
                            <span className="ml-1 text-[9px] font-bold text-amber-600 bg-amber-100 px-1 rounded">
                              LAB {e.labBlock ? `[${e.labBlock}]` : ''}
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-500 truncate">
                          {e.facultyId?.name || '—'}
                        </div>
                        <div className="text-[9px] font-semibold text-slate-600 bg-slate-100 rounded px-1 inline-block w-fit">
                          {e.roomId?.roomId || '—'}
                        </div>
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Main Timetable page ───────────────────────────────────────────────────────
const Timetable = () => {
  const [semester,    setSemester]    = useState('Fall 2024');
  const [department,  setDepartment]  = useState('CSE');
  const [timetable,   setTimetable]   = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [generating,  setGenerating]  = useState(false);
  const [jobId,       setJobId]       = useState(null);
  const [progressLog, setProgressLog] = useState('');
  const [activeTab,   setActiveTab]   = useState(null);

  // ── Fetch timetable ─────────────────────────────────────────────────────
  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/timetable/${semester}`);
      setTimetable(data);
      const sections = getSections(data);
      if (sections.length && !activeTab) setActiveTab(sections[0]);
    } catch {
      setTimetable(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTimetable(); }, [semester]);

  // ── Polling ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId || !generating) return;
    const iv = setInterval(async () => {
      try {
        const { data } = await api.get(`/admin/timetable/generate/status/${jobId}`);
        if (data.status === 'completed') {
          setGenerating(false); setJobId(null);
          setProgressLog('✅ Timetable generated successfully!');
          fetchTimetable();
        } else if (data.status === 'failed') {
          setGenerating(false); setJobId(null);
          setProgressLog(`❌ Generation Failed: ${data.error}`);
          alert(`Generation Failed:\n${data.error}`);
        } else {
          setProgressLog(data.progress || 'Algorithm running — allocating classes...');
        }
      } catch (e) { console.error(e); }
    }, 2000);
    return () => clearInterval(iv);
  }, [jobId, generating]);

  // ── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    try {
      setProgressLog('Starting generation...');
      const { data } = await api.post('/admin/timetable/generate', { semester, department });
      setJobId(data.jobId);
      setGenerating(true);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to start generation');
    }
  };

  // ── Publish ───────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!window.confirm('Publishing will make the timetable visible to students. Continue?')) return;
    try {
      await api.patch(`/admin/timetable/${semester}/publish`);
      alert('Timetable Published!');
      fetchTimetable();
    } catch { alert('Failed to publish.'); }
  };

  const sections = getSections(timetable);
  const currentTab = activeTab || sections[0];

  // Stats panel
  const totalEntries = timetable?.entries?.length || 0;
  const theoryCount  = timetable?.entries?.filter(e => !e.isLab).length || 0;
  const labCount     = timetable?.entries?.filter(e =>  e.isLab).length || 0;

  return (
    <div className="space-y-5 animate-fade-in-up flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100 gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Timetable Generator</h2>
          <p className="text-slate-500 text-sm mt-1">
            Constraint-based scheduling — one timetable per section, zero conflicts.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={semester}
            onChange={e => setSemester(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="Fall 2024">Fall 2024</option>
            <option value="Spring 2025">Spring 2025</option>
          </select>
          {timetable?.status === 'draft' && (
            <button
              onClick={handlePublish}
              className="flex items-center px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold rounded-xl transition-all"
            >
              <CheckCircle size={16} className="mr-2" /> Publish
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl shadow transition-all active:scale-95"
          >
            {generating
              ? <><Loader2 size={16} className="mr-2 animate-spin" /> Processing...</>
              : <><RefreshCw size={16} className="mr-2" /> Generate Timetable</>}
          </button>
        </div>
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────── */}
      {(generating || progressLog) && (
        <div className={`border-l-4 p-4 rounded-r-xl flex items-start gap-3 ${
          progressLog.startsWith('❌') ? 'bg-red-50 border-red-500' :
          progressLog.startsWith('✅') ? 'bg-green-50 border-green-500' :
          'bg-blue-50 border-blue-500'
        }`}>
          {generating && <Loader2 className="animate-spin text-blue-500 mt-0.5 flex-shrink-0" size={20} />}
          <div>
            <p className="text-sm font-semibold text-slate-700">{progressLog}</p>
            {generating && (
              <p className="text-xs text-slate-500 mt-1">Solving constraints per section — this may take a few seconds...</p>
            )}
          </div>
        </div>
      )}

      {/* ── Main grid area ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-[500px] overflow-hidden">
        {loading ? (
          <div className="flex-1 flex justify-center items-center text-indigo-500">
            <Loader2 className="animate-spin" size={36} />
          </div>
        ) : !timetable ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
            <CalendarDays size={64} className="mb-4 opacity-40" />
            <h3 className="text-xl font-bold text-slate-600 mb-2">No Timetable Found</h3>
            <p className="text-center max-w-sm text-sm">
              No timetable exists for <strong>{semester}</strong>. Click <em>Generate Timetable</em> above to create one.
            </p>
          </div>
        ) : (
          <>
            {/* Status + Stats bar */}
            <div className="p-4 border-b bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                  timetable.status === 'published'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {timetable.status}
                </span>
                <span className="text-xs text-slate-500">
                  {totalEntries} total slots &nbsp;·&nbsp;
                  {theoryCount} theory &nbsp;·&nbsp;
                  {labCount} lab periods &nbsp;·&nbsp;
                  {sections.length} sections
                </span>
              </div>
              <span className="text-xs text-slate-400">
                Generated: {new Date(timetable.generatedAt || timetable.createdAt).toLocaleString()}
              </span>
            </div>

            {/* Section tabs */}
            {sections.length > 0 ? (
              <>
                <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-slate-100 flex-wrap">
                  {sections.map(sec => (
                    <button
                      key={sec}
                      onClick={() => setActiveTab(sec)}
                      className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-all ${
                        currentTab === sec
                          ? 'border-indigo-600 text-indigo-700 bg-indigo-50'
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Section {sec}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-auto p-4">
                  {currentTab && (
                    <SectionGrid timetable={timetable} sectionId={currentTab} />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <p>Timetable exists but has no entries. Try regenerating.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Timetable;
