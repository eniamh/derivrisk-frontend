// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';

import FxForwardApp from './FxForwardApp.tsx'; // your renamed original App.tsx
import RateSimulationComparison from './pages/RateSimulationComparison.tsx';
import AppLayout from './components/AppLayout.tsx'; // ← new import

const router = createBrowserRouter([
  {
    path: '/',                    // ← root path
    element: <AppLayout />,       // ← all child pages get the navbar + layout
    children: [                   // ← nested routes render inside <Outlet />
      {
        index: true,              // ← default child: matches exactly "/"
        element: <FxForwardApp />,
      },
      {
        path: 'rates-comparison', // ← matches /rates-comparison
        element: <RateSimulationComparison />,
      },
      // Add more pages here later
    ],
  },
  // Optional: 404 fallback (outside layout if you want no navbar on 404)
  {
    path: '*',
    element: <div className="min-h-screen flex items-center justify-center">404 - Page Not Found</div>,
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);