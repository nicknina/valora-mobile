import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StatusBar,
  Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Calendar } from "react-native-calendars";
import api from "../services/api";
import { formatCurrency } from "../utils/money";

const AZUL = "#2660A4";
const AMBAR = "#ECA400";
const VERDE = "#23967F";
const PRETO = "#050505";
const FUNDO = "#EDF7F6";
const VERMELHO = "#DC2626";
const ROXO = "#7C3AED";

const CORES = {
  receita: VERDE,
  despesa: VERMELHO,
  investimento: AMBAR,
  custo: ROXO,
};
const CORES_BG = {
  receita: "#ECFDF5",
  despesa: "#FEE2E2",
  investimento: "#FFF8E6",
  custo: "#F5F3FF",
};
const LABELS = {
  receita: "Receita",
  despesa: "Despesa",
  investimento: "Investimento",
  custo: "Custo",
};

const fmtData = (d) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : null;

function calcularTotais(lancamentos) {
  const totais = { receita: 0, despesa: 0, custo: 0, investimento: 0 };
  lancamentos.forEach((l) => {
    totais[l.tipo] += parseFloat(l.valor);
  });
  return {
    ...totais,
    saldo: totais.receita - totais.despesa - totais.custo - totais.investimento,
  };
}

export default function LancamentosScreen({ navigation }) {
  const [lancamentos, setLancamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [excluindo, setExcluindo] = useState(null);
  const [mostrarCalInicio, setMostrarCalInicio] = useState(false);
  const [mostrarCalFim, setMostrarCalFim] = useState(false);

  const hoje = new Date();
  const primeiroDia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
  const ultimoDia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}`;

  const [dataInicio, setDataInicio] = useState(primeiroDia);
  const [dataFim, setDataFim] = useState(ultimoDia);

  async function carregar() {
    setCarregando(true);
    try {
      const { data } = await api.get(
        `/lancamentos?data_inicio=${dataInicio}&data_fim=${dataFim}`,
      );
      setLancamentos(data);
    } catch {
      Alert.alert("Erro", "Não foi possível carregar os lançamentos.");
    } finally {
      setCarregando(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [dataInicio, dataFim]),
  );

  async function excluir(id) {
    Alert.alert("Excluir lançamento", "Esta ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          setExcluindo(id);
          try {
            await api.delete(`/lancamentos/${id}`);
            setLancamentos((prev) =>
              prev.filter((l) => l.id_lancamento !== id),
            );
          } catch {
            Alert.alert("Erro", "Não foi possível excluir.");
          } finally {
            setExcluindo(null);
          }
        },
      },
    ]);
  }

  const totais = calcularTotais(lancamentos);
  const saldoPositivo = totais.saldo >= 0;

  function renderItem({ item }) {
    const isExcluindo = excluindo === item.id_lancamento;
    return (
      <View style={s.item}>
        <View style={[s.itemAccent, { backgroundColor: CORES[item.tipo] }]} />
        <View style={[s.itemIcone, { backgroundColor: CORES_BG[item.tipo] }]}>
          <View
            style={[s.itemIconeDot, { backgroundColor: CORES[item.tipo] }]}
          />
        </View>
        <View style={s.itemInfo}>
          <Text style={s.itemDesc}>
            {item.descricao || item.categoria?.nome || LABELS[item.tipo]}
          </Text>
          <Text style={s.itemCategoria}>{item.categoria?.nome}</Text>
          <Text style={s.itemConta}>
            {item.conta_financeira?.nome || "Conta não identificada"}
          </Text>
          <Text style={s.itemData}>
            {new Date(item.data_lancamento + "T12:00:00").toLocaleDateString(
              "pt-BR",
            )}
          </Text>
        </View>
        <View style={s.itemDireita}>
          <View style={[s.tipoPill, { backgroundColor: CORES_BG[item.tipo] }]}>
            <Text style={[s.tipoTexto, { color: CORES[item.tipo] }]}>
              {LABELS[item.tipo]}
            </Text>
          </View>
          <Text style={[s.itemValor, { color: CORES[item.tipo] }]}>
            {formatCurrency(item.valor)}
          </Text>
          <TouchableOpacity
            style={s.excluirBotao}
            onPress={() => excluir(item.id_lancamento)}
            disabled={isExcluindo}
          >
            {isExcluindo ? (
              <ActivityIndicator size="small" color={VERMELHO} />
            ) : (
              <Text style={s.excluirTexto}>Excluir</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitulo}>Lançamentos</Text>
        <View style={s.filtroRow}>
          <TouchableOpacity
            style={s.dataBox}
            onPress={() => setMostrarCalInicio(true)}
          >
            <Text style={s.dataBoxLabel}>DE</Text>
            <Text style={s.dataBoxValor}>{fmtData(dataInicio)}</Text>
            <Text style={s.dataBoxChevron}>›</Text>
          </TouchableOpacity>
          <View style={s.filtroSep}>
            <Text style={s.filtroSepTexto}>até</Text>
          </View>
          <TouchableOpacity
            style={s.dataBox}
            onPress={() => setMostrarCalFim(true)}
          >
            <Text style={s.dataBoxLabel}>ATÉ</Text>
            <Text style={s.dataBoxValor}>{fmtData(dataFim)}</Text>
            <Text style={s.dataBoxChevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={lancamentos}
        keyExtractor={(item) => String(item.id_lancamento)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          carregando ? (
            <ActivityIndicator
              color={AZUL}
              style={{ marginVertical: 20 }}
              size="large"
            />
          ) : (
            <>
              {/* Card saldo */}
              <View
                style={[
                  s.saldoCard,
                  { backgroundColor: saldoPositivo ? AZUL : VERMELHO },
                ]}
              >
                <Text style={s.saldoLabel}>Saldo do período</Text>
                <Text style={s.saldoValor}>{formatCurrency(totais.saldo)}</Text>
                <View style={s.saldoDivisor} />
                <View style={s.saldoRodape}>
                  <View style={s.saldoMini}>
                    <Text style={s.saldoMiniLabel}>Entradas</Text>
                    <Text style={s.saldoMiniValor}>{formatCurrency(totais.receita)}</Text>
                  </View>
                  <View style={s.saldoSep} />
                  <View style={s.saldoMini}>
                    <Text style={s.saldoMiniLabel}>Saídas</Text>
                    <Text style={s.saldoMiniValor}>
                      {formatCurrency(totais.despesa + totais.custo)}
                    </Text>
                  </View>
                  <View style={s.saldoSep} />
                  <View style={s.saldoMini}>
                    <Text style={s.saldoMiniLabel}>Investido</Text>
                    <Text style={s.saldoMiniValor}>
                      {formatCurrency(totais.investimento)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Mini cards por tipo */}
              <View style={s.miniCardsRow}>
                {[
                  {
                    label: "Receitas",
                    valor: totais.receita,
                    cor: VERDE,
                    bg: "#ECFDF5",
                  },
                  {
                    label: "Despesas",
                    valor: totais.despesa,
                    cor: VERMELHO,
                    bg: "#FEE2E2",
                  },
                  {
                    label: "Custos",
                    valor: totais.custo,
                    cor: ROXO,
                    bg: "#F5F3FF",
                  },
                  {
                    label: "Investido",
                    valor: totais.investimento,
                    cor: AMBAR,
                    bg: "#FFF8E6",
                  },
                ].map((item) => (
                  <View
                    key={item.label}
                    style={[s.miniCard, { backgroundColor: item.bg }]}
                  >
                    <View
                      style={[s.miniCardDot, { backgroundColor: item.cor }]}
                    />
                    <Text style={[s.miniCardValor, { color: item.cor }]}>
                      {formatCurrency(item.valor)}
                    </Text>
                    <Text style={s.miniCardLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={s.botaoNovo}
                onPress={() => navigation.navigate("NovoLancamento")}
              >
                <Text style={s.botaoNovoTexto}>+ Novo lançamento</Text>
              </TouchableOpacity>

              {lancamentos.length > 0 && (
                <Text style={s.listaLabel}>Lançamentos do período</Text>
              )}
            </>
          )
        }
        ListEmptyComponent={
          !carregando && (
            <View style={s.vazio}>
              <View
                style={[s.vazioIconeCircle, { backgroundColor: "#EDF7F6" }]}
              >
                <View style={[s.vazioIconeDot, { backgroundColor: AZUL }]} />
              </View>
              <Text style={s.vazioTexto}>Nenhum lançamento neste período.</Text>
              <Text style={s.vazioSub}>
                Ajuste o período ou adicione um novo lançamento.
              </Text>
            </View>
          )
        }
      />

      {/* Modais calendário */}
      {[
        {
          visivel: mostrarCalInicio,
          fechar: () => setMostrarCalInicio(false),
          titulo: "Data início",
          valor: dataInicio,
          onDia: (d) => {
            setDataInicio(d.dateString);
            setMostrarCalInicio(false);
          },
        },
        {
          visivel: mostrarCalFim,
          fechar: () => setMostrarCalFim(false),
          titulo: "Data fim",
          valor: dataFim,
          onDia: (d) => {
            setDataFim(d.dateString);
            setMostrarCalFim(false);
          },
          minDate: dataInicio || undefined,
        },
      ].map(({ visivel, fechar, titulo, valor, onDia, minDate }) => (
        <Modal key={titulo} visible={visivel} transparent animationType="fade">
          <Pressable style={s.modalOverlay} onPress={fechar}>
            <Pressable>
              <View style={s.modalBox}>
                <View style={[s.modalHeader, { backgroundColor: AZUL }]}>
                  <Text style={s.modalTitulo}>{titulo}</Text>
                </View>
                <Calendar
                  onDayPress={onDia}
                  minDate={minDate}
                  markedDates={
                    valor
                      ? { [valor]: { selected: true, selectedColor: AZUL } }
                      : {}
                  }
                  theme={{
                    todayTextColor: AZUL,
                    selectedDayBackgroundColor: AZUL,
                    arrowColor: AZUL,
                  }}
                />
                <TouchableOpacity style={s.modalCancelar} onPress={fechar}>
                  <Text style={s.modalCancelarTexto}>Cancelar</Text>
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
    paddingTop:
      Platform.OS === "ios" ? 56 : (StatusBar.currentHeight ?? 24) + 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerTitulo: {
    fontSize: 26,
    fontWeight: "bold",
    color: PRETO,
    marginBottom: 14,
  },
  filtroRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dataBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dataBoxLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  dataBoxValor: { flex: 1, fontSize: 13, fontWeight: "700", color: PRETO },
  dataBoxChevron: { fontSize: 18, color: "#CBD5E1" },
  filtroSep: { alignItems: "center" },
  filtroSepTexto: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },

  saldoCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  saldoLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 4,
  },
  saldoValor: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
  },
  saldoDivisor: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: 14,
  },
  saldoRodape: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  saldoSep: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.2)" },
  saldoMini: { flex: 1, alignItems: "center", justifyContent: "center" },
  saldoMiniLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.65)",
    marginBottom: 4,
  },
  saldoMiniValor: { fontSize: 13, fontWeight: "700", color: "#fff" },

  miniCardsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  miniCard: {
    width: "47.5%",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  miniCardDot: { width: 8, height: 8, borderRadius: 999, marginBottom: 8 },
  miniCardValor: { fontSize: 16, fontWeight: "bold", marginBottom: 2 },
  miniCardLabel: { fontSize: 11, color: "#64748B" },

  botaoNovo: {
    backgroundColor: AZUL,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  botaoNovoTexto: { color: "#fff", fontWeight: "bold", fontSize: 15 },

  listaLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },

  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  itemAccent: { width: 4, alignSelf: "stretch" },
  itemIcone: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
    marginVertical: 14,
  },
  itemIconeDot: { width: 14, height: 14, borderRadius: 999 },
  itemInfo: { flex: 1, paddingHorizontal: 10, paddingVertical: 14 },
  itemDesc: { fontSize: 14, color: PRETO, fontWeight: "600" },
  itemCategoria: { fontSize: 12, color: "#64748B", marginTop: 2 },
  itemConta: { fontSize: 11, color: "#0F766E", marginTop: 2 },
  itemData: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  itemDireita: {
    alignItems: "flex-end",
    paddingRight: 12,
    paddingVertical: 12,
    gap: 4,
  },
  tipoPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tipoTexto: { fontSize: 10, fontWeight: "700" },
  itemValor: { fontSize: 14, fontWeight: "bold" },
  excluirBotao: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  excluirTexto: { fontSize: 11, color: VERMELHO, fontWeight: "600" },

  vazio: { alignItems: "center", marginTop: 40, paddingHorizontal: 32 },
  vazioIconeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  vazioIconeDot: { width: 20, height: 20, borderRadius: 999 },
  vazioTexto: {
    fontSize: 15,
    color: "#64748B",
    fontWeight: "600",
    textAlign: "center",
  },
  vazioSub: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 6,
    textAlign: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: { backgroundColor: "#fff", borderRadius: 20, overflow: "hidden" },
  modalHeader: { padding: 16, alignItems: "center" },
  modalTitulo: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  modalCancelar: {
    padding: 16,
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
  },
  modalCancelarTexto: { color: VERMELHO, fontWeight: "bold", fontSize: 15 },
});
