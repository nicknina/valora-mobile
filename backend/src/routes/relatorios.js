const express = require('express');
const supabase = require('../config/supabase');
const { autenticar } = require('../middleware/auth');
const buscarRegistrosPaginados = require('../utils/buscarRegistrosPaginados');

const router = express.Router();
router.use(autenticar);

// GET /relatorios/dre
router.get('/dre', async (req, res) => {
  const { data_inicio, data_fim } = req.query;
  const id_mei = req.usuario.id_mei;

  const dataValida = (data) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
    const dataConvertida = new Date(`${data}T00:00:00.000Z`);
    return !Number.isNaN(dataConvertida.getTime()) &&
      dataConvertida.toISOString().slice(0, 10) === data;
  };

  if (!data_inicio || !data_fim || !dataValida(data_inicio) || !dataValida(data_fim) || data_inicio > data_fim) {
    return res.status(400).json({ erro: 'Informe um período válido com data_inicio e data_fim (YYYY-MM-DD).' });
  }

  try {
    const lancamentos = await buscarRegistrosPaginados(() => supabase
      .from('lancamento_financeiro')
      .select('tipo, valor, classificacao_dre, categoria(nome)')
      .eq('id_mei', id_mei)
      .gte('data_lancamento', data_inicio)
      .lte('data_lancamento', data_fim)
      .order('id_lancamento'));

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
      const categoria = lancamento.categoria?.nome || 'Sem categoria';
      totais[classificacao] += valor;
      porCategoria[classificacao][categoria] =
        (porCategoria[classificacao][categoria] || 0) + valor;
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

    return res.json({
      periodo: { data_inicio, data_fim },
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
      margem_liquida_percentual: totais.receita_bruta
        ? arredondar((lucro_liquido / totais.receita_bruta) * 100)
        : 0,
      por_categoria: {
        deducoes_receita: detalhar(porCategoria.deducao_receita),
        custos: detalhar(porCategoria.custo),
        despesas_operacionais: detalhar(porCategoria.despesa_operacional),
        receitas_financeiras: detalhar(porCategoria.receita_financeira),
        despesas_financeiras: detalhar(porCategoria.despesa_financeira),
        impostos_sobre_lucro: detalhar(porCategoria.imposto_lucro),
      },
    });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao gerar DRE.' });
  }
});

// GET /relatorios/fluxo-de-caixa
router.get('/fluxo-de-caixa', async (req, res) => {
  const { data_inicio, data_fim } = req.query;
  const id_mei = req.usuario.id_mei;

  if (!data_inicio || !data_fim) {
    return res.status(400).json({ erro: 'Informe data_inicio e data_fim (YYYY-MM-DD).' });
  }

  try {
    const lancamentos = await buscarRegistrosPaginados(() => supabase
      .from('lancamento_financeiro')
      .select('tipo, valor, data_lancamento')
      .eq('id_mei', id_mei)
      .gte('data_lancamento', data_inicio)
      .lte('data_lancamento', data_fim)
      .order('id_lancamento'));

    const totais = { receita: 0, gasto: 0, investimento: 0, despesa: 0, custo: 0 };
    lancamentos.forEach((l) => {
      const valor = parseFloat(l.valor) || 0;
      const tipo = l.tipo === 'despesa' || l.tipo === 'custo' ? 'gasto' : l.tipo;
      totais[tipo] = (totais[tipo] || 0) + valor;
      if (l.tipo === 'despesa') totais.despesa += valor;
      if (l.tipo === 'custo') totais.custo += valor;
    });

    const saldo = totais.receita - totais.gasto - totais.investimento;

    const porMes = {};
    lancamentos.forEach((l) => {
      const mes = l.data_lancamento.substring(0, 7);
      if (!porMes[mes]) porMes[mes] = { receita: 0, gasto: 0, investimento: 0, despesa: 0, custo: 0 };
      const valor = parseFloat(l.valor) || 0;
      const tipo = l.tipo === 'despesa' || l.tipo === 'custo' ? 'gasto' : l.tipo;
      porMes[mes][tipo] = (porMes[mes][tipo] || 0) + valor;
      if (l.tipo === 'despesa') porMes[mes].despesa += valor;
      if (l.tipo === 'custo') porMes[mes].custo += valor;
    });

    const resultado = {
      periodo: { data_inicio, data_fim },
      totais,
      saldo,
      por_mes: Object.entries(porMes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mes, valores]) => ({ mes, ...valores })),
    };

    // FIX: salva histórico de forma assíncrona — não bloqueia nem quebra a resposta
    res.json(resultado);

    supabase.from('relatorio').insert({
      id_mei,
      tipo: 'fluxo_de_caixa',
      periodo_inicio: data_inicio,
      periodo_fim: data_fim,
      dados: resultado,
    }).then().catch((err) => console.warn('Erro ao salvar histórico de relatório:', err));

  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao gerar relatório.' });
  }
});

// GET /relatorios/por-categoria
router.get('/por-categoria', async (req, res) => {
  const { data_inicio, data_fim, tipo } = req.query;
  const id_mei = req.usuario.id_mei;

  if (!data_inicio || !data_fim) {
    return res.status(400).json({ erro: 'Informe data_inicio e data_fim.' });
  }

  try {
    let query = supabase
      .from('lancamento_financeiro')
      .select('valor, tipo, categoria(id_categoria, nome, tipo)')
      .eq('id_mei', id_mei)
      .gte('data_lancamento', data_inicio)
      .lte('data_lancamento', data_fim);

    if (tipo) query = query.eq('tipo', tipo);

    const { data: lancamentos, error } = await query;
    if (error) throw error;

    const agrupado = {};
    lancamentos.forEach((l) => {
      const cat = l.categoria?.nome || 'Sem categoria';
      if (!agrupado[cat]) agrupado[cat] = { total: 0, quantidade: 0 };
      agrupado[cat].total += parseFloat(l.valor);
      agrupado[cat].quantidade += 1;
    });

    const resultado = Object.entries(agrupado)
      .map(([categoria, dados]) => ({
        categoria,
        total: parseFloat(dados.total.toFixed(2)),
        quantidade: dados.quantidade,
      }))
      .sort((a, b) => b.total - a.total);

    return res.json({ periodo: { data_inicio, data_fim }, categorias: resultado });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao gerar relatório por categoria.' });
  }
});

// GET /relatorios/historico
router.get('/historico', async (req, res) => {
  const id_mei = req.usuario.id_mei;

  try {
    const { data, error } = await supabase
      .from('relatorio')
      .select('id_relatorio, tipo, periodo_inicio, periodo_fim, gerado_em')
      .eq('id_mei', id_mei)
      .order('gerado_em', { ascending: false });

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao listar relatórios.' });
  }
});

module.exports = router;