import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ServiceSetupWizard from './pages/ServiceSetupWizard';

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/setup/:serviceId" element={<ServiceSetupWizard />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App; 