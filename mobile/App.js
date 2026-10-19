import { useEffect } from 'react';
import { AuthProvider } from './source/context/AuthContext';
import Navigation from './source/navigation';
import ConnectionStatus from './source/components/ConnectionStatus';
import { initializeLocalDatabase } from './source/services/localDb';
import { syncAppStateToLocal } from './source/services/syncService';

export default function App() {
  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        await initializeLocalDatabase();
        if (mounted) {
          await syncAppStateToLocal();
        }
      } catch (error) {
        console.warn('App boot error:', error);
      }
    }

    boot();

    return () => {
      mounted = false;
    };
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