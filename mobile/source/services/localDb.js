import { open } from '@op-engineering/op-sqlite';
import felipeData from '../data/felipe-data.json';

const DB_NAME = 'valora_local.db';
let dbPromise = null;

const tableSchema = [
  `CREATE TABLE IF NOT EXISTS conta_financeira (
    id_conta TEXT PRIMARY KEY,
    id_mei TEXT,
    nome TEXT,
    saldo_inicial REAL DEFAULT 0,
    data_saldo_inicial TEXT,
    saldo_inicial_configurado INTEGER DEFAULT 0,
    criado_em TEXT,
    atualizado_em TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS lancamento_financeiro (
    id_lancamento TEXT PRIMARY KEY,
    id_mei TEXT,
    tipo TEXT,
    valor REAL,
    data_lancamento TEXT,
    descricao TEXT,
    id_categoria TEXT,
    id_conta TEXT,
    classificacao_dre TEXT,
    categoria_nome TEXT,
    conta_nome TEXT,
    criado_em TEXT,
    atualizado_em TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS preco_mercado (
    id_preco TEXT PRIMARY KEY,
    id_mei TEXT,
    nome_produto TEXT,
    unidade TEXT,
    categoria TEXT,
    valor REAL,
    data_referencia TEXT,
    criado_em TEXT,
    atualizado_em TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS nota_fiscal (
    id_nota TEXT PRIMARY KEY,
    id_mei TEXT,
    nome_cliente TEXT,
    data_venda TEXT,
    descricao TEXT,
    arquivo_url TEXT,
    arquivo_tipo TEXT,
    criado_em TEXT,
    atualizado_em TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS alerta_financeiro (
    id_alerta TEXT PRIMARY KEY,
    id_mei TEXT,
    tipo_alerta TEXT,
    descricao TEXT,
    valor_referencia REAL,
    ativo INTEGER DEFAULT 1,
    criado_em TEXT,
    atualizado_em TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS dispositivo_push (
    id_dispositivo TEXT PRIMARY KEY,
    id_mei TEXT,
    expo_push_token TEXT,
    atualizado_em TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS sync_meta (
    nome_tabela TEXT PRIMARY KEY,
    ultima_sincronizacao TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS categoria (
    id_categoria TEXT PRIMARY KEY,
    nome TEXT,
    tipo TEXT,
    descricao TEXT
  );`,
];

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export async function getDb() {
  if (dbPromise) return dbPromise;

  dbPromise = open({
    name: DB_NAME,
    location: 'default',
  });

  const db = await dbPromise;
  await db.executeAsync('PRAGMA foreign_keys = ON;');
  for (const query of tableSchema) {
    await db.executeAsync(query);
  }

  return db;
}

function normalizarId(item, fallbackPrefix) {
  const id = item?.id_conta || item?.id_lancamento || item?.id_preco || item?.id_nota || item?.id_alerta || item?.id_dispositivo || item?.id;
  return id || createId(fallbackPrefix);
}

