import "./App.css";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/login/login";
import CreateAccount from "./pages/create-account/create-account";
import AdminDashboard from "./pages/admin/admin";
import FleetManager from "./pages/Fleet_manager/fleet-manager";
import ProtectedRoute from "./routes/ProtectedRoute";
function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/create-account" element={<CreateAccount />} />

      {/* Admin protected route */}
      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>

      {/* Fleet Manager protected route */}
      <Route element={<ProtectedRoute allowedRoles={["Fleet Manager"]} />}>
        <Route path="/fleet-manager" element={<FleetManager />} />
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
