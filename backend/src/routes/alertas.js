const express = require('express');
const supabase = require('../config/supabase');
const { autenticar } = require('../middleware/auth');
const { enviarPush } = require('../utils/expoPush');

const router = express.Router();

const formatarMoeda = (valor) =>
  `R$ ${Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ─────────────────────────────────────────
// Lógica central de verificação de alertas.
// Reaproveitada pela rota /verificar (manual,
// chamada pelo app) e pela rota /cron/verificar-alertas
// (automática, chamada por um agendador externo).
// ─────────────────────────────────────────
async function verificarAlertasDoMei(id_mei) {
  const { data: alertas } = await supabase
    .from('alerta_financeiro')
    .select('*')
    .eq('id_mei', id_mei)
    .eq('ativo', true);

  if (!alertas || alertas.length === 0) {
    return { alertas_verificados: 0, notificacoes_geradas: 0, notificacoes: [] };
  }

  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1; // 1-12
  const inicioMes = `${hoje.getFullYear()}-${String(mesAtual).padStart(2, '0')}-01`;
  const inicioAno = `${hoje.getFullYear()}-01-01`;

  // FIX: uma única query cobre o ano inteiro (usada tanto pro total do mês quanto do ano)
  const { data: lancamentosAno } = await supabase
    .from('lancamento_financeiro')
    .select('valor, tipo, data_lancamento')
    .eq('id_mei', id_mei)
    .gte('data_lancamento', inicioAno);

  const totalDespesasMes = (lancamentosAno || [])
    .filter((l) => l.tipo === 'despesa' && l.data_lancamento >= inicioMes)
    .reduce((acc, l) => acc + parseFloat(l.valor), 0);

  const totalFaturamentoAno = (lancamentosAno || [])
    .filter((l) => l.tipo === 'receita')
    .reduce((acc, l) => acc + parseFloat(l.valor), 0);

  const notificacoesGeradas = [];

  for (const alerta of alertas) {
    let disparar = false;
    let mensagem = '';
    // FIX: duplicidade checada por MÊS — permite disparar de novo no mês seguinte
    const referenciaPeriodo = inicioMes;

    if (alerta.tipo_alerta === 'limite_despesa') {
      if (totalDespesasMes >= alerta.valor_referencia) {
        disparar = true;
        mensagem = `⚠️ Suas despesas esse mês atingiram ${formatarMoeda(totalDespesasMes)}, ultrapassando o limite de ${formatarMoeda(alerta.valor_referencia)}.`;
      }
    }

    // FIX: novo tipo — teto anual do MEI, verificado proporcionalmente por mês
    if (alerta.tipo_alerta === 'limite_faturamento') {
      const cotaMensal = alerta.valor_referencia / 12;
      const cotaAcumulada = cotaMensal * mesAtual;

      if (totalFaturamentoAno >= cotaAcumulada) {
        disparar = true;
        const percentualDoTeto = (totalFaturamentoAno / alerta.valor_referencia) * 100;
        const projecaoAnual = (totalFaturamentoAno / mesAtual) * 12;

        mensagem = `📊 Até o mês ${mesAtual}, seu faturamento acumulado é ${formatarMoeda(totalFaturamentoAno)} (${percentualDoTeto.toFixed(0)}% do teto anual do MEI de ${formatarMoeda(alerta.valor_referencia)}). No ritmo atual, projeção de fechamento do ano: ${formatarMoeda(projecaoAnual)}.`;
      }
    }

    if (!disparar) continue;

    // não duplica notificação não lida no mesmo período
    const { data: jaExiste } = await supabase
      .from('notificacao')
      .select('id_notificacao')
      .eq('id_alerta', alerta.id_alerta)
      .eq('lida', false)
      .gte('enviado_em', referenciaPeriodo)
      .maybeSingle();

    if (jaExiste) continue;

    const { data: notif } = await supabase
      .from('notificacao')
      .insert({ id_alerta: alerta.id_alerta, mensagem })
      .select()
      .single();

    notificacoesGeradas.push(notif);
  }

  // FIX: envia push para os dispositivos do MEI se alguma notificação foi gerada
  if (notificacoesGeradas.length > 0) {
    const { data: dispositivos } = await supabase
      .from('dispositivo_push')
      .select('expo_push_token')
      .eq('id_mei', id_mei);

    const tokens = (dispositivos || []).map((d) => d.expo_push_token);

    for (const notif of notificacoesGeradas) {
      await enviarPush(tokens, 'Alerta financeiro', notif.mensagem, {
        id_alerta: notif.id_alerta,
        id_notificacao: notif.id_notificacao,
      });
    }
  }

  return {
    alertas_verificados: alertas.length,
    notificacoes_geradas: notificacoesGeradas.length,
    notificacoes: notificacoesGeradas,
  };
}

router.use(autenticar);

// ─────────────────────────────────────────
// GET /alertas
// ─────────────────────────────────────────
router.get('/', async (req, res) => {
  const id_mei = req.usuario.id_mei;
  try {
    const { data, error } = await supabase
      .from('alerta_financeiro')
      .select('*')
      .eq('id_mei', id_mei)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao listar alertas.' });
  }
});

// ─────────────────────────────────────────
// POST /alertas
// ─────────────────────────────────────────
router.post('/', async (req, res) => {
  const { tipo_alerta, descricao, valor_referencia } = req.body;
  const id_mei = req.usuario.id_mei;

  if (!tipo_alerta) {
    return res.status(400).json({ erro: 'tipo_alerta é obrigatório.' });
  }

  // FIX: tipo_alerta precisa ser um dos suportados
  const TIPOS_VALIDOS = ['limite_despesa', 'limite_faturamento'];
  if (!TIPOS_VALIDOS.includes(tipo_alerta)) {
    return res.status(400).json({ erro: `tipo_alerta deve ser um de: ${TIPOS_VALIDOS.join(', ')}.` });
  }

  if (
    valor_referencia === undefined ||
    valor_referencia === null ||
    isNaN(Number(valor_referencia)) ||
    Number(valor_referencia) <= 0
  ) {
    return res.status(400).json({ erro: 'valor_referencia deve ser um número positivo.' });
  }

  const descricaoPadrao =
    tipo_alerta === 'limite_faturamento'
      ? 'Alerta de teto de faturamento MEI'
      : 'Alerta de limite de despesas';

  try {
    const { data, error } = await supabase
      .from('alerta_financeiro')
      .insert({
        id_mei,
        tipo_alerta,
        descricao: descricao?.trim() || descricaoPadrao,
        valor_referencia: Number(valor_referencia),
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao criar alerta.' });
  }
});

// ─────────────────────────────────────────
// ROTAS ESTÁTICAS — devem vir ANTES de /:id
// ─────────────────────────────────────────

// GET /alertas/notificacoes
router.get('/notificacoes', async (req, res) => {
  const id_mei = req.usuario.id_mei;
  const { lida } = req.query;

  try {
    const { data: alertasDoMei } = await supabase
      .from('alerta_financeiro')
      .select('id_alerta')
      .eq('id_mei', id_mei);

    const ids = alertasDoMei.map((a) => a.id_alerta);
    if (ids.length === 0) return res.json([]);

    let query = supabase
      .from('notificacao')
      .select('*, alerta_financeiro(tipo_alerta, descricao)')
      .in('id_alerta', ids)
      .order('enviado_em', { ascending: false });

    if (lida !== undefined) query = query.eq('lida', lida === 'true');

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar notificações.' });
  }
});

// PATCH /alertas/notificacoes/:id/lida
router.patch('/notificacoes/:id/lida', async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('notificacao')
      .update({ lida: true })
      .eq('id_notificacao', id)
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao marcar notificação.' });
  }
});

// POST /alertas/verificar — chamado pelo app (useFocusEffect)
router.post('/verificar', async (req, res) => {
  const id_mei = req.usuario.id_mei;
  try {
    const resultado = await verificarAlertasDoMei(id_mei);
    return res.json(resultado);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao verificar alertas.' });
  }
});

// ─────────────────────────────────────────
// ROTAS DINÂMICAS — depois das estáticas
// ─────────────────────────────────────────

// PATCH /alertas/:id/ativar-desativar
router.patch('/:id/ativar-desativar', async (req, res) => {
  const { id } = req.params;
  const id_mei = req.usuario.id_mei;

  try {
    const { data: alerta } = await supabase
      .from('alerta_financeiro')
      .select('ativo')
      .eq('id_alerta', id)
      .eq('id_mei', id_mei)
      .single();

    if (!alerta) return res.status(404).json({ erro: 'Alerta não encontrado.' });

    const { data, error } = await supabase
      .from('alerta_financeiro')
      .update({ ativo: !alerta.ativo })
      .eq('id_alerta', id)
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao atualizar alerta.' });
  }
});

// DELETE /alertas/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const id_mei = req.usuario.id_mei;

  try {
    const { error } = await supabase
      .from('alerta_financeiro')
      .delete()
      .eq('id_alerta', id)
      .eq('id_mei', id_mei);

    if (error) throw error;
    return res.json({ mensagem: 'Alerta removido.' });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao remover alerta.' });
  }
});

module.exports = router;
module.exports.verificarAlertasDoMei = verificarAlertasDoMei;
