import React, { useState, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import api from '../../api/axios';
import {
  CalendarDays,
  CheckCircle,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Move,
} from 'lucide-react';

const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const RESCHEDULE_EXTRA_DAYS = ['Saturday'];
const DEFAULT_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
const DEFAULT_BREAK_PERIODS = [4];
const DRAG_TYPE = 'TIMETABLE_ENTRY';

const getSlotEntries = (entries, day, period, year, sectionId) =>
  entries.filter(
    (entry) =>
      entry.day === day &&
      Number(entry.period) === Number(period) &&
      Number(entry.year) === Number(year) &&
      entry.sectionId === sectionId
  );

const getEntryId = (entry) => entry?._id?.toString?.() || String(entry?._id || '');
const getCourseId = (entry) => entry?.courseId?._id?.toString?.() || String(entry?.courseId || '');
const getFacultyId = (entry) => entry?.facultyId?._id?.toString?.() || String(entry?.facultyId || '');
const getRoomId = (entry) => entry?.roomId?._id?.toString?.() || String(entry?.roomId || '');

const getLabBlockEntries = (entries, entry) => {
  const courseId = getCourseId(entry);

  return entries
    .filter(
      (candidate) =>
        candidate.isLab &&
        candidate.day === entry.day &&
        candidate.sectionId === entry.sectionId &&
        Number(candidate.year) === Number(entry.year) &&
        getCourseId(candidate) === courseId
    )
    .sort((a, b) => Number(a.period) - Number(b.period));
};

const getDragPayload = (entries, entry) => {
  const labEntries = entry.isLab ? getLabBlockEntries(entries, entry) : [entry];

  return {
    entryId: getEntryId(entry),
    courseId: getCourseId(entry),
    facultyId: getFacultyId(entry),
    roomId: getRoomId(entry),
    year: Number(entry.year),
    sectionId: entry.sectionId,
    day: entry.day,
    period: Number(entry.period),
    isLab: !!entry.isLab,
    duration: Math.max(labEntries.length, 1),
    moveEntryIds: labEntries.map((item) => getEntryId(item)),
  };
};

const getPreferenceMap = (preferences) =>
  preferences.reduce((accumulator, preference) => {
    const facultyId = preference?.facultyId?.toString?.() || String(preference?.facultyId || '');
    if (facultyId) {
      accumulator[facultyId] = preference;
    }
    return accumulator;
  }, {});

const hasCompatibleRoom = ({
  entries,
  dragItem,
  constraints,
  day,
  targetPeriods,
}) => {
  const rooms = (constraints?.rooms || []).filter((room) => !!room && !!room._id && !!room.roomId);
  const compatibleRooms = rooms.filter((room) => !!room.isLab === !!dragItem.isLab);

  return compatibleRooms.some((room) =>
    targetPeriods.every((targetPeriod) =>
      !entries.some(
        (entry) =>
          !entry.isCancelled &&
          !dragItem.moveEntryIds.includes(getEntryId(entry)) &&
          entry.day === day &&
          Number(entry.period) === targetPeriod &&
          getRoomId(entry) === String(room._id)
      )
    )
  );
};

const canDropInSlot = ({
  entries,
  dragItem,
  day,
  period,
  year,
  sectionId,
  breakPeriods,
  periodsPerDay,
  constraints,
  facultyPreferencesMap,
}) => {
  if (!dragItem) return false;
  if (dragItem.year !== Number(year) || dragItem.sectionId !== sectionId) return false;

  const targetPeriods = Array.from({ length: dragItem.duration }, (_, index) => period + index);
  if (targetPeriods.some((targetPeriod) => targetPeriod > periodsPerDay)) return false;
  if (targetPeriods.some((targetPeriod) => breakPeriods.has(targetPeriod))) return false;
  const validDays = constraints?.workingDays?.length
    ? [...constraints.workingDays, ...RESCHEDULE_EXTRA_DAYS]
    : [...DEFAULT_DAYS, ...RESCHEDULE_EXTRA_DAYS];
  if (!validDays.includes(day)) return false;

  const facultyPreference = facultyPreferencesMap[dragItem.facultyId];
  if (
    facultyPreference?.unavailableSlots?.some(
      (slot) => slot.day === day && targetPeriods.includes(Number(slot.period))
    )
  ) {
    return false;
  }

  const sectionStaysFree = targetPeriods.every((targetPeriod) => {
    const slotEntries = getSlotEntries(entries, day, targetPeriod, year, sectionId);
    return slotEntries.every((entry) => dragItem.moveEntryIds.includes(getEntryId(entry)));
  });

  if (!sectionStaysFree) return false;

  const facultyStaysFree = targetPeriods.every((targetPeriod) =>
    !entries.some(
      (entry) =>
        !entry.isCancelled &&
        !dragItem.moveEntryIds.includes(getEntryId(entry)) &&
        entry.day === day &&
        Number(entry.period) === targetPeriod &&
        getFacultyId(entry) === dragItem.facultyId
    )
  );

  if (!facultyStaysFree) return false;

  return hasCompatibleRoom({
    entries,
    dragItem,
    constraints,
    day,
    targetPeriods,
  });
};

const DraggableEntryCard = ({ entry, entries, isMoving }) => {
  const dragPayload = getDragPayload(entries, entry);
  const isLabContinuation = entry.isLab && Number(entry.labBlock) > 1;

  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: DRAG_TYPE,
      item: dragPayload,
      canDrag: !isMoving && !isLabContinuation && !entry.isCancelled,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [dragPayload, isMoving, isLabContinuation, entry.isCancelled]
  );

  return (
    <div
      ref={dragRef}
      className={`p-1 rounded h-full flex flex-col justify-between transition ${
        entry.isLab
          ? 'bg-amber-50 border border-amber-200'
          : 'bg-indigo-50 border border-indigo-200'
      } ${
        !isMoving && !isLabContinuation && !entry.isCancelled
          ? 'cursor-grab active:cursor-grabbing'
          : 'cursor-not-allowed'
      } ${isDragging ? 'opacity-40 scale-[0.98]' : 'opacity-100'}`}
      title={
        isLabContinuation
          ? 'Drag the first period of this lab block to move the full lab.'
          : entry.isCancelled
          ? 'Cancelled classes cannot be moved.'
          : 'Drag to a free slot in the same section.'
      }
    >
      <div className="font-bold text-[10px] text-slate-800 truncate leading-tight">
        {entry.courseId?.courseCode || '—'}
        {entry.isLab && (
          <span className="ml-1 text-[8px] font-bold text-amber-600 bg-amber-100 px-0.5 rounded">
            {isLabContinuation ? `LAB ${entry.labBlock}` : 'LAB'}
          </span>
        )}
        {entry.isMakeup && (
          <span className="ml-1 text-[8px] font-bold text-violet-700 bg-violet-100 px-0.5 rounded">
            MAKEUP
          </span>
        )}
        {entry.isExtraClass && (
          <span className="ml-1 text-[8px] font-bold text-amber-700 bg-amber-100 px-0.5 rounded">
            EXTRA
          </span>
        )}
        {entry.isCancelled && (
          <span className="ml-1 text-[8px] font-bold text-rose-700 bg-rose-100 px-0.5 rounded">
            CANCELED
          </span>
        )}
      </div>
      <div className="text-[9px] text-slate-500 truncate">
        {entry.facultyId?.name?.split(' ').slice(0, 2).join(' ') || '—'}
      </div>
      <div className="flex items-center justify-between gap-1">
        <div className="text-[8px] font-bold text-slate-600 bg-white/70 rounded px-0.5 inline-block">
          {entry.roomId?.roomId || '—'}
        </div>
        {!isLabContinuation && !entry.isCancelled && (
          <div className="text-[8px] text-slate-500 flex items-center gap-0.5">
            <Move size={9} />
            Drag
          </div>
        )}
      </div>
    </div>
  );
};

