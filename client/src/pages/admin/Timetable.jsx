import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { CalendarDays, CheckCircle, RefreshCw, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS         = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS      = [1, 2, 3, 4, 5, 6, 7, 8];
const BREAK_PERIODS = new Set([4]);

// ── Entry lookup helper ──────────────────────────────────────────────────────
const getSlotEntries = (entries, day, period, year, sectionId) =>
  entries.filter(
    e => e.day === day && e.period === period && e.year === year && e.sectionId === sectionId
  );

// ── Section grid (one per year+section combo) ────────────────────────────────
const SectionGrid = ({ entries, year, sectionId }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200">
    <table className="w-full text-left border-collapse text-xs">
      <thead className="bg-slate-100 sticky top-0 z-10">
        <tr>
          <th className="border border-slate-200 p-2 text-slate-500 font-bold uppercase text-[10px] w-20">
            Day / Period
          </th>
          {PERIODS.map(p => (
            <th
              key={p}
              className={`border border-slate-200 p-2 text-center font-bold uppercase text-[10px] w-28 ${
                BREAK_PERIODS.has(p)
                  ? 'bg-orange-50 text-orange-500'
                  : 'text-slate-500'
              }`}
            >
              {BREAK_PERIODS.has(p) ? `P${p} ☕` : `P${p}`}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {DAYS.map(day => (
          <tr key={day}>
            <td className="border border-slate-200 p-2 font-semibold text-slate-600 bg-slate-50 text-[10px] whitespace-nowrap">
              {day.slice(0, 3)}
            </td>
            {PERIODS.map(period => {
              if (BREAK_PERIODS.has(period)) {
                return (
                  <td key={period} className="border border-slate-200 bg-orange-50 text-center p-1">
                    <span className="text-[9px] text-orange-300 font-semibold">BREAK</span>
                  </td>
                );
              }

              const slotEntries = getSlotEntries(entries, day, period, year, sectionId);

              if (slotEntries.length === 0) {
                return (
                  <td key={period} className="border border-slate-200 bg-slate-50/50 h-14 text-center align-middle">
                    <span className="text-[9px] text-slate-300 font-medium">FREE</span>
                  </td>
                );
              }

              return (
                <td key={period} className="border border-slate-200 h-14 p-0.5 align-top">
                  {slotEntries.map((e, i) => (
                    <div
                      key={e._id || i}
                      className={`p-1 rounded h-full flex flex-col justify-between ${
                        e.isLab
                          ? 'bg-amber-50 border border-amber-200'
                          : 'bg-indigo-50 border border-indigo-200'
                      }`}
                    >
                      <div className="font-bold text-[10px] text-slate-800 truncate leading-tight">
                        {e.courseId?.courseCode || '—'}
                        {e.isLab && (
                          <span className="ml-1 text-[8px] font-bold text-amber-600 bg-amber-100 px-0.5 rounded">
                            LAB
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-500 truncate">
                        {e.facultyId?.name?.split(' ').slice(0, 2).join(' ') || '—'}
                      </div>
                      <div className="text-[8px] font-bold text-slate-600 bg-white/70 rounded px-0.5 inline-block">
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

// ── Collapsible year group ────────────────────────────────────────────────────
const YearGroup = ({ year, sections, entries }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Year header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:from-indigo-700 hover:to-indigo-600 transition-all"
      >
        <div className="flex items-center gap-3">
          <CalendarDays size={20} />
          <span className="text-lg font-bold tracking-wide">
            {year === 2 ? '2nd' : year === 3 ? '3rd' : `${year}th`} Year — CSE
          </span>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
            {sections.length} section{sections.length !== 1 ? 's' : ''}
          </span>
        </div>
        {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </button>

      {!collapsed && (
        <div className="divide-y divide-slate-100">
          {sections.map(sectionId => {
            const secEntries = entries.filter(e => e.year === year && e.sectionId === sectionId);
            const theoryCount = secEntries.filter(e => !e.isLab).length;
            const labCount    = secEntries.filter(e =>  e.isLab).length;

            return (
              <div key={sectionId} className="p-5">
                {/* Section header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
                      CSE — {sectionId}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {theoryCount} theory · {labCount} lab periods · {secEntries.length} total slots
                  </span>
                </div>

                <SectionGrid
                  entries={secEntries}
                  year={year}
                  sectionId={sectionId}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Main Timetable page ───────────────────────────────────────────────────────
const Timetable = () => {
  const [semester,    setSemester]    = useState('Fall 2024');
  const [department,  ]               = useState('CSE');
  const [timetable,   setTimetable]   = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [generating,  setGenerating]  = useState(false);
  const [jobId,       setJobId]       = useState(null);
  const [progressLog, setProgressLog] = useState('');

  // ── Fetch ───────────────────────────────────────────────────────────────
  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/timetable/${semester}`);
      setTimetable(data);
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
          setProgressLog(`✅ ${data.result || 'Timetable generated successfully!'}`);
          fetchTimetable();
        } else if (data.status === 'failed') {
          setGenerating(false); setJobId(null);
          setProgressLog(`❌ Generation Failed: ${data.error}`);
          alert(`Generation Failed:\n\n${data.error}`);
        } else {
          setProgressLog(data.progress || 'Algorithm running — solving constraints per section...');
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
    if (!window.confirm('Publish will lock preferences and show the timetable to students. Continue?')) return;
    try {
      await api.patch(`/admin/timetable/${semester}/publish`);
      alert('Published!');
      fetchTimetable();
    } catch { alert('Failed to publish.'); }
  };

  // ── Derive structured data from flat entries ────────────────────────────
  const entries = timetable?.entries || [];

  // Build: { year → [sectionId, ...] }
  const yearSectionMap = {};
  entries.forEach(e => {
    const y = e.year;
    const s = e.sectionId;
    if (y == null) return;
    if (!yearSectionMap[y]) yearSectionMap[y] = new Set();
    yearSectionMap[y].add(s);
  });

  const years = Object.keys(yearSectionMap)
    .map(Number)
    .sort((a, b) => a - b);

  const totalEntries = entries.length;
  const theoryCount  = entries.filter(e => !e.isLab).length;
  const labCount     = entries.filter(e =>  e.isLab).length;

  return (
    <div className="space-y-5 animate-fade-in-up flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100 gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Timetable Generator</h2>
          <p className="text-slate-500 text-sm mt-1">
            4 independent timetables: CSE 2A · CSE 2B · CSE 3A · CSE 3B — zero conflicts guaranteed.
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
              ? <><Loader2 size={16} className="mr-2 animate-spin" />Processing...</>
              : <><RefreshCw size={16} className="mr-2" />Generate Timetable</>}
          </button>
        </div>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      {(generating || progressLog) && (
        <div className={`border-l-4 p-4 rounded-r-xl flex items-start gap-3 ${
          progressLog.startsWith('❌') ? 'bg-red-50 border-red-400' :
          progressLog.startsWith('✅') ? 'bg-green-50 border-green-400' :
          'bg-blue-50 border-blue-400'
        }`}>
          {generating && <Loader2 className="animate-spin text-blue-500 mt-0.5 flex-shrink-0" size={18} />}
          <div>
            <p className="text-sm font-semibold text-slate-700">{progressLog}</p>
            {generating && (
              <p className="text-xs text-slate-400 mt-1">
                Solving constraints section by section — shared faculty conflicts are handled globally...
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex justify-center items-center py-20 text-indigo-500">
          <Loader2 className="animate-spin" size={40} />
        </div>
      ) : !timetable ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-100">
          <CalendarDays size={64} className="mb-4 opacity-40" />
          <h3 className="text-xl font-bold text-slate-600 mb-2">No Timetable Found</h3>
          <p className="text-sm text-center max-w-sm">
            No timetable exists for <strong>{semester}</strong>.<br />
            Click <em>Generate Timetable</em> to create one for all 4 sections.
          </p>
        </div>
      ) : years.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-100">
          <CalendarDays size={48} className="mb-3 opacity-40" />
          <p className="text-slate-500 font-semibold">
            Timetable document exists but has 0 entries.
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Click <strong>Generate Timetable</strong> to regenerate.
          </p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="bg-white rounded-xl px-5 py-3 border border-slate-100 shadow-sm flex flex-wrap items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
              timetable.status === 'published'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {timetable.status}
            </span>
            <span className="text-xs text-slate-500">
              <strong>{totalEntries}</strong> total slots &nbsp;·&nbsp;
              <strong>{theoryCount}</strong> theory &nbsp;·&nbsp;
              <strong>{labCount}</strong> lab periods &nbsp;·&nbsp;
              <strong>{years.length}</strong> year{years.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
              <strong>{Object.values(yearSectionMap).reduce((a, s) => a + s.size, 0)}</strong> sections
            </span>
            <span className="ml-auto text-xs text-slate-400">
              Generated: {new Date(timetable.generatedAt || timetable.createdAt).toLocaleString()}
            </span>
          </div>

          {/* 4-section timetable display grouped by year */}
          <div className="space-y-5 pb-6">
            {years.map(year => (
              <YearGroup
                key={year}
                year={year}
                sections={[...yearSectionMap[year]].sort()}
                entries={entries}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Timetable;
