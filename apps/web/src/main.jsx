import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './auth.css';
import './theme.css';
import './project-actions.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
