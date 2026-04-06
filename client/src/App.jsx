import React, { useContext } from "react"; 
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import AdminLayout from "./components/AdminLayout.jsx";
import DashboardHome from "./pages/admin/DashboardHome.jsx";
import Users from "./pages/admin/Users.jsx";
import Constraints from "./pages/admin/Constraints.jsx";
import Courses from "./pages/admin/Courses.jsx";
import Timetable from "./pages/admin/Timetable.jsx";
import Export from "./pages/admin/Export.jsx";
import Placeholder from "./components/Placeholder.jsx";
import { AuthContext } from "./context/AuthContext.jsx";

import FacultyLayout from "./components/FacultyLayout.jsx";
import FacultySchedule from "./pages/faculty/FacultySchedule.jsx";
import Preferences from "./pages/faculty/Preferences.jsx";
import CancelMakeup from "./pages/faculty/CancelMakeup.jsx";

import StudentLayout from "./components/StudentLayout.jsx";
import StudentSchedule from "./pages/student/StudentSchedule.jsx";

const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, loading } = useContext(AuthContext);
  
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRole && user.role !== allowedRole) return <Navigate to="/login" replace />;
  
  return children;
};

// ... existing code down to the routes ...
function App() { 
  const { user } = useContext(AuthContext);

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      
      {/* Root redirect */}
      <Route path="/" element={
        user ? (
          user.role === 'admin' ? <Navigate to="/admin" /> :
          user.role === 'faculty' ? <Navigate to="/faculty" /> :
          <Navigate to="/student" />
        ) : <Navigate to="/login" />
      } />

      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRole="admin">
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<DashboardHome />} />
        <Route path="constraints" element={<Constraints />} />
        <Route path="courses" element={<Courses />} />
        <Route path="timetable" element={<Timetable />} />
        <Route path="users" element={<Users />} />
        <Route path="export" element={<Export />} />
      </Route>
      
      {/* Faculty Layout */}
      <Route path="/faculty" element={
        <ProtectedRoute allowedRole="faculty">
          <FacultyLayout />
        </ProtectedRoute>
      }>
        <Route index element={<FacultySchedule />} />
        <Route path="preferences" element={<Preferences />} />
        <Route path="manage-classes" element={<CancelMakeup />} />
      </Route>
      
      {/* Student Layout */}
      <Route path="/student" element={
        <ProtectedRoute allowedRole="student">
          <StudentLayout />
        </ProtectedRoute>
      }>
        <Route index element={<StudentSchedule />} />
      </Route>
    </Routes>
  ); 
} 

export default App;

