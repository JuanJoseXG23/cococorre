import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { firebaseConfigured } from './firebase/app';
import { AuthProvider } from './auth/AuthContext';
import { App } from './App';
import { SetupScreen } from './screens/SetupScreen';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {firebaseConfigured ? (
      <AuthProvider>
        <App />
      </AuthProvider>
    ) : (
      <SetupScreen />
    )}
  </StrictMode>,
);
