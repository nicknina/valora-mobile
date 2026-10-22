import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  StatusBar,
  ScrollView,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LineChart } from "react-native-chart-kit";
import api from "../services/api";
import { formatCurrency } from "../utils/money";

const AZUL = "#2660A4";
const VERDE = "#23967F";
const PRETO = "#050505";
const FUNDO = "#EDF7F6";
const LARGURA = Dimensions.get("window").width;

const CATEGORIAS_FILTRO = ["Todos"];

function variacao(historico) {
  if (!historico || historico.length < 2) return 0;
  const primeiro = historico[0].preco;
  const ultimo = historico[historico.length - 1].preco;
  return ((ultimo - primeiro) / primeiro) * 100;
}

export default function PrecosMediosScreen({ navigation }) {
  const [carregando, setCarregando] = useState(true);
  const [produtos, setProdutos] = useState([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todos");
  const [nomeSelecionado, setNomeSelecionado] = useState(null);
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState(["Todos"]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, []),
  );

  async function carregar() {
    setCarregando(true);
    try {
      const { data } = await api.get("/precos-medios");
      setProdutos(data);

      const cats = ["Todos", ...new Set(data.map((p) => p.categoria))];
      setCategoriasDisponiveis(cats);

      if (data.length > 0) {
        setNomeSelecionado((prev) => prev ?? data[0].nome);
      }
    } catch {
      Alert.alert("Erro", "Não foi possível carregar os preços.");
    } finally {
      setCarregando(false);
    }
  }

  const produtoSelecionado =
    produtos.find((p) => p.nome === nomeSelecionado) ?? null;

  async function excluirPreco(id_preco, nomeProduto) {
    Alert.alert(
      "Excluir registro",
      `Remover este registro de preço de "${nomeProduto}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/precos-medios/${id_preco}`);
              carregar();
            } catch {
              Alert.alert("Erro", "Não foi possível excluir.");
            }
          },
        },
      ],
    );
  }

  const produtosFiltrados =
    categoriaAtiva === "Todos"
      ? produtos
      : produtos.filter((p) => p.categoria === categoriaAtiva);

  const dadosGrafico =
    produtoSelecionado && produtoSelecionado.historico.length > 0
      ? {
          labels: produtoSelecionado.historico.map((h) => h.mes),
          datasets: [
            { data: produtoSelecionado.historico.map((h) => h.preco) },
          ],
        }
      : null;

  const variacaoPct = produtoSelecionado
    ? variacao(produtoSelecionado.historico)
    : 0;
  const variacaoPositiva = variacaoPct >= 0;
  const precoAtual =
    produtoSelecionado && produtoSelecionado.historico.length > 0
      ? produtoSelecionado.historico[produtoSelecionado.historico.length - 1]
          .preco
      : 0;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerTitulo}>Histórico de materiais</Text>
            <Text style={s.headerSub}>Seus registros de material e mercado</Text>
          </View>
          <TouchableOpacity
            style={s.botaoNovo}
            onPress={() =>
              navigation.navigate("NovoLancamento", {
                tipoInicial: "preco_mercado",
              })
            }
          >
            <Text style={s.botaoNovoTexto}>+ Registrar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {carregando ? (
        <ActivityIndicator
          color={AZUL}
          size="large"
          style={{ marginTop: 60 }}
        />
      ) : produtos.length === 0 ? (
        <View style={s.vazio}>
          <Text style={s.vazioTexto}>Nenhum preço registrado ainda.</Text>
          <Text style={s.vazioSub}>
            Toque em "+ Registrar" para adicionar o primeiro produto.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Filtro de categoria */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filtroRow}
          >
            {categoriasDisponiveis.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  s.filtroPill,
                  categoriaAtiva === cat && s.filtroPillAtivo,
                ]}
                onPress={() => setCategoriaAtiva(cat)}
              >
                <Text
                  style={[
                    s.filtroPillTexto,
                    categoriaAtiva === cat && s.filtroPillTextoAtivo,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Gráfico do produto selecionado */}
          {produtoSelecionado && dadosGrafico && (
            <View style={s.graficoCard}>
              <View style={s.graficoTopo}>
                <View style={{ flex: 1 }}>
                  <Text style={s.graficoNome}>{produtoSelecionado.nome}</Text>
                  <Text style={s.graficoPreco}>
                    {formatCurrency(precoAtual)}
                    <Text style={s.graficoUnidade}>
                      {" "}
                      / {produtoSelecionado.unidade}
                    </Text>
                  </Text>
                </View>
                {produtoSelecionado.historico.length >= 2 && (
                  <View
                    style={[
                      s.variacaoPill,
                      {
                        backgroundColor: variacaoPositiva
                          ? "#ECFDF5"
                          : "#FEE2E2",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.variacaoTexto,
                        { color: variacaoPositiva ? VERDE : "#DC2626" },
                      ]}
                    >
                      {variacaoPositiva ? "▲" : "▼"}{" "}
                      {Math.abs(variacaoPct).toFixed(1)}%
                    </Text>
                    <Text
                      style={[
                        s.variacaoSub,
                        { color: variacaoPositiva ? VERDE : "#DC2626" },
                      ]}
                    >
                      acumulado
                    </Text>
                  </View>
                )}
              </View>

              <LineChart
                data={dadosGrafico}
                width={LARGURA - 48}
                height={180}
                yAxisLabel="R$"
                chartConfig={{
                  backgroundColor: "#fff",
                  backgroundGradientFrom: "#fff",
                  backgroundGradientTo: "#fff",
                  decimalPlaces: 0,
                  color: () => AZUL,
                  labelColor: () => "#94A3B8",
                  propsForDots: { r: "4", strokeWidth: "2", stroke: AZUL },
                  propsForBackgroundLines: { stroke: "#F1F5F9" },
                }}
                bezier
                style={s.grafico}
                withInnerLines
                withOuterLines={false}
              />

              {/* Mini resumo min/med/max */}
              <View style={s.resumoRow}>
                {[
                  {
                    label: "Mínimo",
                    valor: Math.min(
                      ...produtoSelecionado.historico.map((h) => h.preco),
                    ),
                  },
                  {
                    label: "Médio",
                    valor:
                      produtoSelecionado.historico.reduce(
                        (a, h) => a + h.preco,
                        0,
                      ) / produtoSelecionado.historico.length,
                  },
                  {
                    label: "Máximo",
                    valor: Math.max(
                      ...produtoSelecionado.historico.map((h) => h.preco),
                    ),
                  },
                ].map((item) => (
                  <View key={item.label} style={s.resumoItem}>
                    <Text style={s.resumoLabel}>{item.label}</Text>
                    <Text style={s.resumoValor}>{formatCurrency(item.valor)}</Text>
                  </View>
                ))}
              </View>

              {/* Histórico detalhado com opção de excluir */}
              <View style={s.historicoBox}>
                <Text style={s.historicoTitulo}>Histórico de registros</Text>
                {produtoSelecionado.historico.map((h) => (
                  <View key={h.id_preco} style={s.historicoLinha}>
                    <Text style={s.historicoMes}>
                      {new Date(h.data_referencia + "T12:00:00")
                        .toLocaleDateString("pt-BR", {
                          month: "short",
                          year: "numeric",
                        })
                        .replace(". de ", "/")
                        .replace(".", "")}
                    </Text>
                    <Text style={s.historicoValor}>{formatCurrency(h.preco)}</Text>
                    <TouchableOpacity
                      onPress={() =>
                        excluirPreco(h.id_preco, produtoSelecionado.nome)
                      }
                    >
                      <Text style={s.historicoExcluir}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Lista de produtos */}
          <Text style={s.listaLabel}>Produtos cadastrados</Text>

          {produtosFiltrados.map((produto) => {
            const vari = variacao(produto.historico);
            const varPos = vari >= 0;
            const prAtual =
              produto.historico.length > 0
                ? produto.historico[produto.historico.length - 1].preco
                : 0;
            const selecionado = nomeSelecionado === produto.nome;

            return (
              <TouchableOpacity
                key={produto.nome}
                style={[s.item, selecionado && s.itemSelecionado]}
                onPress={() => setNomeSelecionado(produto.nome)}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    s.itemAccent,
                    { backgroundColor: selecionado ? AZUL : "#E2E8F0" },
                  ]}
                />
                <View style={s.itemInfo}>
                  <Text style={[s.itemNome, selecionado && { color: AZUL }]}>
                    {produto.nome}
                  </Text>
                  <Text style={s.itemCategoria}>
                    {produto.categoria} · {produto.historico.length} registro(s)
                  </Text>
                </View>
                <View style={s.itemDireita}>
                  <Text style={[s.itemPreco, selecionado && { color: AZUL }]}>
                    {formatCurrency(prAtual)}
                  </Text>
                  {produto.historico.length >= 2 && (
                    <View
                      style={[
                        s.variacaoMiniPill,
                        { backgroundColor: varPos ? "#ECFDF5" : "#FEE2E2" },
                      ]}
                    >
                      <Text
                        style={[
                          s.variacaoMiniTexto,
                          { color: varPos ? VERDE : "#DC2626" },
                        ]}
                      >
                        {varPos ? "▲" : "▼"} {Math.abs(vari).toFixed(1)}%
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={{ height: 32 }} />
        </ScrollView>
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
  botaoNovo: {
    backgroundColor: AZUL,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  botaoNovoTexto: { color: "#fff", fontWeight: "bold", fontSize: 13 },

  filtroRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  filtroPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  filtroPillAtivo: { backgroundColor: AZUL, borderColor: AZUL },
  filtroPillTexto: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  filtroPillTextoAtivo: { color: "#fff" },

  graficoCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  graficoTopo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  graficoNome: { fontSize: 15, fontWeight: "700", color: PRETO },
  graficoPreco: { fontSize: 22, fontWeight: "bold", color: AZUL, marginTop: 4 },
  graficoUnidade: { fontSize: 13, fontWeight: "400", color: "#94A3B8" },
  variacaoPill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
  },
  variacaoTexto: { fontSize: 14, fontWeight: "bold" },
  variacaoSub: { fontSize: 10, marginTop: 1 },
  grafico: { borderRadius: 12, marginLeft: -8 },

  resumoRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
  },
  resumoItem: { alignItems: "center" },
  resumoLabel: { fontSize: 11, color: "#94A3B8", marginBottom: 4 },
  resumoValor: { fontSize: 13, fontWeight: "700", color: PRETO },

  historicoBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
  },
  historicoTitulo: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  historicoLinha: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  historicoMes: { flex: 1, fontSize: 13, color: "#64748B" },
  historicoValor: {
    fontSize: 13,
    fontWeight: "700",
    color: PRETO,
    marginRight: 12,
  },
  historicoExcluir: { fontSize: 12, color: "#DC2626", fontWeight: "600" },

  listaLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginHorizontal: 16,
    marginBottom: 10,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  itemSelecionado: { borderColor: AZUL },
  itemAccent: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  itemInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 14 },
  itemNome: { fontSize: 14, fontWeight: "600", color: PRETO },
  itemCategoria: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  itemDireita: { alignItems: "flex-end", paddingRight: 14, gap: 6 },
  itemPreco: { fontSize: 14, fontWeight: "bold", color: PRETO },
  variacaoMiniPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  variacaoMiniTexto: { fontSize: 11, fontWeight: "700" },

  vazio: { alignItems: "center", marginTop: 80, paddingHorizontal: 32 },
  vazioTexto: {
    fontSize: 15,
    color: "#64748B",
    fontWeight: "600",
    textAlign: "center",
  },
  vazioSub: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 8,
    textAlign: "center",
  },
});
