import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeLocalDatabase, getLocalRows, removeLocalRow, upsertLocalRows } from './localDb';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://10.0.2.2:3000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 9000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function formatDate(dateString) {
  if (!dateString) return new Date().toISOString().slice(0, 10);
  return String(dateString).slice(0, 10);
}

function getNumeric(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function buildLocalContas() {
  return getLocalRows('conta_financeira').then((contas) => {
    if (!contas.length) return [];

    return contas.map((conta) => {
      const saldoInicial = getNumeric(conta.saldo_inicial);
      const movs = getLocalRows('lancamento_financeiro')
        .then((lancamentos) => {
          const registros = lancamentos.filter((l) => l.id_conta === conta.id_conta && formatDate(l.data_lancamento) >= formatDate(conta.data_saldo_inicial));
          const entradas = registros.filter((l) => l.tipo === 'receita').reduce((acc, item) => acc + getNumeric(item.valor), 0);
          const saidas = registros.filter((l) => l.tipo !== 'receita').reduce((acc, item) => acc + getNumeric(item.valor), 0);
          return { entradas, saidas };
        });

      return movs.then(({ entradas, saidas }) => ({
        ...conta,
        saldo_inicial: saldoInicial,
        entradas: Number(entradas.toFixed(2)),
        saidas: Number(saidas.toFixed(2)),
        saldo_atual: conta.saldo_inicial_configurado ? Number((saldoInicial + entradas - saidas).toFixed(2)) : null,
      }));
    });
  }).then(async (items) => Promise.all(items));
}

function buildLocalLancamentos(params = {}) {
  return getLocalRows('lancamento_financeiro').then((rows) => {
    let lista = [...rows];

    if (params.tipo) {
      lista = lista.filter((item) => item.tipo === params.tipo);
    }
    if (params.data_inicio) {
      lista = lista.filter((item) => formatDate(item.data_lancamento) >= formatDate(params.data_inicio));
    }
    if (params.data_fim) {
      lista = lista.filter((item) => formatDate(item.data_lancamento) <= formatDate(params.data_fim));
    }
    if (params.id_categoria) {
      lista = lista.filter((item) => String(item.id_categoria) === String(params.id_categoria));
    }

    return lista
      .sort((a, b) => String(b.data_lancamento).localeCompare(String(a.data_lancamento)))
      .map((item) => ({
        ...item,
        valor: Number(item.valor || 0),
        categoria: {
          id_categoria: item.id_categoria,
          nome: item.categoria_nome || 'Sem categoria',
          tipo: item.tipo,
        },
        conta_financeira: {
          id_conta: item.id_conta,
          nome: item.conta_nome || 'Conta não identificada',
        },
      }));
  });
}

function buildLocalPrecos() {
  return getLocalRows('preco_mercado').then((rows) => {
    const mapa = {};

    rows.forEach((item) => {
      const key = item.nome_produto;
      if (!mapa[key]) {
        mapa[key] = {
          id: item.id_preco,
          nome: item.nome_produto,
          unidade: item.unidade,
          categoria: item.categoria,
          historico: [],
        };
      }
      mapa[key].historico.push({
        id_preco: item.id_preco,
        mes: new Date(`${item.data_referencia || new Date().toISOString().slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').replace(/^\w/, (c) => c.toUpperCase()),
        preco: Number(item.valor || 0),
        data_referencia: item.data_referencia,
      });
    });

    return Object.values(mapa)
      .map((produto) => ({
        ...produto,
        historico: produto.historico.sort((a, b) => String(a.data_referencia).localeCompare(String(b.data_referencia))),
      }));
  });
}

function buildLocalNotas(params = {}) {
  return getLocalRows('nota_fiscal').then((rows) => {
    let lista = [...rows];
    if (params.nome_cliente) {
      lista = lista.filter((item) => String(item.nome_cliente || '').toLowerCase().includes(String(params.nome_cliente).toLowerCase()));
    }
    if (params.data_inicio) {
      lista = lista.filter((item) => String(item.data_venda || '').localeCompare(String(params.data_inicio)) >= 0);
    }
    if (params.data_fim) {
      lista = lista.filter((item) => String(item.data_venda || '').localeCompare(String(params.data_fim)) <= 0);
    }
    return lista.sort((a, b) => String(b.data_venda).localeCompare(String(a.data_venda)));
  });
}

function buildLocalAlertas() {
  return getLocalRows('alerta_financeiro').then((rows) => rows.sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || ''))));
}

function calcularDre(lancamentos) {
  const classificacoes = [
    'receita_bruta',
    'deducao_receita',
    'custo',
    'despesa_operacional',
    'receita_financeira',
    'despesa_financeira',
    'imposto_lucro',
  ];

  const totais = Object.fromEntries(classificacoes.map((item) => [item, 0]));
  const porCategoria = Object.fromEntries(classificacoes.map((item) => [item, {}]));

  lancamentos.forEach((lancamento) => {
    const classificacao = lancamento.classificacao_dre;
    if (!classificacoes.includes(classificacao)) return;
    const valor = Number(lancamento.valor) || 0;
    const categoria = lancamento.categoria_nome || 'Sem categoria';
    totais[classificacao] += valor;
    porCategoria[classificacao][categoria] = (porCategoria[classificacao][categoria] || 0) + valor;
  });

  const receita_liquida = totais.receita_bruta - totais.deducao_receita;
  const lucro_bruto = receita_liquida - totais.custo;
  const resultado_operacional = lucro_bruto - totais.despesa_operacional;
  const resultado_financeiro = totais.receita_financeira - totais.despesa_financeira;
  const resultado_antes_impostos = resultado_operacional + resultado_financeiro;
  const lucro_liquido = resultado_antes_impostos - totais.imposto_lucro;
  const arredondar = (valor) => Number(valor.toFixed(2));
  const detalhar = (categorias) => Object.entries(categorias)
    .map(([categoria, total]) => ({ categoria, total: arredondar(total) }))
    .sort((a, b) => b.total - a.total);

  return {
    periodo: { data_inicio: 'local', data_fim: 'local' },
    receita_bruta: arredondar(totais.receita_bruta),
    deducoes_receita: arredondar(totais.deducao_receita),
    receita_liquida: arredondar(receita_liquida),
    custos: arredondar(totais.custo),
    lucro_bruto: arredondar(lucro_bruto),
    despesas_operacionais: arredondar(totais.despesa_operacional),
    resultado_operacional: arredondar(resultado_operacional),
    receitas_financeiras: arredondar(totais.receita_financeira),
    despesas_financeiras: arredondar(totais.despesa_financeira),
    resultado_financeiro: arredondar(resultado_financeiro),
    resultado_antes_impostos: arredondar(resultado_antes_impostos),
    impostos_sobre_lucro: arredondar(totais.imposto_lucro),
    lucro_liquido: arredondar(lucro_liquido),
    margem_liquida_percentual: totais.receita_bruta ? arredondar((lucro_liquido / totais.receita_bruta) * 100) : 0,
    por_categoria: {
      deducoes_receita: detalhar(porCategoria.deducao_receita),
      custos: detalhar(porCategoria.custo),
      despesas_operacionais: detalhar(porCategoria.despesa_operacional),
      receitas_financeiras: detalhar(porCategoria.receita_financeira),
      despesas_financeiras: detalhar(porCategoria.despesa_financeira),
      impostos_sobre_lucro: detalhar(porCategoria.imposto_lucro),
    },
  };
}

function parseQueryParams(url) {
  try {
    const queryString = url.includes('?') ? url.split('?')[1] : '';
    const params = {};
    const search = new URLSearchParams(queryString);
    search.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch (error) {
    return {};
  }
}

function getLocalDataForRoute(pathname, params = {}) {
  const normalized = pathname.split('?')[0];
  const mergedParams = { ...params, ...parseQueryParams(pathname) };

  if (normalized === '/contas') return buildLocalContas();
  if (normalized === '/lancamentos') return buildLocalLancamentos(mergedParams);
  if (normalized === '/precos-medios') return buildLocalPrecos();
  if (normalized === '/notas') return buildLocalNotas(mergedParams);
  if (normalized === '/alertas') return buildLocalAlertas();
  if (normalized === '/relatorios/dre') return getLocalRows('lancamento_financeiro').then((rows) => calcularDre(rows));
  if (normalized === '/relatorios/fluxo-de-caixa') {
    return getLocalRows('lancamento_financeiro').then((rows) => {
      const totais = { receita: 0, despesa: 0, investimento: 0, custo: 0 };
      rows.forEach((l) => { totais[l.tipo] = (totais[l.tipo] || 0) + Number(l.valor || 0); });
      const saldo = totais.receita - totais.despesa - totais.custo - totais.investimento;
      const porMes = {};
      rows.forEach((l) => {
        const mes = String(l.data_lancamento || '').slice(0, 7);
        if (!mes) return;
        if (!porMes[mes]) porMes[mes] = { receita: 0, despesa: 0, investimento: 0, custo: 0 };
        porMes[mes][l.tipo] = (porMes[mes][l.tipo] || 0) + Number(l.valor || 0);
      });
      return {
        periodo: { data_inicio: mergedParams.data_inicio || 'local', data_fim: mergedParams.data_fim || 'local' },
        totais,
        saldo,
        por_mes: Object.entries(porMes).sort(([a], [b]) => a.localeCompare(b)).map(([mes, valores]) => ({ mes, ...valores })),
      };
    });
  }

  return null;
}

async function persistLocalWrite(route, method, payload) {
  await initializeLocalDatabase();

  if (route === '/contas') {
    const item = {
      id_conta: payload.id_conta || payload.id || `conta_${Date.now()}`,
      id_mei: payload.id_mei || 'mei_demo',
      nome: payload.nome,
      saldo_inicial: payload.saldo_inicial || 0,
      data_saldo_inicial: payload.data_saldo_inicial || new Date().toISOString().slice(0, 10),
      saldo_inicial_configurado: payload.saldo_inicial_configurado ? 1 : 1,
      criado_em: payload.criado_em || new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
    await upsertLocalRows('conta_financeira', [item], 'id_conta');
    return { ...item, saldo_atual: item.saldo_inicial, entradas: 0, saidas: 0 };
  }

  if (route === '/lancamentos') {
    const item = {
      id_lancamento: payload.id_lancamento || payload.id || `lancamento_${Date.now()}`,
      id_mei: payload.id_mei || 'mei_demo',
      tipo: payload.tipo,
      valor: payload.valor || 0,
      data_lancamento: payload.data_lancamento || new Date().toISOString().slice(0, 10),
      descricao: payload.descricao || '',
      id_categoria: payload.id_categoria || '',
      id_conta: payload.id_conta || '',
      classificacao_dre: payload.classificacao_dre || 'receita_bruta',
      categoria_nome: payload.categoria?.nome || payload.categoria_nome || 'Sem categoria',
      conta_nome: payload.conta_financeira?.nome || payload.conta_nome || 'Conta não identificada',
      criado_em: payload.criado_em || new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
    await upsertLocalRows('lancamento_financeiro', [item], 'id_lancamento');
    return { ...item, categoria: { id_categoria: item.id_categoria, nome: item.categoria_nome }, conta_financeira: { id_conta: item.id_conta, nome: item.conta_nome } };
  }

  if (route === '/precos-medios') {
    const item = {
      id_preco: payload.id_preco || payload.id || `preco_${Date.now()}`,
      id_mei: payload.id_mei || 'mei_demo',
      nome_produto: payload.nome_produto,
      unidade: payload.unidade,
      categoria: payload.categoria,
      valor: payload.valor || 0,
      data_referencia: payload.data_referencia || new Date().toISOString().slice(0, 10),
      criado_em: payload.criado_em || new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
    await upsertLocalRows('preco_mercado', [item], 'id_preco');
    return item;
  }

  if (route === '/notas') {
    const item = {
      id_nota: payload.id_nota || payload.id || `nota_${Date.now()}`,
      id_mei: payload.id_mei || 'mei_demo',
      nome_cliente: payload.nome_cliente,
      data_venda: payload.data_venda || new Date().toISOString().slice(0, 10),
      descricao: payload.descricao || '',
      arquivo_url: payload.arquivo_url,
      arquivo_tipo: payload.arquivo_tipo,
      criado_em: payload.criado_em || new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
    await upsertLocalRows('nota_fiscal', [item], 'id_nota');
    return item;
  }

  if (route === '/alertas') {
    const item = {
      id_alerta: payload.id_alerta || payload.id || `alerta_${Date.now()}`,
      id_mei: payload.id_mei || 'mei_demo',
      tipo_alerta: payload.tipo_alerta,
      descricao: payload.descricao || '',
      valor_referencia: payload.valor_referencia || 0,
      ativo: payload.ativo ? 1 : 0,
      criado_em: payload.criado_em || new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
    await upsertLocalRows('alerta_financeiro', [item], 'id_alerta');
    return item;
  }

  if (route.startsWith('/lancamentos/')) {
    const id = route.split('/').pop();
    if (method === 'DELETE') {
      await removeLocalRow('lancamento_financeiro', 'id_lancamento', id);
      return { mensagem: 'Excluído do cache local', id };
    }
    if (method === 'PUT') {
      await upsertLocalRows('lancamento_financeiro', [{
        ...payload,
        id_lancamento: id,
        categoria_nome: payload.categoria?.nome || payload.categoria_nome || 'Sem categoria',
        conta_nome: payload.conta_financeira?.nome || payload.conta_nome || 'Conta não identificada',
        atualizado_em: new Date().toISOString(),
      }], 'id_lancamento');
      return { ...payload, id_lancamento: id, categoria: { ...payload.categoria }, conta_financeira: { ...payload.conta_financeira } };
    }
  }

  if (route.startsWith('/contas/')) {
    const id = route.split('/').pop();
    if (method === 'DELETE') {
      await removeLocalRow('conta_financeira', 'id_conta', id);
      return { mensagem: 'Excluído do cache local', id };
    }
    if (method === 'PUT') {
      await upsertLocalRows('conta_financeira', [{
        id_conta: id,
        id_mei: payload.id_mei || 'mei_demo',
        nome: payload.nome,
        saldo_inicial: payload.saldo_inicial || 0,
        data_saldo_inicial: payload.data_saldo_inicial || new Date().toISOString().slice(0, 10),
        saldo_inicial_configurado: payload.saldo_inicial_configurado ? 1 : 1,
        atualizado_em: new Date().toISOString(),
      }], 'id_conta');
      return { ...payload, id_conta: id };
    }
  }

  return payload;
}

const originalGet = api.get.bind(api);
const originalPost = api.post.bind(api);
const originalPut = api.put.bind(api);
const originalDelete = api.delete.bind(api);

api.get = async (url, config = {}) => {
  const params = typeof config === 'object' && config !== null ? config.params || parseQueryParams(url) : parseQueryParams(url);
  const localResult = await getLocalDataForRoute(url, params);

  if (localResult !== null) {
    void originalGet(url, config)
      .then((remote) => {
        if (remote?.data && typeof remote.data === 'object') {
          if (Array.isArray(remote.data)) {
            if (url.startsWith('/contas')) {
              return upsertLocalRows('conta_financeira', remote.data.map((item) => ({
                ...item,
                id_conta: item.id_conta || item.id,
                saldo_inicial_configurado: item.saldo_inicial_configurado ? 1 : 0,
              })), 'id_conta');
            }
            if (url.startsWith('/lancamentos')) {
              return upsertLocalRows('lancamento_financeiro', remote.data.map((item) => ({
                ...item,
                id_lancamento: item.id_lancamento || item.id,
                categoria_nome: item.categoria?.nome || item.categoria_nome || 'Sem categoria',
                conta_nome: item.conta_financeira?.nome || item.conta_nome || 'Conta não identificada',
              })), 'id_lancamento');
            }
            if (url.startsWith('/precos-medios')) {
              return upsertLocalRows('preco_mercado', remote.data.flatMap((produto) => (Array.isArray(produto.historico) ? produto.historico : []).map((item) => ({
                id_preco: item.id_preco || `${produto.nome}-${item.data_referencia}`,
                id_mei: 'mei_demo',
                nome_produto: produto.nome,
                unidade: produto.unidade,
                categoria: produto.categoria,
                valor: item.preco,
                data_referencia: item.data_referencia || item.mes,
                criado_em: item.data_referencia || new Date().toISOString().slice(0, 10),
                atualizado_em: new Date().toISOString(),
              }))), 'id_preco');
            }
            if (url.startsWith('/notas')) {
              return upsertLocalRows('nota_fiscal', remote.data.map((item) => ({ ...item, id_nota: item.id_nota || item.id })), 'id_nota');
            }
            if (url.startsWith('/alertas')) {
              return upsertLocalRows('alerta_financeiro', remote.data.map((item) => ({ ...item, id_alerta: item.id_alerta || item.id, ativo: item.ativo ? 1 : 0 })), 'id_alerta');
            }
          }
        }
        return null;
      })
      .catch(() => {});

    return { data: localResult, status: 200, fromCache: true };
  }

  try {
    return await originalGet(url, config);
  } catch (error) {
    console.warn(`Erro silencioso em ${url}:`, error.message || error);
    return { data: [], status: 200, fromCache: true };
  }
};

api.post = async (url, data, config = {}) => {
  const localResult = await persistLocalWrite(url, 'POST', data);
  void originalPost(url, data, config)
    .catch((error) => console.warn(`Erro silencioso em POST ${url}:`, error.message || error));
  return { data: localResult, status: 200, fromCache: true };
};

api.put = async (url, data, config = {}) => {
  const localResult = await persistLocalWrite(url, 'PUT', data);
  void originalPut(url, data, config)
    .catch((error) => console.warn(`Erro silencioso em PUT ${url}:`, error.message || error));
  return { data: localResult, status: 200, fromCache: true };
};

api.delete = async (url, config = {}) => {
  const localResult = await persistLocalWrite(url, 'DELETE', {});
  void originalDelete(url, config)
    .catch((error) => console.warn(`Erro silencioso em DELETE ${url}:`, error.message || error));
  return { data: localResult, status: 200, fromCache: true };
};

export default api;
