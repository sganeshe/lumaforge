/**
 * @file main.jsx
 * @description The root entry point for the LUMAFORGE application.
 * Bootstraps the React DOM and mounts the global App component. 
 * StrictMode is enabled to ensure lifecycle safety and flag deprecated API usage during development.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)