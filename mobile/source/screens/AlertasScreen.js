import { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, StatusBar,
  Animated, Modal, TouchableWithoutFeedback, Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from '../utils/money';

const AZUL     = '#2660A4';
const AZUL_BG  = '#EDF7F6';
const AMBAR    = '#ECA400';
const AMBAR_BG = '#FFF8E6';
const VERDE    = '#23967F';
const PRETO    = '#050505';

export default function AlertasScreen({ navigation }) { // FIX: recebe navigation
  const [alertas, setAlertas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [tipoAlerta, setTipoAlerta] = useState('limite_despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [formAberto, setFormAberto] = useState(false);
  const [notificacoesNovas, setNotificacoesNovas] = useState([]);
  const [menuAberto, setMenuAberto] = useState(null);

  const slideAnim = useRef(new Animated.Value(300)).current;
  const formAnim  = useRef(new Animated.Value(0)).current;

  async function carregar() {
    setCarregando(true);
    try {
      const { data } = await api.get('/alertas');
      setAlertas(data);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar alertas.');
    } finally {
      setCarregando(false);
    }
  }

  async function verificarAlertas() {
    try {
      const { data } = await api.post('/alertas/verificar');
      if (data.notificacoes_geradas > 0) setNotificacoesNovas(data.notificacoes);
    } catch (err) {
      console.warn('Verificação de alertas falhou:', err);
    }
  }

  useFocusEffect(useCallback(() => {
    carregar();
    verificarAlertas();
  }, []));

  function toggleForm() {
    if (formAberto) {
      Animated.timing(formAnim, { toValue: 0, duration: 200, useNativeDriver: false })
        .start(() => setFormAberto(false));
    } else {
      setFormAberto(true);
      Animated.spring(formAnim, { toValue: 1, useNativeDriver: false, bounciness: 4 }).start();
    }
  }

  function abrirMenu(id) {
    setMenuAberto(id);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  }

  function fecharMenu() {
    Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true })
      .start(() => setMenuAberto(null));
  }

  // FIX: descrição padrão agora depende do tipo de alerta escolhido
  function descricaoPadrao(tipo) {
    return tipo === 'limite_faturamento'
      ? 'Alerta de teto de faturamento MEI'
      : 'Alerta de limite de despesas';
  }

  function selecionarTipo(tipo) {
    setTipoAlerta(tipo);
    // FIX: o valor de referência continua sendo o teto ANUAL (ex: 81000),
    // a divisão mensal é feita no backend na hora de verificar.
    if (tipo === 'limite_faturamento' && !valor) {
      setValor('81000,00');
    }
  }

  async function criarAlerta() {
    if (!valor) return Alert.alert('Atenção', 'Informe um valor limite.');
    setSalvando(true);
    try {
      await api.post('/alertas', {
        tipo_alerta: tipoAlerta,
        descricao: descricao.trim() || descricaoPadrao(tipoAlerta),
        valor_referencia: parseCurrencyInput(valor),
      });
      setDescricao(''); setValor(''); setTipoAlerta('limite_despesa');
      toggleForm(); carregar();
    } catch {
      Alert.alert('Erro', 'Não foi possível criar o alerta.');
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAlerta(id, ativo) {
    fecharMenu();
    setAlertas(prev => prev.map(a => a.id_alerta === id ? { ...a, ativo: !a.ativo } : a));
    try {
      await api.patch(`/alertas/${id}/ativar-desativar`);
    } catch {
      setAlertas(prev => prev.map(a => a.id_alerta === id ? { ...a, ativo } : a));
      Alert.alert('Erro', 'Não foi possível alterar o alerta.');
    }
  }

  async function excluirAlerta(id) {
    fecharMenu();
    Alert.alert('Excluir alerta', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: async () => {
          setAlertas(prev => prev.filter(a => a.id_alerta !== id));
          try { await api.delete(`/alertas/${id}`); }
          catch { Alert.alert('Erro', 'Não foi possível excluir.'); carregar(); }
        },
      },
    ]);
  }

  function dispensarNotificacao(id) {
    setNotificacoesNovas(prev => prev.filter(n => n.id_notificacao !== id));
    api.patch(`/alertas/notificacoes/${id}/lida`).catch(() => {});
  }

  function dispensarTodasNotificacoes() {
    notificacoesNovas.forEach(n =>
      api.patch(`/alertas/notificacoes/${n.id_notificacao}/lida`).catch(() => {})
    );
    setNotificacoesNovas([]);
  }

  const ativos   = alertas.filter(a => a.ativo);
  const inativos = alertas.filter(a => !a.ativo);
  const alertaSelecionado = alertas.find(a => a.id_alerta === menuAberto);

  // FIX: rótulo amigável do tipo de alerta pra mostrar no card da lista
  function labelTipo(tipo) {
    return tipo === 'limite_faturamento' ? 'Faturamento (MEI)' : 'Despesas';
  }

  function renderAlerta({ item }) {
    return (
      <View style={[s.item, !item.ativo && s.itemInativo]}>
        <View style={[s.itemAccent, { backgroundColor: item.ativo ? AMBAR : '#CBD5E1' }]} />
        <View style={s.itemIconeWrap}>
          <View style={[s.itemIconeBox, { backgroundColor: item.ativo ? AMBAR_BG : '#F1F5F9' }]}>
            <View style={[s.bellIcon, { borderColor: item.ativo ? AMBAR : '#94A3B8' }]}>
              <View style={[s.bellDot, { backgroundColor: item.ativo ? AMBAR : '#94A3B8' }]} />
            </View>
          </View>
        </View>
        <View style={s.itemConteudo}>
          <Text style={[s.itemDesc, !item.ativo && { color: '#94A3B8' }]} numberOfLines={1}>
            {item.descricao}
          </Text>
          <Text style={s.itemTipo}>{labelTipo(item.tipo_alerta)}</Text>
          <Text style={[s.itemLimite, { color: item.ativo ? AMBAR : '#94A3B8' }]}>
            Limite: {formatCurrency(item.valor_referencia)}
          </Text>
        </View>
        <View style={s.itemDireita}>
          <View style={[s.statusPill, { backgroundColor: item.ativo ? AMBAR_BG : '#F1F5F9' }]}>
            <View style={[s.statusDot, { backgroundColor: item.ativo ? VERDE : '#CBD5E1' }]} />
            <Text style={[s.statusTexto, { color: item.ativo ? '#92400E' : '#94A3B8' }]}>
              {item.ativo ? 'Ativo' : 'Inativo'}
            </Text>
          </View>
          <TouchableOpacity
            style={s.menuBotao}
            onPress={() => abrirMenu(item.id_alerta)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={s.dot} /><View style={s.dot} /><View style={s.dot} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.container}>

        <View style={s.header}>
          {/* FIX: linha do topo com botão de voltar + título */}
          <View style={s.headerTopo}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={s.voltarBotao}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.voltarSeta}>‹</Text>
            </TouchableOpacity>
            <Text style={s.headerTitulo}>Alertas</Text>
          </View>
          <Text style={s.headerSub}>
            {alertas.length === 0
              ? 'Nenhum alerta configurado'
              : `${ativos.length} ativo${ativos.length !== 1 ? 's' : ''} · ${inativos.length} inativo${inativos.length !== 1 ? 's' : ''}`}
          </Text>
        </View>

        <FlatList
          data={alertas}
          keyExtractor={item => String(item.id_alerta)}
          contentContainerStyle={s.lista}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {notificacoesNovas.length > 0 && (
                <View style={s.notifBanner}>
                  <View style={s.notifBannerTopo}>
                    <View style={s.notifBannerEsquerda}>
                      <View style={s.notifIcone} />
                      <Text style={s.notifBannerTitulo}>
                        {notificacoesNovas.length} alerta{notificacoesNovas.length !== 1 ? 's' : ''} disparado{notificacoesNovas.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={dispensarTodasNotificacoes}>
                      <Text style={s.notifDescartar}>Limpar</Text>
                    </TouchableOpacity>
                  </View>
                  {notificacoesNovas.map(notif => (
                    <View key={notif.id_notificacao} style={s.notifItem}>
                      <Text style={s.notifItemTexto} numberOfLines={3}>{notif.mensagem}</Text>
                      <TouchableOpacity onPress={() => dispensarNotificacao(notif.id_notificacao)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={s.notifItemX}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {alertas.length > 0 && (
                <View style={s.statsRow}>
                  <View style={[s.statCard, { borderLeftColor: AMBAR }]}>
                    <Text style={[s.statValor, { color: AMBAR }]}>{ativos.length}</Text>
                    <Text style={s.statLabel}>Ativos</Text>
                  </View>
                  <View style={[s.statCard, { borderLeftColor: '#CBD5E1' }]}>
                    <Text style={[s.statValor, { color: '#94A3B8' }]}>{inativos.length}</Text>
                    <Text style={s.statLabel}>Inativos</Text>
                  </View>
                  <View style={[s.statCard, { borderLeftColor: AZUL }]}>
                    <Text style={[s.statValor, { color: AZUL }]}>{alertas.length}</Text>
                    <Text style={s.statLabel}>Total</Text>
                  </View>
                </View>
              )}

              {formAberto && (
                <Animated.View style={[s.form, { opacity: formAnim }]}>
                  <Text style={s.formTitulo}>Novo alerta</Text>
                  <Text style={s.formDesc}>
                    {tipoAlerta === 'limite_faturamento'
                      ? 'Você será notificado mensalmente se o ritmo do seu faturamento no ano estiver acima do esperado para não estourar o teto do MEI.'
                      : 'Você será notificado quando suas despesas do mês ultrapassarem o valor definido.'}
                  </Text>

                  <Text style={s.fieldLabel}>Tipo de alerta</Text>
                  <View style={s.tipoRow}>
                    <TouchableOpacity
                      style={[s.tipoBotao, tipoAlerta === 'limite_despesa' && s.tipoBotaoAtivo]}
                      onPress={() => selecionarTipo('limite_despesa')}
                    >
                      <Text style={tipoAlerta === 'limite_despesa' ? s.tipoTextoAtivo : s.tipoTexto}>
                        Limite de despesas
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.tipoBotao, tipoAlerta === 'limite_faturamento' && s.tipoBotaoAtivo]}
                      onPress={() => selecionarTipo('limite_faturamento')}
                    >
                      <Text style={tipoAlerta === 'limite_faturamento' ? s.tipoTextoAtivo : s.tipoTexto}>
                        Faturamento (MEI)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={s.fieldLabel}>Descrição <Text style={s.opcional}>(opcional)</Text></Text>
                  <TextInput
                    style={s.input}
                    placeholder={tipoAlerta === 'limite_faturamento' ? 'Ex: Teto anual MEI' : 'Ex: Limite mensal de gastos'}
                    placeholderTextColor="#CBD5E1"
                    value={descricao}
                    onChangeText={setDescricao}
                  />
                  <Text style={s.fieldLabel}>
                    {tipoAlerta === 'limite_faturamento' ? 'Teto anual de faturamento' : 'Limite de despesas'}
                  </Text>
                  <View style={s.valorBox}>
                    <Text style={s.valorCifrao}>R$</Text>
                    <TextInput
                      style={s.valorInput}
                      placeholder="0,00"
                      placeholderTextColor="#CBD5E1"
                      value={valor}
                      onChangeText={v => setValor(formatCurrencyInput(v))}
                      keyboardType="numeric"
                    />
                  </View>
                  <TouchableOpacity
                    style={[s.botaoCriar, salvando && { opacity: 0.6 }]}
                    onPress={criarAlerta}
                    disabled={salvando}
                  >
                    {salvando
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={s.botaoCriarTexto}>Criar alerta</Text>
                    }
                  </TouchableOpacity>
                </Animated.View>
              )}

              {alertas.length > 0 && <Text style={s.listaLabel}>Seus alertas</Text>}
            </>
          }

          ListEmptyComponent={
            !carregando ? (
              <View style={s.vazio}>
                <View style={s.vazioIconeCircle}>
                  <View style={s.vazioIconeBell} />
                </View>
                <Text style={s.vazioTitulo}>Nenhum alerta configurado</Text>
                <Text style={s.vazioDesc}>
                  Crie um alerta para ser notificado quando suas despesas ou seu faturamento ultrapassarem um limite definido por você.
                </Text>
                <TouchableOpacity style={s.botaoCriarVazio} onPress={toggleForm}>
                  <Text style={s.botaoCriarVazioTexto}>Criar primeiro alerta</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }

          renderItem={renderAlerta}
        />

        <TouchableOpacity
          style={[s.fab, formAberto && s.fabCancelar]}
          onPress={toggleForm}
        >
          <Text style={s.fabTexto}>{formAberto ? 'Cancelar' : '+ Novo alerta'}</Text>
        </TouchableOpacity>

        {carregando && <ActivityIndicator color={AZUL} style={s.loader} size="large" />}
      </View>

      <Modal visible={menuAberto !== null} transparent animationType="none">
        <TouchableWithoutFeedback onPress={fecharMenu}>
          <View style={s.overlay}>
            <TouchableWithoutFeedback>
              <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
                <View style={s.sheetHandle} />
                {alertaSelecionado && (
                  <>
                    <View style={s.sheetInfo}>
                      <View style={[s.sheetIconeBox, { backgroundColor: alertaSelecionado.ativo ? AMBAR_BG : '#F1F5F9' }]}>
                        <View style={[s.bellIcon, { borderColor: alertaSelecionado.ativo ? AMBAR : '#94A3B8' }]}>
                          <View style={[s.bellDot, { backgroundColor: alertaSelecionado.ativo ? AMBAR : '#94A3B8' }]} />
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.sheetDescricao} numberOfLines={1}>{alertaSelecionado.descricao}</Text>
                        <Text style={[s.sheetLimite, { color: AMBAR }]}>
                          Limite: {formatCurrency(alertaSelecionado.valor_referencia)}
                        </Text>
                      </View>
                    </View>
                    <View style={s.sheetDivisor} />
                  </>
                )}

                {alertaSelecionado && (
                  <Pressable
                    style={({ pressed }) => [
                      s.sheetOpcao,
                      { backgroundColor: alertaSelecionado.ativo ? '#ECFDF5' : AMBAR_BG },
                      pressed && { opacity: 0.75 }
                    ]}
                    onPress={() => toggleAlerta(menuAberto, alertaSelecionado.ativo)}
                  >
                    <View style={[s.sheetOpcaoIconeBox, {
                      backgroundColor: alertaSelecionado.ativo ? '#D1FAE5' : '#FEF3C7'
                    }]}>
                      <View style={[s.sheetOpcaoIconeDot, {
                        backgroundColor: alertaSelecionado.ativo ? VERDE : AMBAR
                      }]} />
                    </View>
                    <View>
                      <Text style={[s.sheetOpcaoTexto, {
                        color: alertaSelecionado.ativo ? VERDE : AMBAR
                      }]}>
                        {alertaSelecionado.ativo ? 'Desativar alerta' : 'Ativar alerta'}
                      </Text>
                      <Text style={s.sheetOpcaoSub}>
                        {alertaSelecionado.ativo ? 'Pausar notificações temporariamente' : 'Retomar notificações'}
                      </Text>
                    </View>
                  </Pressable>
                )}

                <Pressable
                  style={({ pressed }) => [s.sheetOpcao, { backgroundColor: '#FFF5F5', marginTop: 8 }, pressed && { opacity: 0.75 }]}
                  onPress={() => excluirAlerta(menuAberto)}
                >
                  <View style={[s.sheetOpcaoIconeBox, { backgroundColor: '#FEE2E2' }]}>
                    <View style={s.sheetOpcaoIconeMenos} />
                  </View>
                  <View>
                    <Text style={[s.sheetOpcaoTexto, { color: '#DC2626' }]}>Excluir alerta</Text>
                    <Text style={s.sheetOpcaoSub}>Esta ação não pode ser desfeita</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [s.sheetCancelar, pressed && { opacity: 0.75 }]}
                  onPress={fecharMenu}
                >
                  <Text style={s.sheetCancelarTexto}>Cancelar</Text>
                </Pressable>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EDF7F6' },
  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 24) + 12,
    paddingBottom: 20, paddingHorizontal: 24,
    borderBottomWidth: 1, borderColor: '#E2E8F0',
  },
  // FIX: novos estilos do botão de voltar
  headerTopo: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  voltarBotao: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  voltarSeta: { fontSize: 22, color: PRETO, fontWeight: '600', marginTop: -2 },
  headerTitulo: { fontSize: 26, fontWeight: 'bold', color: PRETO },
  headerSub: { fontSize: 13, color: '#94A3B8', marginTop: 4 },
  lista: { padding: 16, paddingBottom: 100 },
  loader: { marginTop: 60 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14,
    padding: 14, borderLeftWidth: 3,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  statValor: { fontSize: 22, fontWeight: 'bold', marginBottom: 2 },
  statLabel: { fontSize: 12, color: '#64748B' },
  notifBanner: {
    backgroundColor: AMBAR_BG, borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A',
  },
  notifBannerTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  notifBannerEsquerda: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifIcone: { width: 8, height: 8, borderRadius: 999, backgroundColor: AMBAR },
  notifBannerTitulo: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  notifDescartar: { fontSize: 13, color: '#B45309', fontWeight: '600' },
  notifItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6, gap: 8,
  },
  notifItemTexto: { flex: 1, fontSize: 13, color: '#78350F', lineHeight: 18 },
  notifItemX: { fontSize: 18, color: '#B45309', fontWeight: '400', lineHeight: 20 },
  form: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  formTitulo: { fontSize: 16, fontWeight: '700', color: PRETO, marginBottom: 4 },
  formDesc: { fontSize: 13, color: '#64748B', marginBottom: 20, lineHeight: 19 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  opcional: { fontSize: 12, color: '#94A3B8', fontWeight: '400' },
  tipoRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tipoBotao: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center',
  },
  tipoBotaoAtivo: { borderColor: AZUL, backgroundColor: AZUL_BG },
  tipoTexto: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  tipoTextoAtivo: { fontSize: 13, fontWeight: '700', color: AZUL },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0',
    borderRadius: 12, padding: 14, fontSize: 15, color: PRETO, marginBottom: 16,
  },
  valorBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 12,
    borderWidth: 1.5, borderColor: AMBAR,
    paddingHorizontal: 16, marginBottom: 16,
  },
  valorCifrao: { fontSize: 16, fontWeight: '700', color: AMBAR, marginRight: 8 },
  valorInput: { flex: 1, fontSize: 26, fontWeight: 'bold', paddingVertical: 14, color: PRETO },
  botaoCriar: { backgroundColor: AZUL, borderRadius: 12, padding: 16, alignItems: 'center' },
  botaoCriarTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  listaLabel: {
    fontSize: 12, fontWeight: '700', color: '#94A3B8',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, marginTop: 4,
  },
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 16, marginBottom: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  itemInativo: { opacity: 0.55 },
  itemAccent: { width: 4, alignSelf: 'stretch' },
  itemIconeWrap: { paddingLeft: 14, paddingVertical: 14 },
  itemIconeBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bellIcon: {
    width: 18, height: 16, borderWidth: 2, borderRadius: 8,
    borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 1,
  },
  bellDot: { width: 4, height: 4, borderRadius: 999, marginBottom: -3 },
  itemConteudo: { flex: 1, paddingHorizontal: 12, paddingVertical: 14 },
  itemDesc: { fontSize: 14, fontWeight: '600', color: PRETO, marginBottom: 3 },
  itemTipo: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 3 },
  itemLimite: { fontSize: 13, fontWeight: '700' },
  itemDireita: { paddingRight: 8, alignItems: 'flex-end', gap: 8 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  statusTexto: { fontSize: 11, fontWeight: '700' },
  menuBotao: { padding: 8, gap: 3, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: 999, backgroundColor: '#CBD5E1' },
  fab: {
    position: 'absolute', bottom: 24, left: 24, right: 24,
    backgroundColor: AZUL, borderRadius: 14, padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 5,
  },
  fabCancelar: { backgroundColor: '#64748B' },
  fabTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  vazio: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  vazioIconeCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: AMBAR_BG,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  vazioIconeBell: {
    width: 28, height: 24, borderWidth: 3, borderColor: AMBAR,
    borderRadius: 12, borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
  },
  vazioTitulo: { fontSize: 18, fontWeight: '700', color: PRETO, marginBottom: 10 },
  vazioDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  botaoCriarVazio: { backgroundColor: AZUL, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  botaoCriarVazioTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 999,
    backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 20,
  },
  sheetInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  sheetIconeBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sheetDescricao: { fontSize: 15, fontWeight: '700', color: PRETO },
  sheetLimite: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  sheetDivisor: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 12 },
  sheetOpcao: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14 },
  sheetOpcaoIconeBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sheetOpcaoIconeDot: { width: 14, height: 14, borderRadius: 999 },
  sheetOpcaoIconeMenos: { width: 14, height: 3, borderRadius: 999, backgroundColor: '#DC2626' },
  sheetOpcaoTexto: { fontSize: 15, fontWeight: '700' },
  sheetOpcaoSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  sheetCancelar: {
    padding: 16, borderRadius: 14, backgroundColor: '#F8FAFC',
    alignItems: 'center', marginTop: 8,
  },
  sheetCancelarTexto: { fontSize: 15, fontWeight: '600', color: '#64748B' },
});