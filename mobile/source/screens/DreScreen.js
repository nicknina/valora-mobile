import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Calendar } from "react-native-calendars";
import api from "../services/api";
import { formatCurrency } from "../utils/money";

const AZUL = "#2660A4";
const VERDE = "#16845B";
const VERMELHO = "#C43D3D";
const FUNDO = "#EDF7F6";

function dataLocal(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatarData(data) {
  return data ? new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR") : "";
}

export default function DreScreen() {
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(
    dataLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
  );
  const [dataFim, setDataFim] = useState(
    dataLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
  );
  const [dre, setDre] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [calendario, setCalendario] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get(
        `/relatorios/dre?data_inicio=${dataInicio}&data_fim=${dataFim}`,
      );
      setDre(data);
    } catch {
      Alert.alert("Erro", "Não foi possível gerar o DRE para este período.");
    } finally {
      setCarregando(false);
    }
  }, [dataInicio, dataFim]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const categorias = (titulo, itens, cor) => (
    <View style={s.detalheGrupo}>
      <Text style={s.detalheTitulo}>{titulo}</Text>
      {itens?.length ? (
        itens.map((item) => (
          <View key={item.categoria} style={s.categoriaLinha}>
            <Text style={s.categoriaNome}>{item.categoria}</Text>
            <Text style={[s.categoriaValor, { color: cor }]}>
              {formatCurrency(item.total)}
            </Text>
          </View>
        ))
      ) : (
        <Text style={s.semCategoria}>Nenhum valor no período</Text>
      )}
    </View>
  );

  const linhasCalendario = [
    {
      chave: "inicio",
      titulo: "Data inicial",
      valor: dataInicio,
      maxDate: dataFim,
      selecionar: setDataInicio,
    },
    {
      chave: "fim",
      titulo: "Data final",
      valor: dataFim,
      minDate: dataInicio,
      selecionar: setDataFim,
    },
  ];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.titulo}>DRE</Text>
        <Text style={s.subtitulo}>Demonstrativo do resultado do período</Text>
        <View style={s.periodoLinha}>
          {linhasCalendario.map((item, indice) => (
            <View key={item.chave} style={s.periodoGrupo}>
              {indice > 0 && <Text style={s.periodoAte}>até</Text>}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`${item.titulo}: ${formatarData(item.valor)}`}
                style={s.periodoBotao}
                onPress={() => setCalendario(item.chave)}
              >
                <Text style={s.periodoLabel}>{indice === 0 ? "DE" : "ATÉ"}</Text>
                <Text style={s.periodoValor}>{formatarData(item.valor)}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.conteudo}
      >
        {carregando ? (
          <ActivityIndicator color={AZUL} size="large" style={s.loading} />
        ) : dre ? (
          <>
            <View
              style={[
                s.resultadoCard,
                {
                  backgroundColor:
                    dre.lucro_liquido >= 0 ? VERDE : VERMELHO,
                },
              ]}
            >
              <Text style={s.resultadoLabel}>Lucro líquido do período</Text>
              <Text style={s.resultadoValor}>
                {formatCurrency(dre.lucro_liquido)}
              </Text>
              <Text style={s.margem}>
                Margem líquida: {Number(dre.margem_liquida_percentual || 0)
                  .toFixed(1)
                  .replace(".", ",")}%
              </Text>
            </View>

            <View style={s.demonstrativo}>
              <Text style={s.secaoTitulo}>Demonstrativo</Text>
              <View style={s.linha}>
                <Text style={s.linhaLabel}>Receita bruta</Text>
                <Text style={[s.linhaValor, { color: VERDE }]}>
                  {formatCurrency(dre.receita_bruta)}
                </Text>
              </View>
              <View style={s.linha}>
                <Text style={s.linhaLabel}>(-) Deduções da receita</Text>
                <Text style={[s.linhaValor, { color: VERMELHO }]}>
                  {formatCurrency(dre.deducoes_receita)}
                </Text>
              </View>
              <View style={[s.linha, s.subtotal]}>
                <Text style={s.subtotalLabel}>(=) Receita líquida</Text>
                <Text style={s.subtotalValor}>
                  {formatCurrency(dre.receita_liquida)}
                </Text>
              </View>
              <View style={s.linha}>
                <Text style={s.linhaLabel}>(-) Custos dos produtos/serviços</Text>
                <Text style={[s.linhaValor, { color: VERMELHO }]}>
                  {formatCurrency(dre.custos)}
                </Text>
              </View>
              <View style={[s.linha, s.subtotal]}>
                <Text style={s.subtotalLabel}>(=) Lucro bruto</Text>
                <Text style={s.subtotalValor}>{formatCurrency(dre.lucro_bruto)}</Text>
              </View>
              <View style={s.linha}>
                <Text style={s.linhaLabel}>(-) Despesas operacionais</Text>
                <Text style={[s.linhaValor, { color: VERMELHO }]}>
                  {formatCurrency(dre.despesas_operacionais)}
                </Text>
              </View>
              <View style={[s.linha, s.subtotal]}>
                <Text style={s.subtotalLabel}>
                  (=) Resultado operacional antes do resultado financeiro e dos tributos
                </Text>
                <Text style={s.subtotalValor}>
                  {formatCurrency(dre.resultado_operacional)}
                </Text>
              </View>
              <View style={s.linha}>
                <Text style={s.linhaLabel}>(+) Receitas financeiras</Text>
                <Text style={[s.linhaValor, { color: VERDE }]}>
                  {formatCurrency(dre.receitas_financeiras)}
                </Text>
              </View>
              <View style={s.linha}>
                <Text style={s.linhaLabel}>(-) Despesas financeiras</Text>
                <Text style={[s.linhaValor, { color: VERMELHO }]}>
                  {formatCurrency(dre.despesas_financeiras)}
                </Text>
              </View>
              <View style={[s.linha, s.subtotal]}>
                <Text style={s.subtotalLabel}>
                  (=) Resultado antes dos impostos sobre o lucro
                </Text>
                <Text style={s.subtotalValor}>
                  {formatCurrency(dre.resultado_antes_impostos)}
                </Text>
              </View>
              <View style={s.linha}>
                <Text style={s.linhaLabel}>(-) Impostos sobre o lucro</Text>
                <Text style={[s.linhaValor, { color: VERMELHO }]}>
                  {formatCurrency(dre.impostos_sobre_lucro)}
                </Text>
              </View>
              <View style={[s.linha, s.totalLinha]}>
                <Text style={s.totalLabel}>(=) Lucro líquido</Text>
                <Text
                  style={[
                    s.totalValor,
                    { color: dre.lucro_liquido >= 0 ? VERDE : VERMELHO },
                  ]}
                >
                  {formatCurrency(dre.lucro_liquido)}
                </Text>
              </View>
            </View>

            <View style={s.detalhamento}>
              <Text style={s.secaoTitulo}>Detalhamento por categoria</Text>
              {categorias("Deduções da receita", dre.por_categoria?.deducoes_receita, VERMELHO)}
              {categorias("Custos", dre.por_categoria?.custos, VERMELHO)}
              {categorias("Despesas operacionais", dre.por_categoria?.despesas_operacionais, VERMELHO)}
              {categorias("Receitas financeiras", dre.por_categoria?.receitas_financeiras, VERDE)}
              {categorias("Despesas financeiras", dre.por_categoria?.despesas_financeiras, VERMELHO)}
              {categorias("Impostos sobre o lucro", dre.por_categoria?.impostos_sobre_lucro, VERMELHO)}
            </View>

            <Text style={s.observacao}>
              O resultado depende da classificação escolhida em cada lançamento. Use este demonstrativo como controle gerencial, não como apuração fiscal.
            </Text>
          </>
        ) : null}
      </ScrollView>

      {linhasCalendario.map((item) => (
        <Modal
          key={item.chave}
          visible={calendario === item.chave}
          transparent
          animationType="fade"
          onRequestClose={() => setCalendario(null)}
        >
          <Pressable style={s.modalOverlay} onPress={() => setCalendario(null)}>
            <Pressable>
              <View style={s.modalBox}>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitulo}>{item.titulo}</Text>
                </View>
                <Calendar
                  current={item.valor}
                  minDate={item.minDate}
                  maxDate={item.maxDate}
                  onDayPress={(dia) => {
                    item.selecionar(dia.dateString);
                    setCalendario(null);
                  }}
                  markedDates={{
                    [item.valor]: { selected: true, selectedColor: AZUL },
                  }}
                  theme={{
                    todayTextColor: AZUL,
                    selectedDayBackgroundColor: AZUL,
                    arrowColor: AZUL,
                  }}
                />
                <TouchableOpacity
                  style={s.cancelar}
                  onPress={() => setCalendario(null)}
                >
                  <Text style={s.cancelarTexto}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: FUNDO },
  header: {
    backgroundColor: "#fff",
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  titulo: { fontSize: 26, fontWeight: "bold", color: "#050505" },
  subtitulo: { fontSize: 13, color: "#64748B", marginTop: 4, marginBottom: 14 },
  periodoLinha: { flexDirection: "row", alignItems: "center", gap: 8 },
  periodoGrupo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  periodoAte: { fontSize: 11, color: "#94A3B8" },
  periodoBotao: {
    flex: 1,
    minHeight: 48,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  periodoLabel: { fontSize: 9, fontWeight: "700", color: "#94A3B8" },
  periodoValor: { fontSize: 13, fontWeight: "700", color: "#050505", marginTop: 2 },
  conteudo: { padding: 16, paddingBottom: 32 },
  loading: { marginTop: 72 },
  resultadoCard: { borderRadius: 14, padding: 20, marginBottom: 14 },
  resultadoLabel: { color: "rgba(255,255,255,0.78)", fontSize: 13 },
  resultadoValor: { color: "#fff", fontSize: 30, fontWeight: "bold", marginTop: 6 },
  margem: { color: "rgba(255,255,255,0.88)", fontSize: 12, marginTop: 8 },
  demonstrativo: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 14,
  },
  secaoTitulo: { color: "#0F172A", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  linha: {
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
    gap: 8,
  },
  linhaLabel: { color: "#475569", fontSize: 13, flex: 1, lineHeight: 18 },
  linhaValor: { fontSize: 14, fontWeight: "600" },
  subtotal: { backgroundColor: "#F8FAFC", paddingHorizontal: 8 },
  subtotalLabel: { color: "#0F172A", fontWeight: "600", flex: 1, lineHeight: 18 },
  subtotalValor: { color: AZUL, fontWeight: "700" },
  totalLinha: { borderBottomWidth: 0, minHeight: 52 },
  totalLabel: { color: "#0F172A", fontWeight: "700", flex: 1 },
  totalValor: { fontWeight: "700", fontSize: 15 },
  detalhamento: { backgroundColor: "#fff", borderRadius: 12, padding: 16 },
  detalheGrupo: { marginTop: 12 },
  detalheTitulo: { fontSize: 13, color: "#334155", fontWeight: "700", marginBottom: 4 },
  categoriaLinha: {
    minHeight: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  categoriaNome: { color: "#64748B", fontSize: 13, flex: 1 },
  categoriaValor: { fontSize: 13, fontWeight: "600" },
  semCategoria: { color: "#94A3B8", fontSize: 12, paddingVertical: 8 },
  observacao: { color: "#64748B", fontSize: 11, lineHeight: 16, marginTop: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: { backgroundColor: "#fff", borderRadius: 14, overflow: "hidden" },
  modalHeader: { backgroundColor: AZUL, padding: 16 },
  modalTitulo: { color: "#fff", fontWeight: "700", fontSize: 16 },
  cancelar: { padding: 14, alignItems: "center" },
  cancelarTexto: { color: "#64748B", fontWeight: "600" },
});