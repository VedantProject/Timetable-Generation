import React from 'react';
import { Construction } from 'lucide-react';

const Placeholder = ({ title, description }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[500px]">
      <div className="w-24 h-24 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-6">
        <Construction size={48} />
      </div>
      <h2 className="text-3xl font-bold text-slate-800 mb-2">{title}</h2>
      <p className="text-slate-500 text-center max-w-md">{description}</p>
      
      <div className="mt-8 px-6 py-3 bg-amber-50 text-amber-700 font-semibold rounded-lg border border-amber-200 shadow-sm">
        Module Under Construction 🛠️
      </div>
    </div>
  );
};

export default Placeholder;
