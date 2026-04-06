import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Book, Plus, Users, LibraryBig, Loader2 } from 'lucide-react';

const Courses = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [faculty, setFaculty] = useState([]);
  
  const [formData, setFormData] = useState({
    courseCode: '',
    courseName: '',
    department: '',
    year: 1,
    isLab: false,
    labDurationHours: 0,
    weeklyTheoryHours: 3,
    weeklyLabHours: 0,
    sections: [{ sectionId: 'A', assignedFacultyId: '' }]
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [crData, facData] = await Promise.all([
        api.get('/admin/courses'),
        api.get('/admin/users') // We'll filter for faculty
      ]);
      setCourses(crData.data);
      setFaculty(facData.data.filter(u => u.role === 'faculty'));
    } catch (error) {
      console.error('Fetch error', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddSection = () => {
    setFormData({
      ...formData,
      sections: [...formData.sections, { sectionId: String.fromCharCode(65 + formData.sections.length), assignedFacultyId: '' }]
    });
  };

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/courses', formData);
      setIsModalOpen(false);
      setFormData({
        courseCode: '', courseName: '', department: '', year: 1, isLab: false, labDurationHours: 0,
        weeklyTheoryHours: 3, weeklyLabHours: 0, sections: [{ sectionId: 'A', assignedFacultyId: '' }]
      });
      fetchData();
    } catch (err) {
      alert("Error adding course. Make sure code is unique.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Faculty & Curriculum</h2>
          <p className="text-slate-500 mt-1">Manage courses, map laboratory times, and assign sectional faculty.</p>
        </div>
        <div className="flex space-x-3">
          <button className="px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl font-medium hover:bg-emerald-100 transition-colors">
            Bulk Upload Faculty
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-md transition-all active:scale-95">
            <Plus size={18} className="mr-2" />
            Add Course
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
           <div className="flex justify-center p-12 text-indigo-500"><Loader2 className="animate-spin" size={32}/></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {courses.map(course => (
              <div key={course._id} className="border border-slate-100 rounded-2xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden group">
                <div className={`absolute top-0 right-0 w-2 h-full ${course.isLab ? 'bg-amber-400' : 'bg-indigo-400'} opacity-80`}></div>
                
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl ${course.isLab ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {course.isLab ? <LibraryBig size={20} /> : <Book size={20} />}
                  </div>
                  <div className="flex space-x-2">
                    {course.year && (
                      <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        Year {course.year}
                      </span>
                    )}
                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      {course.courseCode}
                    </span>
                  </div>
                </div>
                
                <h3 className="font-bold text-lg text-slate-800 leading-tight mb-1">{course.courseName}</h3>
                <p className="text-sm text-slate-500 mb-4">{course.department}</p>
                
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                  <div className="text-center">
                    <p className="text-xs text-slate-400 font-semibold uppercase">Theory</p>
                    <p className="font-bold text-slate-700">{course.weeklyTheoryHours}h</p>
                  </div>
                  {course.isLab && (
                    <div className="text-center border-l pl-4 border-slate-200">
                      <p className="text-xs text-slate-400 font-semibold uppercase">Lab Block</p>
                      <p className="font-bold text-slate-700">{course.labDurationHours}h</p>
                    </div>
                  )}
                  <div className="text-center border-l pl-4 border-slate-200">
                    <p className="text-xs text-slate-400 font-semibold uppercase">Sections</p>
                    <p className="font-bold text-indigo-600">{course.sections.length}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase">Section Allocations:</p>
                  {course.sections.map(sec => (
                    <div key={sec._id} className="flex justify-between items-center text-sm bg-white border border-slate-100 p-2 rounded-lg">
                      <span className="font-bold w-6 h-6 bg-slate-100 rounded flex items-center justify-center text-slate-600">{sec.sectionId}</span>
                      <span className="text-slate-600 truncate ml-2 flex-1">{sec.assignedFacultyId?.name || "Unassigned"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-y-auto max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-slate-800">Add New Course</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>
            
            <form onSubmit={handleSaveCourse} className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Course Code</label>
                  <input required className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none" 
                         value={formData.courseCode} onChange={e => setFormData({...formData, courseCode: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Department</label>
                  <input required className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none" 
                         value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Year</label>
                  <select required className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none bg-white" 
                          value={formData.year} onChange={e => setFormData({...formData, year: parseInt(e.target.value)})}>
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Course Name</label>
                <input required className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none" 
                       value={formData.courseName} onChange={e => setFormData({...formData, courseName: e.target.value})} />
              </div>

              <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <input type="checkbox" className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" 
                       checked={formData.isLab} onChange={e => setFormData({...formData, isLab: e.target.checked})} />
                <label className="font-semibold text-slate-700">Course includes a Laboratory component</label>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Weekly Theory Hrs</label>
                  <input type="number" required className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none" 
                         value={formData.weeklyTheoryHours} onChange={e => setFormData({...formData, weeklyTheoryHours: parseInt(e.target.value)})} />
                </div>
                {formData.isLab && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Lab Duration Hrs</label>
                      <input type="number" required className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none" 
                             value={formData.labDurationHours} onChange={e => setFormData({...formData, labDurationHours: parseInt(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Total Lab Hrs</label>
                      <input type="number" required className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none" 
                             value={formData.weeklyLabHours} onChange={e => setFormData({...formData, weeklyLabHours: parseInt(e.target.value)})} />
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <label className="block text-sm font-bold text-slate-800">Sections & Faculty Map</label>
                  <button type="button" onClick={handleAddSection} className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-200">+ Add Section</button>
                </div>
                
                {formData.sections.map((sec, idx) => (
                  <div key={idx} className="flex space-x-4 items-center bg-white border border-slate-100 p-3 rounded-xl shadow-sm">
                    <span className="font-bold w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">{sec.sectionId}</span>
                    <select required className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 outline-none bg-slate-50"
                            value={sec.assignedFacultyId} onChange={e => {
                              const newSecs = [...formData.sections];
                              newSecs[idx].assignedFacultyId = e.target.value;
                              setFormData({...formData, sections: newSecs});
                            }}>
                      <option value="">Assign Faculty...</option>
                      {faculty.map(f => <option key={f._id} value={f._id}>{f.name} ({f.department})</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-md">
                  Save Course Structure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Courses;
