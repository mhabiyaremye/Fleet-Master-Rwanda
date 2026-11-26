import "./App.css";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./features/auth/login/login";
import CreateAccount from "./features/auth/registration/create-account";
import AdminDashboard from "./features/administration/admin";
import FleetManager from "./features/fleet/fleet-manager";
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