const SlotCell = ({
  day,
  period,
  year,
  sectionId,
  entries,
  breakPeriods,
  periodsPerDay,
  constraints,
  facultyPreferencesMap,
  isMoving,
  onMoveEntry,
}) => {
  const slotEntries = getSlotEntries(entries, day, period, year, sectionId);
  const isBreak = breakPeriods.has(period);
  const isFree = slotEntries.length === 0;

  const [{ isOver, canDrop }, dropRef] = useDrop(
    () => ({
      accept: DRAG_TYPE,
      canDrop: (dragItem) =>
        !isMoving &&
        !isBreak &&
        canDropInSlot({
          entries,
          dragItem,
          day,
          period,
          year,
          sectionId,
          breakPeriods,
          periodsPerDay,
          constraints,
          facultyPreferencesMap,
        }),
      drop: (dragItem) => {
        onMoveEntry(dragItem.entryId, { day, period, year, sectionId });
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
      }),
    }),
    [
      entries,
      day,
      period,
      year,
      sectionId,
      breakPeriods,
      periodsPerDay,
      constraints,
      facultyPreferencesMap,
      isMoving,
      onMoveEntry,
      isBreak,
    ]
  );

  if (isBreak) {
    return (
      <td className="border border-slate-200 bg-orange-50 text-center p-1">
        <span className="text-[9px] text-orange-300 font-semibold">BREAK</span>
      </td>
    );
  }

  const cellClassName = [
    'border border-slate-200 h-14 align-top transition-colors',
    canDrop && isOver ? 'bg-emerald-50 ring-2 ring-emerald-300 ring-inset' : '',
    canDrop && !isOver ? 'bg-emerald-50/40' : '',
    isFree ? 'p-0.5' : 'p-0.5',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <td ref={dropRef} className={cellClassName}>
      {isFree ? (
        <div className="h-full min-h-[52px] flex items-center justify-center rounded">
          <span className={`text-[9px] font-medium ${canDrop ? 'text-emerald-500' : 'text-slate-300'}`}>
            {canDrop ? 'DROP HERE' : 'FREE'}
          </span>
        </div>
      ) : (
        slotEntries.map((entry, index) => (
          <DraggableEntryCard
            key={getEntryId(entry) || index}
            entry={entry}
            entries={entries}
            isMoving={isMoving}
          />
        ))
      )}
    </td>
  );
};

