import React from 'react';
import ReactDOM from 'react-dom'; // Note: In newer React (18+), you would use 'react-dom/client'
import App from './App';
import './App.css'; // Import the CSS file for styling

// This is the file that connects your main React component (App)
// to the HTML page (index.html).

// Check if we are running in a modern React environment
if (ReactDOM.createRoot) {
  // React 18+ way (requires index.html to have a root element)
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  // Legacy React 17 way (more compatible with older environments)
  ReactDOM.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    document.getElementById('root')
  );
}
