import React, { useState } from 'react';
import api from '../../api/axios';
import { DownloadCloud, FileText, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';

const Export = () => {
  const [semester, setSemester] = useState('Fall 2024');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleExport = async (format) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/admin/timetable/${semester}/export`, {
        params: { format },
        responseType: 'blob' // Important for handling files
      });

      // Create a URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const fileExtension = format === 'pdf' ? 'pdf' : 'xlsx';
      link.setAttribute('download', `Timetable_${semester.replace(/\s+/g, '_')}.${fileExtension}`);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data instanceof Blob) {
        // Parse Blob error back to text
        const text = await err.response.data.text();
        try {
          const jsonError = JSON.parse(text);
          setError(jsonError.message || "Failed to export timetable.");
        } catch(e) {
          setError("Failed to download file. Please ensure the timetable is generated.");
        }
      } else {
        setError("Failed to verify timetable for this semester.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Export Engine</h2>
          <p className="text-slate-500 mt-1">Download static copies of generated timetables for off-platform sharing.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <DownloadCloud size={40} />
        </div>
        
        <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">Select Semester Configuration</h3>
        
        <div className="w-full max-w-sm space-y-6">
          <select 
            value={semester} 
            onChange={e => {
              setSemester(e.target.value);
              setError(null);
            }} 
            className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 bg-slate-50 shadow-sm"
          >
            <option value="Fall 2024">Fall 2024</option>
            <option value="Spring 2025">Spring 2025</option>
          </select>

          {error && (
            <div className="flex items-center p-4 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-sm font-semibold">
              <AlertCircle size={18} className="mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => handleExport('pdf')}
              disabled={loading}
              className="flex flex-col items-center justify-center p-4 bg-white border-2 border-rose-100 rounded-xl hover:border-rose-300 hover:bg-rose-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                 <Loader2 size={32} className="text-rose-500 mb-2 animate-spin" />
              ) : (
                 <FileText size={32} className="text-rose-500 mb-2 group-hover:scale-110 transition-transform" />
              )}
              <span className="font-bold text-slate-700 text-sm">Adobe PDF</span>
            </button>

            <button 
              onClick={() => handleExport('excel')}
              disabled={loading}
              className="flex flex-col items-center justify-center p-4 bg-white border-2 border-emerald-100 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                 <Loader2 size={32} className="text-emerald-500 mb-2 animate-spin" />
              ) : (
                 <FileSpreadsheet size={32} className="text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
              )}
              <span className="font-bold text-slate-700 text-sm">MS Excel</span>
            </button>
          </div>
        </div>

        <p className="mt-8 text-xs text-slate-400 text-center max-w-sm leading-relaxed">
          The export engine parses the live timetable directly from the MongoDB schema mapping. Note that any makeup classes or manual overrides currently active will be included in the generation.
        </p>

      </div>
    </div>
  );
};

export default Export;
