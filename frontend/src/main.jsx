import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App.jsx";
import Signup from "./pages/Signup.jsx";
import Signin from "./pages/Signin.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Signin />} />
      <Route path="/register" element={<Signup />} />
      <Route path="/dashboard" element={<App />} />
    </Routes>
  </BrowserRouter>
);