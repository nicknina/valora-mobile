import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  TextInput,
  Platform,
  StatusBar,
  Alert,
  Linking,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import * as Sharing from "expo-sharing";
import api from "../services/api";

const AZUL = "#2660A4";
const FUNDO = "#EDF7F6";
const PRETO = "#050505";

function fmtData(data) {
  if (!data) return "";
  return new Date(data + "T12:00:00").toLocaleDateString("pt-BR");
}

export default function NotasScreen({ navigation }) {
  const [notas, setNotas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [mostrarCalInicio, setMostrarCalInicio] = useState(false);
  const [mostrarCalFim, setMostrarCalFim] = useState(false);
  const [filtroAberto, setFiltroAberto] = useState(false);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, []),
  );

  async function carregar(params = {}) {
    setCarregando(true);
    try {
      const query = new URLSearchParams();
      if (params.nome_cliente) query.set("nome_cliente", params.nome_cliente);
      if (params.data_inicio) query.set("data_inicio", params.data_inicio);
      if (params.data_fim) query.set("data_fim", params.data_fim);

      const { data } = await api.get(`/notas?${query.toString()}`);
      setNotas(data);
    } catch {
      Alert.alert("Erro", "Não foi possível carregar as notas fiscais.");
    } finally {
      setCarregando(false);
    }
  }

  function aplicarFiltros() {
    carregar({
      nome_cliente: busca.trim() || undefined,
      data_inicio: dataInicio || undefined,
      data_fim: dataFim || undefined,
    });
    setFiltroAberto(false);
  }

  function limparFiltros() {
    setBusca("");
    setDataInicio("");
    setDataFim("");
    carregar();
    setFiltroAberto(false);
  }

  async function abrirArquivo(url, tipo) {
    if (!url) {
      Alert.alert(
        "Arquivo indisponível",
        "O arquivo original não veio na exportação. Os dados da nota foram importados, mas o anexo precisa ser transferido separadamente.",
      );
      return;
    }

    try {
      if (url.startsWith("file://")) {
        const disponivel = await Sharing.isAvailableAsync();
        if (!disponivel) {
          throw new Error("O compartilhamento de arquivos não está disponível.");
        }
        await Sharing.shareAsync(url, {
          mimeType: tipo === "pdf" ? "application/pdf" : "image/jpeg",
          dialogTitle: "Abrir nota fiscal",
        });
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert("Erro", "Não foi possível abrir ou compartilhar o arquivo.");
    }
  }

  async function excluir(id) {
    Alert.alert(
      "Excluir nota",
      "Tem certeza que deseja excluir esta nota fiscal?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/notas/${id}`);
              carregar();
            } catch {
              Alert.alert("Erro", "Não foi possível excluir a nota.");
            }
          },
        },
      ],
    );
  }

  const temFiltro = busca || dataInicio || dataFim;

  function renderNota({ item }) {
    return (
      <View style={s.card}>
        <View style={s.cardAccent} />
        <View style={s.cardCorpo}>
          <View style={s.cardTopo}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardCliente} numberOfLines={1}>
                {item.nome_cliente}
              </Text>
              <Text style={s.cardData}>{fmtData(item.data_venda)}</Text>
            </View>
            <View
              style={[
                s.tipoBadge,
                {
                  backgroundColor:
                    item.arquivo_tipo === "pdf" ? "#FEF3C7" : "#EDE9FE",
                },
              ]}
            >
              <Ionicons
                name={
                  item.arquivo_tipo === "pdf"
                    ? "document-text-outline"
                    : "image-outline"
                }
                size={12}
                color={item.arquivo_tipo === "pdf" ? "#92400E" : "#5B21B6"}
              />
              <Text
                style={[
                  s.tipoTexto,
                  {
                    color: item.arquivo_tipo === "pdf" ? "#92400E" : "#5B21B6",
                  },
                ]}
              >
                {item.arquivo_tipo === "pdf" ? "PDF" : "Imagem"}
              </Text>
            </View>
          </View>

          {item.descricao ? (
            <Text style={s.cardDescricao} numberOfLines={2}>
              {item.descricao}
            </Text>
          ) : null}

          <View style={s.cardAcoes}>
            <TouchableOpacity
              style={s.botaoVer}
              onPress={() => abrirArquivo(item.arquivo_url, item.arquivo_tipo)}
            >
              <Ionicons
                name={item.arquivo_url ? "eye-outline" : "alert-circle-outline"}
                size={14}
                color={AZUL}
              />
              <Text style={s.botaoVerTexto}>
                {item.arquivo_url ? "Ver nota" : "Sem anexo local"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => excluir(item.id_nota)}>
              <Text style={s.botaoExcluir}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerTitulo}>Notas Fiscais</Text>
            <Text style={s.headerSub}>
              {notas.length} nota(s) encontrada(s)
            </Text>
          </View>
          <View style={s.headerBotoes}>
            <TouchableOpacity
              style={[s.filtroBotao, temFiltro && { backgroundColor: AZUL }]}
              onPress={() => setFiltroAberto((v) => !v)}
            >
              <Ionicons
                name="filter-outline"
                size={16}
                color={temFiltro ? "#fff" : AZUL}
              />
              <Text
                style={[s.filtroBotaoTexto, temFiltro && { color: "#fff" }]}
              >
                Filtrar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.novoBotao}
              onPress={() => navigation.navigate("NovaNotaFiscal")}
            >
              <Text style={s.novoBotaoTexto}>+ Nova</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Painel de filtros */}
        {filtroAberto && (
          <View style={s.filtroPanel}>
            <Text style={s.filtroLabel}>Nome do cliente</Text>
            <TextInput
              style={s.filtroInput}
              placeholder="Buscar por cliente..."
              placeholderTextColor="#CBD5E1"
              value={busca}
              onChangeText={setBusca}
            />

            <Text style={s.filtroLabel}>Período</Text>
            <View style={s.filtroRow}>
              <TouchableOpacity
                style={[s.filtroData, { flex: 1, marginRight: 8 }]}
                onPress={() => setMostrarCalInicio(true)}
              >
                <Ionicons name="calendar-outline" size={14} color="#64748B" />
                <Text style={s.filtroDataTexto}>
                  {dataInicio ? fmtData(dataInicio) : "Data início"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.filtroData, { flex: 1 }]}
                onPress={() => setMostrarCalFim(true)}
              >
                <Ionicons name="calendar-outline" size={14} color="#64748B" />
                <Text style={s.filtroDataTexto}>
                  {dataFim ? fmtData(dataFim) : "Data fim"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={s.filtroBotoes}>
              <TouchableOpacity style={s.filtroClear} onPress={limparFiltros}>
                <Text style={s.filtroClearTexto}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.filtroAplicar}
                onPress={aplicarFiltros}
              >
                <Text style={s.filtroAplicarTexto}>Aplicar filtros</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Calendários */}
        {mostrarCalInicio && (
          <View style={s.calBox}>
            <Calendar
              onDayPress={(d) => {
                setDataInicio(d.dateString);
                setMostrarCalInicio(false);
              }}
              markedDates={
                dataInicio
                  ? { [dataInicio]: { selected: true, selectedColor: AZUL } }
                  : {}
              }
              theme={{
                todayTextColor: AZUL,
                selectedDayBackgroundColor: AZUL,
                arrowColor: AZUL,
              }}
            />
            <TouchableOpacity
              style={s.calCancelar}
              onPress={() => setMostrarCalInicio(false)}
            >
              <Text style={s.calCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}
        {mostrarCalFim && (
          <View style={s.calBox}>
            <Calendar
              onDayPress={(d) => {
                setDataFim(d.dateString);
                setMostrarCalFim(false);
              }}
              markedDates={
                dataFim
                  ? { [dataFim]: { selected: true, selectedColor: AZUL } }
                  : {}
              }
              theme={{
                todayTextColor: AZUL,
                selectedDayBackgroundColor: AZUL,
                arrowColor: AZUL,
              }}
            />
            <TouchableOpacity
              style={s.calCancelar}
              onPress={() => setMostrarCalFim(false)}
            >
              <Text style={s.calCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {carregando ? (
        <ActivityIndicator
          color={AZUL}
          size="large"
          style={{ marginTop: 60 }}
        />
      ) : notas.length === 0 ? (
        <View style={s.vazio}>
          <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
          <Text style={s.vazioTexto}>Nenhuma nota fiscal encontrada.</Text>
          <Text style={s.vazioSub}>
            Toque em "+ Nova" para cadastrar a primeira.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notas}
          keyExtractor={(item) => String(item.id_nota)}
          renderItem={renderNota}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitulo: { fontSize: 26, fontWeight: "bold", color: PRETO },
  headerSub: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  headerBotoes: { flexDirection: "row", gap: 8 },

  filtroBotao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1.5,
    borderColor: AZUL,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filtroBotaoTexto: { fontSize: 13, fontWeight: "600", color: AZUL },
  novoBotao: {
    backgroundColor: AZUL,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  novoBotaoTexto: { color: "#fff", fontWeight: "bold", fontSize: 13 },

  filtroPanel: {
    marginTop: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filtroLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  filtroInput: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: PRETO,
    marginBottom: 14,
  },
  filtroRow: { flexDirection: "row", marginBottom: 14 },
  filtroData: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filtroDataTexto: { fontSize: 13, color: "#64748B" },
  filtroBotoes: { flexDirection: "row", gap: 10 },
  filtroClear: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  filtroClearTexto: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  filtroAplicar: {
    flex: 2,
    backgroundColor: AZUL,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  filtroAplicarTexto: { fontSize: 13, fontWeight: "700", color: "#fff" },

  calBox: {
    marginTop: 12,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  calCancelar: {
    backgroundColor: "#fff",
    padding: 14,
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
  },
  calCancelarTexto: { color: "#EF4444", fontWeight: "bold", fontSize: 14 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardAccent: { width: 4, backgroundColor: AZUL },
  cardCorpo: { flex: 1, padding: 14 },
  cardTopo: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  cardCliente: { fontSize: 15, fontWeight: "700", color: PRETO },
  cardData: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  tipoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tipoTexto: { fontSize: 11, fontWeight: "700" },
  cardDescricao: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 10,
    lineHeight: 18,
  },
  cardAcoes: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  botaoVer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  botaoVerTexto: { fontSize: 13, fontWeight: "700", color: AZUL },
  botaoExcluir: { fontSize: 13, fontWeight: "600", color: "#DC2626" },

  vazio: { alignItems: "center", marginTop: 80, paddingHorizontal: 32 },
  vazioTexto: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 16,
    textAlign: "center",
  },
  vazioSub: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 8,
    textAlign: "center",
  },
});