const SectionGrid = ({
  entries,
  year,
  sectionId,
  days,
  periods,
  breakPeriods,
  constraints,
  facultyPreferencesMap,
  onMoveEntry,
  isMoving,
}) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200">
    <table className="w-full text-left border-collapse text-xs">
      <thead className="bg-slate-100 sticky top-0 z-10">
        <tr>
          <th className="border border-slate-200 p-2 text-slate-500 font-bold uppercase text-[10px] w-20">
            Day / Period
          </th>
          {periods.map((period) => (
            <th
              key={period}
              className={`border border-slate-200 p-2 text-center font-bold uppercase text-[10px] w-28 ${
                breakPeriods.has(period) ? 'bg-orange-50 text-orange-500' : 'text-slate-500'
              }`}
            >
              {breakPeriods.has(period) ? `P${period} ☕` : `P${period}`}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {days.map((day) => (
          <tr key={day}>
            <td className="border border-slate-200 p-2 font-semibold text-slate-600 bg-slate-50 text-[10px] whitespace-nowrap">
              {day.slice(0, 3)}
            </td>
            {periods.map((period) => (
              <SlotCell
                key={`${day}-${period}`}
                day={day}
                period={period}
                year={year}
                sectionId={sectionId}
                entries={entries}
                breakPeriods={breakPeriods}
                periodsPerDay={periods.length}
                constraints={constraints}
                facultyPreferencesMap={facultyPreferencesMap}
                isMoving={isMoving}
                onMoveEntry={onMoveEntry}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const YearGroup = ({
  year,
  sections,
  entries,
  days,
  periods,
  breakPeriods,
  constraints,
  facultyPreferencesMap,
  onMoveEntry,
  isMoving,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <button
        onClick={() => setCollapsed((current) => !current)}
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
          {sections.map((sectionId) => {
            const sectionEntries = entries.filter(
              (entry) => Number(entry.year) === Number(year) && entry.sectionId === sectionId
            );
            const theoryCount = sectionEntries.filter((entry) => !entry.isLab).length;
            const labCount = sectionEntries.filter((entry) => entry.isLab).length;

            return (
              <div key={sectionId} className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
                      CSE — {sectionId}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {theoryCount} theory · {labCount} lab periods · {sectionEntries.length} total slots
                  </span>
                </div>

                <SectionGrid
                  entries={sectionEntries}
                  year={year}
                  sectionId={sectionId}
                  days={days}
                  periods={periods}
                  breakPeriods={breakPeriods}
                  constraints={constraints}
                  facultyPreferencesMap={facultyPreferencesMap}
                  onMoveEntry={onMoveEntry}
                  isMoving={isMoving}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Timetable = () => {
  const [semester, setSemester] = useState('Fall 2024');
  const [department] = useState('CSE');
  const [timetable, setTimetable] = useState(null);
  const [constraints, setConstraints] = useState(null);
  const [facultyPreferences, setFacultyPreferences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [progressLog, setProgressLog] = useState('');
  const [moveState, setMoveState] = useState({ loading: false, message: '', tone: 'info' });

  const fetchPageData = async () => {
    setLoading(true);
    try {
      const [timetableResult, constraintsResult, facultyPreferencesResult] = await Promise.allSettled([
        api.get(`/admin/timetable/${semester}`),
        api.get(`/admin/constraints/${semester}`),
        api.get(`/admin/faculty-preferences/${semester}`),
      ]);

      if (timetableResult.status === 'fulfilled') {
        setTimetable(timetableResult.value.data);
      } else {
        setTimetable(null);
      }

      if (constraintsResult.status === 'fulfilled') {
        setConstraints(constraintsResult.value.data);
      } else {
        setConstraints(null);
      }

      if (facultyPreferencesResult.status === 'fulfilled') {
        setFacultyPreferences(facultyPreferencesResult.value.data || []);
      } else {
        setFacultyPreferences([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPageData();
  }, [semester]);

  useEffect(() => {
    if (!jobId || !generating) return undefined;

    const intervalId = setInterval(async () => {
      try {
        const { data } = await api.get(`/admin/timetable/generate/status/${jobId}`);
        if (data.status === 'completed') {
          setGenerating(false);
          setJobId(null);
          setProgressLog(`Generated successfully. ${data.result || ''}`.trim());
          fetchPageData();
        } else if (data.status === 'failed') {
          setGenerating(false);
          setJobId(null);
          setProgressLog(`Generation failed: ${data.error}`);
          alert(`Generation Failed:\n\n${data.error}`);
        } else {
          setProgressLog(data.progress || 'Algorithm running — solving constraints per section...');
        }
      } catch (error) {
        console.error(error);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [jobId, generating]);

  const handleGenerate = async () => {
    try {
      setMoveState({ loading: false, message: '', tone: 'info' });
      setProgressLog('Starting generation...');
      const { data } = await api.post('/admin/timetable/generate', { semester, department });
      setJobId(data.jobId);
      setGenerating(true);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to start generation');
    }
  };

  const handlePublish = async () => {
    if (!window.confirm('Publish will lock preferences and show the timetable to students. Continue?')) return;

    try {
      await api.patch(`/admin/timetable/${semester}/publish`);
      alert('Published!');
      fetchPageData();
    } catch (error) {
      alert('Failed to publish.');
    }
  };

  const handleMoveEntry = async (entryId, targetSlot) => {
    if (moveState.loading) return;

    setMoveState({
      loading: true,
      message: `Rescheduling class to ${targetSlot.day} P${targetSlot.period}...`,
      tone: 'info',
    });

    try {
      const { data } = await api.patch(`/admin/timetable/entry/${entryId}/move`, {
        newDay: targetSlot.day,
        newPeriod: targetSlot.period,
      });

      setMoveState({
        loading: false,
        message: data.message || `Class moved to ${targetSlot.day} P${targetSlot.period}.`,
        tone: 'success',
      });
      await fetchPageData();
    } catch (error) {
      setMoveState({
        loading: false,
        message: error.response?.data?.message || 'Could not move that class.',
        tone: 'error',
      });
    }
  };

  const entries = timetable?.entries || [];
  const yearSectionMap = {};
  entries.forEach((entry) => {
    const year = Number(entry.year);
    const sectionId = entry.sectionId;
    if (!yearSectionMap[year]) yearSectionMap[year] = new Set();
    yearSectionMap[year].add(sectionId);
  });

  const years = Object.keys(yearSectionMap)
    .map(Number)
    .sort((a, b) => a - b);

  const totalEntries = entries.length;
  const theoryCount = entries.filter((entry) => !entry.isLab).length;
  const labCount = entries.filter((entry) => entry.isLab).length;

  const baseDays = constraints?.workingDays?.length ? constraints.workingDays : DEFAULT_DAYS;
  const days = [...new Set([...baseDays, ...RESCHEDULE_EXTRA_DAYS])];
  const periodCount = Number(constraints?.periodsPerDay) || DEFAULT_PERIODS.length;
  const periods = Array.from({ length: periodCount }, (_, index) => index + 1);
  const breakPeriods = new Set(
    Array.isArray(constraints?.breakPeriods) && constraints.breakPeriods.length
      ? constraints.breakPeriods.map(Number)
      : DEFAULT_BREAK_PERIODS
  );
  const facultyPreferencesMap = getPreferenceMap(facultyPreferences);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-5 animate-fade-in-up flex flex-col h-full">
        <div className="flex flex-wrap justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100 gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Timetable Generator</h2>
            <p className="text-slate-500 text-sm mt-1">
              Generate first, then drag any class card into a free slot in the same section to reschedule it safely, including weekends when needed.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
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
              {generating ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw size={16} className="mr-2" />
                  Generate Timetable
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          {(generating || progressLog) && (
            <div
              className={`border-l-4 p-4 rounded-r-xl flex items-start gap-3 ${
                progressLog.startsWith('Generation failed')
                  ? 'bg-red-50 border-red-400'
                  : progressLog.startsWith('Generated successfully')
                  ? 'bg-green-50 border-green-400'
                  : 'bg-blue-50 border-blue-400'
              }`}
            >
              {generating && <Loader2 className="animate-spin text-blue-500 mt-0.5 flex-shrink-0" size={18} />}
              <div>
                <p className="text-sm font-semibold text-slate-700">{progressLog}</p>
                {generating && (
                  <p className="text-xs text-slate-400 mt-1">
                    Solving constraints section by section — shared faculty conflicts are handled globally.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="bg-slate-900 text-slate-100 rounded-2xl px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Reschedule</p>
            <p className="text-sm mt-1">
              Drag theory classes or the first cell of a lab block into a free slot. The move is saved only if faculty,
              student, room, break, and lab constraints all still pass. Weekend rescheduling is allowed.
            </p>
          </div>
        </div>

        {moveState.message && (
          <div
            className={`border-l-4 rounded-r-xl p-4 text-sm font-semibold ${
              moveState.tone === 'success'
                ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                : moveState.tone === 'error'
                ? 'bg-red-50 border-red-400 text-red-700'
                : 'bg-blue-50 border-blue-400 text-blue-700'
            }`}
          >
            {moveState.loading && <Loader2 size={16} className="inline mr-2 animate-spin align-text-bottom" />}
            {moveState.message}
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex justify-center items-center py-20 text-indigo-500">
            <Loader2 className="animate-spin" size={40} />
          </div>
        ) : !timetable ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-100">
            <CalendarDays size={64} className="mb-4 opacity-40" />
            <h3 className="text-xl font-bold text-slate-600 mb-2">No Timetable Found</h3>
            <p className="text-sm text-center max-w-sm">
              No timetable exists for <strong>{semester}</strong>.
              <br />
              Click <em>Generate Timetable</em> to create one for all 4 sections.
            </p>
          </div>
        ) : years.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-100">
            <CalendarDays size={48} className="mb-3 opacity-40" />
            <p className="text-slate-500 font-semibold">Timetable document exists but has 0 entries.</p>
            <p className="text-sm text-slate-400 mt-1">
              Click <strong>Generate Timetable</strong> to regenerate.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl px-5 py-3 border border-slate-100 shadow-sm flex flex-wrap items-center gap-4">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  timetable.status === 'published'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {timetable.status}
              </span>
              <span className="text-xs text-slate-500">
                <strong>{totalEntries}</strong> total slots &nbsp;·&nbsp;
                <strong>{theoryCount}</strong> theory &nbsp;·&nbsp;
                <strong>{labCount}</strong> lab periods &nbsp;·&nbsp;
                <strong>{years.length}</strong> year{years.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
                <strong>{Object.values(yearSectionMap).reduce((count, sectionSet) => count + sectionSet.size, 0)}</strong>{' '}
                sections
              </span>
              <span className="ml-auto text-xs text-slate-400">
                Generated: {new Date(timetable.generatedAt || timetable.createdAt).toLocaleString()}
              </span>
            </div>

            <div className="space-y-5 pb-6">
              {years.map((year) => (
                <YearGroup
                  key={year}
                  year={year}
                  sections={[...yearSectionMap[year]].sort()}
                  entries={entries}
                  days={days}
                  periods={periods}
                  breakPeriods={breakPeriods}
                  constraints={constraints}
                  facultyPreferencesMap={facultyPreferencesMap}
                  onMoveEntry={handleMoveEntry}
                  isMoving={moveState.loading}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </DndProvider>
  );
};

export default Timetable;
