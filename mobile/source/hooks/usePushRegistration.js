import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import api from '../services/api';
import { LOCAL_ONLY_MODE } from '../services/appMode';

/**
 * Registra o token de push (Expo) do dispositivo assim que
 * o usuário estiver logado. Chame no componente raiz do app
 * (ex: App.js) passando true/objeto do usuário logado.
 *
 *   usePushRegistration(usuarioLogado);
 */
export function usePushRegistration(usuarioLogado) {
  useEffect(() => {
    if (!usuarioLogado || LOCAL_ONLY_MODE) return;

    async function registrar() {
      if (!Device.isDevice) return; // simuladores/emuladores não recebem push

      const { status: statusAtual } = await Notifications.getPermissionsAsync();
      let status = statusAtual;

      if (status !== 'granted') {
        const { status: novoStatus } = await Notifications.requestPermissionsAsync();
        status = novoStatus;
      }

      if (status !== 'granted') return;

      try {
        const { data: token } = await Notifications.getExpoPushTokenAsync();
        await api.post('/dispositivos/push-token', { expo_push_token: token });
      } catch (err) {
        console.warn('Falha ao registrar token de push:', err);
      }
    }

    registrar();
  }, [usuarioLogado]);
}
