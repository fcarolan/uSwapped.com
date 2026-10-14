import { Routes, Route, useLocation } from "react-router-dom";
import Layout from "@/components/Layout";
import AuthCallback from "@/components/AuthCallback";
import RequireAuth from "@/components/RequireAuth";
import Landing from "@/pages/Landing";
import Browse from "@/pages/Browse";
import ItemDetail from "@/pages/ItemDetail";
import CreateListing from "@/pages/CreateListing";
import Dashboard from "@/pages/Dashboard";
import Pricing from "@/pages/Pricing";
import HowItWorks from "@/pages/HowItWorks";
import Login from "@/pages/Login";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel from "@/pages/PaymentCancel";
import Chat from "@/pages/Chat";
import Profile from "@/pages/Profile";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  const location = useLocation(); // hash read here (reactive), not window.location.hash
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/items/:id" element={<ItemDetail />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/credits" element={<Pricing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/list" element={<RequireAuth><CreateListing /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/users/:id" element={<Profile />} />
        <Route path="/swaps/:id/chat" element={<RequireAuth><Chat /></RequireAuth>} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/payment/cancel" element={<PaymentCancel />} />
        <Route path="*" element={<Landing />} />
      </Route>
    </Routes>
  );
}
