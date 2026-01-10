import React from "react";
import { Routes, Route } from "react-router-dom";

import Layout from "./Layout.jsx";
import Home from "./Pages/Home.jsx";
import Accounts from "./Pages/Accounts.jsx";
import Calendar from "./Pages/Calendar.jsx";
import Charts from "./Pages/Charts.jsx";
import Settings from "./Pages/Settings.jsx";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/charts" element={<Charts />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}