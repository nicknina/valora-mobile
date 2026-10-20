import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { PieChart } from 'react-native-chart-kit';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatCurrency } from '../utils/money';

const LARGURA = Dimensions.get('window').width;
const COR = '#0F766E';
const COR_BG = '#CCFBF1';
const COR_TEXTO = '#115E59';

const CATEGORIAS = [
  { key: 'receita', nome: 'Receitas', cor: '#16A34A', bg: '#DCFCE7', textoCor: '#166534' },
  { key: 'despesa', nome: 'Despesas', cor: '#DC2626', bg: '#FEE2E2', textoCor: '#991B1B' },
  { key: 'custo', nome: 'Custos', cor: '#9333EA', bg: '#F3E8FF', textoCor: '#6B21A8' },
  { key: 'investimento', nome: 'Investimentos', cor: '#CA8A04', bg: '#FEF3C7', textoCor: '#92400E' },
];

export default function HomeScreen({ navigation }) { // FIX: recebe navigation
  const { usuario, logout } = useAuth();
  const [resumo, setResumo] = useState(null);
  const [contas, setContas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);

      const hoje = new Date();
      const ano = hoje.getFullYear();
      const mes = String(hoje.getMonth() + 1).padStart(2, '0');
      const inicio = `${ano}-${mes}-01`;
      const ultimoDia = new Date(ano, hoje.getMonth() + 1, 0).getDate();
      const fim = `${ano}-${mes}-${ultimoDia}`;

      const [fluxo, respostaContas] = await Promise.all([
        api.get(`/relatorios/fluxo-de-caixa?data_inicio=${inicio}&data_fim=${fim}`),
        api.get('/contas'),
      ]);

      setResumo(fluxo.data);
      setContas(respostaContas.data);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const saldoPositivo = (resumo?.saldo ?? 0) >= 0;
  const saldoContas = contas.reduce(
    (total, conta) => total + Number(conta.saldo_atual || 0),
    0,
  );
  const saldoContasConfigurado =
    contas.length > 0 && contas.every((conta) => conta.saldo_inicial_configurado);

  const dadosGrafico = CATEGORIAS
    .map((cat) => ({
      name: cat.nome,
      population: resumo?.totais?.[cat.key] || 0,
      color: cat.cor,
      legendFontColor: '#1E293B',
      legendFontSize: 12,
    }))
    .filter((d) => d.population > 0);

  const temDados = dadosGrafico.length > 0;
  const totalMovimentado = dadosGrafico.reduce((acc, d) => acc + d.population, 0);

  return (
    <ScrollView
      style={s.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <View style={[s.header, { backgroundColor: COR }]}>
        <View style={s.headerInfo}>
          <Text style={s.ola}>Olá, {usuario?.nome?.split(' ')[0]}</Text>
          <Text style={s.sub}>Resumo financeiro do mês atual</Text>
        </View>

        {/* FIX: grupo de botões do header — alertas + sair */}
        <View style={s.headerBotoes}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Alertas')}
            style={s.alertasBotao}
          >
            <View style={s.alertasIcone} />
            <Text style={s.alertasTexto}>Alertas</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={logout} style={s.sairBotao}>
            <Text style={s.sair}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      {carregando ? (
        <ActivityIndicator color={COR} style={{ marginTop: 80 }} size="large" />
      ) : (
        <>
          <View
            style={[
              s.saldoCard,
              { backgroundColor: saldoPositivo ? '#115E59' : '#B42318' },
            ]}
          >
            <View style={s.saldoTopo}>
              <Text style={s.saldoLabel}>Saldo do mês</Text>
              <View style={s.saldoStatusPill}>
                <Text style={s.saldoStatusTexto}>
                  {saldoPositivo ? 'Positivo' : 'Negativo'}
                </Text>
              </View>
            </View>

            <Text style={s.saldoValor}>{formatCurrency(resumo?.saldo)}</Text>

            <View style={s.saldoDivisor} />

            <View style={s.saldoRodape}>
              <View style={s.saldoMiniItem}>
                <Text style={s.saldoMiniLabel}>Receitas</Text>
                <Text style={s.saldoMiniValor}>{formatCurrency(resumo?.totais?.receita)}</Text>
              </View>

              <View style={s.saldoSeparador} />

              <View style={s.saldoMiniItem}>
                <Text style={s.saldoMiniLabel}>Saídas totais</Text>
                <Text style={s.saldoMiniValor}>
                  {formatCurrency((resumo?.totais?.despesa || 0) + (resumo?.totais?.custo || 0))}
                </Text>
              </View>

              <View style={s.saldoSeparador} />

              <View style={s.saldoMiniItem}>
                <Text style={s.saldoMiniLabel}>Investimentos</Text>
                <Text style={s.saldoMiniValor}>
                  {formatCurrency(resumo?.totais?.investimento || 0)}
                </Text>
              </View>
            </View>
          </View>

          <View style={s.secao}>
            <Text style={s.secaoTitulo}>Distribuição do mês</Text>

            {temDados ? (
              <>
                <View style={s.graficoWrapper}>
                  <PieChart
                    data={dadosGrafico}
                    width={LARGURA - 32}
                    height={220}
                    chartConfig={{
                      color: (opacity = 1) => `rgba(15, 23, 42, ${opacity})`,
                    }}
                    accessor="population"
                    backgroundColor="transparent"
                    paddingLeft={String((LARGURA - 32) / 4.4)}
                    hasLegend={false}
                    absolute={false}
                  />
                </View>

                <View style={s.legendaGrid}>
                  {dadosGrafico.map((item) => {
                    const cat = CATEGORIAS.find((c) => c.nome === item.name);
                    const pct = totalMovimentado
                      ? ((item.population / totalMovimentado) * 100)
                          .toFixed(1)
                          .replace('.', ',')
                      : '0,0';

                    return (
                      <View key={item.name} style={s.legendaCell}>
                        <View style={s.legendaTopo}>
                          <View style={[s.legendaDot, { backgroundColor: item.color }]} />
                          <Text style={s.legendaNome} numberOfLines={1}>
                            {item.name}
                          </Text>
                        </View>

                        <Text style={s.legendaValor}>{formatCurrency(item.population)}</Text>

                        <View
                          style={[
                            s.legendaBadge,
                            { backgroundColor: cat?.bg ?? '#F1F5F9' },
                          ]}
                        >
                          <Text
                            style={[
                              s.legendaBadgeTexto,
                              { color: cat?.textoCor ?? '#475569' },
                            ]}
                          >
                            {pct}%
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={s.semDados}>
                <View style={s.semDadosIconeWrap}>
                  <View style={s.semDadosIcone} />
                </View>
                <Text style={s.semDadosTexto}>Nenhum lançamento este mês</Text>
                <Text style={s.semDadosSub}>
                  Cadastre movimentações para visualizar a distribuição do período.
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={s.contasSaldoCard}
            onPress={() => navigation.navigate('Contas')}
            accessibilityRole="button"
            accessibilityLabel={saldoContasConfigurado
              ? `Saldo atual nas contas: ${formatCurrency(saldoContas)}. Abrir contas`
              : 'Configure o saldo inicial das contas'}
          >
            <View style={s.contasSaldoInfo}>
              <Text style={s.contasSaldoLabel}>Saldo atual nas contas</Text>
              <Text style={s.contasSaldoValor}>
                {saldoContasConfigurado ? formatCurrency(saldoContas) : 'Configuração pendente'}
              </Text>
              <Text style={s.contasSaldoAjuda}>
                {saldoContasConfigurado
                  ? 'Entradas e saídas desde a data-base'
                  : 'Informe saldo inicial e data-base'}
              </Text>
            </View>
            <Text style={s.contasSaldoAcao}>Contas ›</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 56,
  },
  headerInfo: { flex: 1, paddingRight: 12 },
  ola: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.82)', marginTop: 4 },

  // FIX: novos estilos do botão de alertas
  headerBotoes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertasBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  alertasIcone: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#FCD34D',
  },
  alertasTexto: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  sairBotao: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  sair: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  saldoCard: {
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  saldoTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  saldoLabel: { fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  saldoStatusPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  saldoStatusTexto: { fontSize: 12, color: '#fff', fontWeight: '600' },
  saldoValor: { fontSize: 36, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  saldoDivisor: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  saldoRodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saldoSeparador: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)' },
  saldoMiniItem: { flex: 1, alignItems: 'center' },
  saldoMiniLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 4,
  },
  saldoMiniValor: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },

  contasSaldoCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8E5E3',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  contasSaldoInfo: { flex: 1 },
  contasSaldoLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  contasSaldoValor: { fontSize: 22, color: '#0F766E', fontWeight: '700', marginTop: 4 },
  contasSaldoAjuda: { fontSize: 11, color: '#94A3B8', marginTop: 3 },
  contasSaldoAcao: { color: '#2660A4', fontSize: 12, fontWeight: '700' },

  secao: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  secaoTitulo: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 14,
  },

  graficoWrapper: {
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    marginBottom: 16,
  },

  legendaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendaCell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  legendaTopo: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  legendaDot: { width: 10, height: 10, borderRadius: 999, marginRight: 6 },
  legendaNome: { flex: 1, fontSize: 13, fontWeight: '600', color: '#475569' },
  legendaValor: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  legendaBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  legendaBadgeTexto: { fontSize: 12, fontWeight: '700' },

  semDados: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 10 },
  semDadosIconeWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  semDadosIcone: {
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#94A3B8',
  },
  semDadosTexto: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '700',
    marginBottom: 6,
  },
  semDadosSub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
  },
});