async function ensureSeeded() {
  const db = await getDb();
  const { rows: importacaoExistente } = await db.executeAsync(
    "SELECT nome_tabela FROM sync_meta WHERE nome_tabela = 'felipe_data_import_v1';",
  );

  if (!importacaoExistente?.length) {
    await upsertLocalRows(
      'categoria',
      felipeData.categorias.map((item) => ({
        id_categoria: item.id_categoria,
        nome: item.nome,
        tipo: item.tipo,
        descricao: item.descricao || '',
      })),
      'id_categoria',
    );
    await upsertLocalRows(
      'conta_financeira',
      felipeData.contas.map((item) => ({
        ...item,
        saldo_inicial_configurado: item.saldo_inicial_configurado ? 1 : 0,
      })),
      'id_conta',
    );
    await upsertLocalRows(
      'lancamento_financeiro',
      felipeData.lancamentos,
      'id_lancamento',
    );
    await upsertLocalRows('preco_mercado', felipeData.precos, 'id_preco');
    await upsertLocalRows(
      'nota_fiscal',
      felipeData.notas.map((item) => ({
        id_nota: item.id_nota,
        id_mei: item.id_mei,
        nome_cliente: item.nome_cliente,
        data_venda: item.data_venda,
        descricao: item.descricao,
        arquivo_url: null,
        arquivo_tipo: item.arquivo_tipo,
        criado_em: item.criado_em,
      })),
      'id_nota',
    );
    await upsertLocalRows(
      'alerta_financeiro',
      felipeData.alertas.map((item) => ({
        ...item,
        ativo: item.ativo ? 1 : 0,
      })),
      'id_alerta',
    );
    await db.executeAsync(
      "INSERT OR REPLACE INTO sync_meta (nome_tabela, ultima_sincronizacao) VALUES ('felipe_data_import_v1', ?);",
      [new Date().toISOString()],
    );
    return;
  }

  const { rows } = await db.executeAsync('SELECT COUNT(*) AS total FROM conta_financeira;');
  const total = Number(rows?.[0]?.total || 0);

  if (total > 0) return;

  const hoje = new Date();
  const dataAtual = hoje.toISOString().slice(0, 10);
  const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 15).toISOString().slice(0, 10);

  const contas = [
    {
      id_conta: createId('conta'),
      id_mei: 'mei_demo',
      nome: 'Banco Itaú',
      saldo_inicial: 2500,
      data_saldo_inicial: mesAnterior,
      saldo_inicial_configurado: 1,
      criado_em: dataAtual,
      atualizado_em: dataAtual,
    },
    {
      id_conta: createId('conta'),
      id_mei: 'mei_demo',
      nome: 'Carteira',
      saldo_inicial: 850,
      data_saldo_inicial: mesAnterior,
      saldo_inicial_configurado: 1,
      criado_em: dataAtual,
      atualizado_em: dataAtual,
    },
  ];

  const lancamentos = [
    {
      id_lancamento: createId('lancamento'),
      id_mei: 'mei_demo',
      tipo: 'receita',
      valor: 4200,
      data_lancamento: dataAtual,
      descricao: 'Venda de serviços',
      id_categoria: 'cat_receita',
      id_conta: contas[0].id_conta,
      classificacao_dre: 'receita_bruta',
      categoria_nome: 'Receita principal',
      conta_nome: 'Banco Itaú',
      criado_em: dataAtual,
      atualizado_em: dataAtual,
    },
    {
      id_lancamento: createId('lancamento'),
      id_mei: 'mei_demo',
      tipo: 'despesa',
      valor: 620,
      data_lancamento: dataAtual,
      descricao: 'Internet e software',
      id_categoria: 'cat_despesa',
      id_conta: contas[1].id_conta,
      classificacao_dre: 'despesa_operacional',
      categoria_nome: 'Operação',
      conta_nome: 'Carteira',
      criado_em: dataAtual,
      atualizado_em: dataAtual,
    },
    {
      id_lancamento: createId('lancamento'),
      id_mei: 'mei_demo',
      tipo: 'custo',
      valor: 950,
      data_lancamento: dataAtual,
      descricao: 'Compra de material',
      id_categoria: 'cat_custo',
      id_conta: contas[1].id_conta,
      classificacao_dre: 'custo',
      categoria_nome: 'Custos',
      conta_nome: 'Carteira',
      criado_em: dataAtual,
      atualizado_em: dataAtual,
    },
  ];

  const precos = [
    {
      id_preco: createId('preco'),
      id_mei: 'mei_demo',
      nome_produto: 'Leite integral',
      unidade: 'Litro',
      categoria: 'Alimentação',
      valor: 6.4,
      data_referencia: dataAtual,
      criado_em: dataAtual,
      atualizado_em: dataAtual,
    },
    {
      id_preco: createId('preco'),
      id_mei: 'mei_demo',
      nome_produto: 'Arroz',
      unidade: 'Kg',
      categoria: 'Alimentação',
      valor: 9.8,
      data_referencia: dataAtual,
      criado_em: dataAtual,
      atualizado_em: dataAtual,
    },
  ];

  const notas = [
    {
      id_nota: createId('nota'),
      id_mei: 'mei_demo',
      nome_cliente: 'Cliente demo',
      data_venda: dataAtual,
      descricao: 'Venda de serviço teste',
      arquivo_url: 'https://example.com/demo.pdf',
      arquivo_tipo: 'pdf',
      criado_em: dataAtual,
      atualizado_em: dataAtual,
    },
  ];

  const alertas = [
    {
      id_alerta: createId('alerta'),
      id_mei: 'mei_demo',
      tipo_alerta: 'limite_despesa',
      descricao: 'Alerta de despesas',
      valor_referencia: 1500,
      ativo: 1,
      criado_em: dataAtual,
      atualizado_em: dataAtual,
    },
  ];

  await db.executeBatch([
    ['INSERT INTO conta_financeira (id_conta, id_mei, nome, saldo_inicial, data_saldo_inicial, saldo_inicial_configurado, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [contas[0].id_conta, contas[0].id_mei, contas[0].nome, contas[0].saldo_inicial, contas[0].data_saldo_inicial, contas[0].saldo_inicial_configurado, contas[0].criado_em, contas[0].atualizado_em]],
    ['INSERT INTO conta_financeira (id_conta, id_mei, nome, saldo_inicial, data_saldo_inicial, saldo_inicial_configurado, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [contas[1].id_conta, contas[1].id_mei, contas[1].nome, contas[1].saldo_inicial, contas[1].data_saldo_inicial, contas[1].saldo_inicial_configurado, contas[1].criado_em, contas[1].atualizado_em]],
    ['INSERT INTO lancamento_financeiro (id_lancamento, id_mei, tipo, valor, data_lancamento, descricao, id_categoria, id_conta, classificacao_dre, categoria_nome, conta_nome, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [lancamentos[0].id_lancamento, lancamentos[0].id_mei, lancamentos[0].tipo, lancamentos[0].valor, lancamentos[0].data_lancamento, lancamentos[0].descricao, lancamentos[0].id_categoria, lancamentos[0].id_conta, lancamentos[0].classificacao_dre, lancamentos[0].categoria_nome, lancamentos[0].conta_nome, lancamentos[0].criado_em, lancamentos[0].atualizado_em]],
    ['INSERT INTO lancamento_financeiro (id_lancamento, id_mei, tipo, valor, data_lancamento, descricao, id_categoria, id_conta, classificacao_dre, categoria_nome, conta_nome, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [lancamentos[1].id_lancamento, lancamentos[1].id_mei, lancamentos[1].tipo, lancamentos[1].valor, lancamentos[1].data_lancamento, lancamentos[1].descricao, lancamentos[1].id_categoria, lancamentos[1].id_conta, lancamentos[1].classificacao_dre, lancamentos[1].categoria_nome, lancamentos[1].conta_nome, lancamentos[1].criado_em, lancamentos[1].atualizado_em]],
    ['INSERT INTO lancamento_financeiro (id_lancamento, id_mei, tipo, valor, data_lancamento, descricao, id_categoria, id_conta, classificacao_dre, categoria_nome, conta_nome, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [lancamentos[2].id_lancamento, lancamentos[2].id_mei, lancamentos[2].tipo, lancamentos[2].valor, lancamentos[2].data_lancamento, lancamentos[2].descricao, lancamentos[2].id_categoria, lancamentos[2].id_conta, lancamentos[2].classificacao_dre, lancamentos[2].categoria_nome, lancamentos[2].conta_nome, lancamentos[2].criado_em, lancamentos[2].atualizado_em]],
    ['INSERT INTO preco_mercado (id_preco, id_mei, nome_produto, unidade, categoria, valor, data_referencia, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [precos[0].id_preco, precos[0].id_mei, precos[0].nome_produto, precos[0].unidade, precos[0].categoria, precos[0].valor, precos[0].data_referencia, precos[0].criado_em, precos[0].atualizado_em]],
    ['INSERT INTO preco_mercado (id_preco, id_mei, nome_produto, unidade, categoria, valor, data_referencia, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [precos[1].id_preco, precos[1].id_mei, precos[1].nome_produto, precos[1].unidade, precos[1].categoria, precos[1].valor, precos[1].data_referencia, precos[1].criado_em, precos[1].atualizado_em]],
    ['INSERT INTO nota_fiscal (id_nota, id_mei, nome_cliente, data_venda, descricao, arquivo_url, arquivo_tipo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [notas[0].id_nota, notas[0].id_mei, notas[0].nome_cliente, notas[0].data_venda, notas[0].descricao, notas[0].arquivo_url, notas[0].arquivo_tipo, notas[0].criado_em, notas[0].atualizado_em]],
    ['INSERT INTO alerta_financeiro (id_alerta, id_mei, tipo_alerta, descricao, valor_referencia, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [alertas[0].id_alerta, alertas[0].id_mei, alertas[0].tipo_alerta, alertas[0].descricao, alertas[0].valor_referencia, alertas[0].ativo, alertas[0].criado_em, alertas[0].atualizado_em]],
  ]);
}

export async function initializeLocalDatabase() {
  const db = await getDb();
  await ensureSeeded();
  return db;
}

export async function getLocalRows(tableName, orderBy = 'criado_em') {
  const db = await getDb();
  const query = `SELECT * FROM ${tableName} ORDER BY ${orderBy} DESC`;
  const { rows } = await db.executeAsync(query);
  return rows || [];
}

export async function upsertLocalRows(tableName, rows, idColumn) {
  const db = await getDb();
  if (!rows || rows.length === 0) return;

  const columnNames = Object.keys(rows[0]);
  const placeholders = columnNames.map(() => '?').join(', ');
  const updateSet = columnNames.filter((col) => col !== idColumn).map((col) => `${col} = excluded.${col}`).join(', ');

  const statements = rows.map((row) => {
    const values = columnNames.map((columnName) => row[columnName]);
    return [
      `INSERT INTO ${tableName} (${columnNames.join(', ')}) VALUES (${placeholders}) ON CONFLICT(${idColumn}) DO UPDATE SET ${updateSet}`,
      values,
    ];
  });

  await db.executeBatch(statements);
}

export async function removeLocalRow(tableName, idColumn, idValue) {
  const db = await getDb();
  await db.executeAsync(`DELETE FROM ${tableName} WHERE ${idColumn} = ?`, [idValue]);
}

export function safeNumeric(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function makeRecordId(row, fallbackPrefix) {
  return normalizarId(row, fallbackPrefix);
}
