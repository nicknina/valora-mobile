import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import api from './api';
import { initializeLocalDatabase, upsertLocalRows } from './localDb';
import { LOCAL_ONLY_MODE } from './appMode';

export async function isAppOnline() {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

export async function syncAppStateToLocal() {
  if (LOCAL_ONLY_MODE) return { synced: false, reason: 'local-only' };

  try {
    const online = await isAppOnline();
    if (!online) return { synced: false, reason: 'offline' };

    await initializeLocalDatabase();

    const token = await AsyncStorage.getItem('token');
    if (!token) return { synced: false, reason: 'no-token' };

    const [contas, lancamentos, precos, notas, alertas] = await Promise.allSettled([
      api.get('/contas'),
      api.get('/lancamentos?data_inicio=2000-01-01&data_fim=2100-12-31'),
      api.get('/precos-medios'),
      api.get('/notas'),
      api.get('/alertas'),
    ]);

    const synced = {};
    if (contas.status === 'fulfilled' && Array.isArray(contas.value?.data)) {
      await upsertLocalRows('conta_financeira', contas.value.data.map((item) => ({
        ...item,
        id_conta: item.id_conta || item.id,
        saldo_inicial_configurado: item.saldo_inicial_configurado ? 1 : 0,
      })), 'id_conta');
      synced.contas = true;
    }

    if (lancamentos.status === 'fulfilled' && Array.isArray(lancamentos.value?.data)) {
      await upsertLocalRows('lancamento_financeiro', lancamentos.value.data.map((item) => ({
        ...item,
        id_lancamento: item.id_lancamento || item.id,
        categoria_nome: item.categoria?.nome || item.categoria_nome || 'Sem categoria',
        conta_nome: item.conta_financeira?.nome || item.conta_nome || 'Conta não identificada',
      })), 'id_lancamento');
      synced.lancamentos = true;
    }

    if (precos.status === 'fulfilled' && Array.isArray(precos.value?.data)) {
      const rows = precos.value.data.flatMap((produto) => {
        const lista = Array.isArray(produto.historico) ? produto.historico : [];
        return lista.map((item) => ({
          id_preco: item.id_preco || produto.id || `${produto.nome}-${item.data_referencia}`,
          id_mei: 'mei_demo',
          nome_produto: produto.nome,
          unidade: produto.unidade,
          categoria: produto.categoria,
          valor: item.preco,
          data_referencia: item.data_referencia || item.mes,
          criado_em: item.data_referencia || new Date().toISOString().slice(0, 10),
          atualizado_em: new Date().toISOString(),
        }));
      });
      if (rows.length) {
        await upsertLocalRows('preco_mercado', rows, 'id_preco');
      }
      synced.precos = true;
    }

    if (notas.status === 'fulfilled' && Array.isArray(notas.value?.data)) {
      await upsertLocalRows('nota_fiscal', notas.value.data.map((item) => ({
        ...item,
        id_nota: item.id_nota || item.id,
      })), 'id_nota');
      synced.notas = true;
    }

    if (alertas.status === 'fulfilled' && Array.isArray(alertas.value?.data)) {
      await upsertLocalRows('alerta_financeiro', alertas.value.data.map((item) => ({
        ...item,
        id_alerta: item.id_alerta || item.id,
        ativo: item.ativo ? 1 : 0,
      })), 'id_alerta');
      synced.alertas = true;
    }

    return { synced: true, ...synced };
  } catch (error) {
    console.warn('syncAppStateToLocal error:', error);
    return { synced: false, reason: 'sync-error' };
  }
}
