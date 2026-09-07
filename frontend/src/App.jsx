import "./App.css";
import { Routes, Route } from "react-router-dom";
import Login from "./pages/login/login";
import CreateAccount from "./pages/create-account/create-account";
import AdminDashboard from "./pages/admin/admin";
import FleetManager from "./pages/Fleet_manager/fleet-manager";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/create-account" element={<CreateAccount />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/fleet-manager" element={<FleetManager />} />
    </Routes>
  );
}

export default App;
