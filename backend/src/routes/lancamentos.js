const express = require('express');
const supabase = require('../config/supabase');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

const TIPOS_VALIDOS = ['receita', 'gasto', 'investimento', 'despesa', 'custo'];

function normalizarTipo(tipo) {
  return tipo === 'despesa' || tipo === 'custo' ? 'gasto' : tipo;
}

// GET /lancamentos
router.get('/', async (req, res) => {
  const { tipo, data_inicio, data_fim, id_categoria } = req.query;
  const id_mei = req.usuario.id_mei;

  try {
    let query = supabase
      .from('lancamento_financeiro')
      .select(`id_lancamento, tipo, valor, data_lancamento, descricao, criado_em,
        id_conta, classificacao_dre,
        categoria ( id_categoria, nome, tipo ),
        conta_financeira ( id_conta, nome )`)
      .eq('id_mei', id_mei)
      .order('data_lancamento', { ascending: false });

    if (tipo) query = query.eq('tipo', tipo);
    if (data_inicio) query = query.gte('data_lancamento', data_inicio);
    if (data_fim) query = query.lte('data_lancamento', data_fim);
    if (id_categoria) query = query.eq('id_categoria', id_categoria);

    const { data, error } = await query;
    if (error) throw error;

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao listar lançamentos.' });
  }
});

// GET /lancamentos/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const id_mei = req.usuario.id_mei;

  try {
    const { data, error } = await supabase
      .from('lancamento_financeiro')
      .select('*, categoria(*)')
      .eq('id_lancamento', id)
      .eq('id_mei', id_mei)
      .single();

    if (error || !data) return res.status(404).json({ erro: 'Lançamento não encontrado.' });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar lançamento.' });
  }
});

// POST /lancamentos
router.post('/', async (req, res) => {
  const {
    tipo,
    valor,
    data_lancamento,
    descricao,
    id_categoria,
    id_conta,
    classificacao_dre,
    parcelas,
  } = req.body;
  const id_mei = req.usuario.id_mei;

  if (!tipo || !valor || !data_lancamento) {
    return res.status(400).json({ erro: 'Campos obrigatórios: tipo, valor, data_lancamento.' });
  }

  const tipoNormalizado = normalizarTipo(tipo);
  if (!TIPOS_VALIDOS.includes(tipoNormalizado)) {
    return res.status(400).json({ erro: 'Tipo inválido. Use: receita, gasto, investimento, despesa ou custo.' });
  }
  if (!id_conta) {
    return res.status(400).json({ erro: 'Selecione uma conta válida.' });
  }

  try {
    const { data: conta, error: erroConta } = await supabase
      .from('conta_financeira')
      .select('id_conta')
      .eq('id_conta', id_conta)
      .eq('id_mei', id_mei)
      .maybeSingle();

    if (erroConta) throw erroConta;
    if (!conta) return res.status(400).json({ erro: 'Conta inválida.' });

    const parcelasTotais = Number(parcelas) > 1 ? Number(parcelas) : 1;
    const valorNumerico = Number(valor);
    const valorParcela = parcelasTotais > 1 ? Number((valorNumerico / parcelasTotais).toFixed(2)) : valorNumerico;

    const registros = [];
    for (let indice = 0; indice < parcelasTotais; indice += 1) {
      const dataParcela = new Date(`${data_lancamento}T12:00:00`);
      const dataMes = new Date(dataParcela.getFullYear(), dataParcela.getMonth() + indice, dataParcela.getDate());
      registros.push({
        id_mei,
        tipo: tipoNormalizado,
        valor: indice === parcelasTotais - 1 ? Number((valorNumerico - (valorParcela * (parcelasTotais - 1))).toFixed(2)) : valorParcela,
        data_lancamento: dataMes.toISOString().slice(0, 10),
        descricao,
        id_categoria,
        id_conta,
        classificacao_dre,
      });
    }

    const { data, error } = await supabase
      .from('lancamento_financeiro')
      .insert(registros)
      .select();

    if (error) throw error;
    return res.status(201).json(parcelasTotais > 1 ? data : data[0]);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao criar lançamento.' });
  }
});

// PUT /lancamentos/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const id_mei = req.usuario.id_mei;
  const {
    tipo,
    valor,
    data_lancamento,
    descricao,
    id_categoria,
    id_conta,
    classificacao_dre,
  } = req.body;

  try {
    const { data: existente } = await supabase
      .from('lancamento_financeiro')
      .select('id_lancamento')
      .eq('id_lancamento', id)
      .eq('id_mei', id_mei)
      .single();

    if (!existente) return res.status(404).json({ erro: 'Lançamento não encontrado.' });

    if (id_conta) {
      const { data: conta, error: erroConta } = await supabase
        .from('conta_financeira')
        .select('id_conta')
        .eq('id_conta', id_conta)
        .eq('id_mei', id_mei)
        .maybeSingle();

      if (erroConta) throw erroConta;
      if (!conta) return res.status(400).json({ erro: 'Conta inválida.' });
    }

    const tipoNormalizado = tipo ? normalizarTipo(tipo) : undefined;
    const { data, error } = await supabase
      .from('lancamento_financeiro')
      .update({
        tipo: tipoNormalizado ?? tipo,
        valor,
        data_lancamento,
        descricao,
        id_categoria,
        id_conta,
        classificacao_dre,
        atualizado_em: new Date(),
      })
      .eq('id_lancamento', id)
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao atualizar lançamento.' });
  }
});

// DELETE /lancamentos/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const id_mei = req.usuario.id_mei;

  try {
    const { data: existente } = await supabase
      .from('lancamento_financeiro')
      .select('id_lancamento')
      .eq('id_lancamento', id)
      .eq('id_mei', id_mei)
      .single();

    if (!existente) return res.status(404).json({ erro: 'Lançamento não encontrado.' });

    const { error } = await supabase
      .from('lancamento_financeiro')
      .delete()
      .eq('id_lancamento', id);

    if (error) throw error;
    return res.json({ mensagem: 'Lançamento excluído com sucesso.' });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao excluir lançamento.' });
  }
});

module.exports = router;