import { useEffect } from 'react';
import { AuthProvider } from './source/context/AuthContext';
import Navigation from './source/navigation';
import ConnectionStatus from './source/components/ConnectionStatus';
import { initializeLocalDatabase } from './source/services/localDb';

export default function App() {
  useEffect(() => {
    async function boot() {
      try {
        await initializeLocalDatabase();
      } catch (error) {
        console.warn('App boot error:', error);
      }
    }

    boot();
  }, []);

  return (
    <>
      <ConnectionStatus />
      <AuthProvider>
        <Navigation />
      </AuthProvider>
    </>
  );
}