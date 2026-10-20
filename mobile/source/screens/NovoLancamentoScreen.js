import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  Platform,
  StatusBar,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";
import {
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyInput,
} from "../utils/money";

// Tipos financeiros normais
const TIPOS = [
  { key: "receita", label: "Receita", cor: "#16A34A", bg: "#DCFCE7" },
  { key: "despesa", label: "Despesa", cor: "#DC2626", bg: "#FEE2E2" },
  { key: "custo", label: "Custo", cor: "#9333EA", bg: "#F3E8FF" },
  { key: "investimento", label: "Investimento", cor: "#CA8A04", bg: "#FEF3C7" },
  { key: "saldo_inicial", label: "Saldo inicial", cor: "#2660A4", bg: "#DBEAFE" },
  {
    key: "preco_mercado",
    label: "Preço Mercado",
    cor: "#2660A4",
    bg: "#EDF7F6",
  },
];

// Unidades de medida sugeridas (qualquer segmento de negócio)
const UNIDADES_SUGERIDAS = [
  "unidade",
  "kg",
  "g",
  "litro",
  "ml",
  "caixa",
  "saca",
  "dúzia",
  "metro",
  "hora",
  "serviço",
  "@",
  "ton",
];

// Categorias genéricas para preço de mercado
const CATEGORIAS_PRECO = [
  "Alimentos",
  "Grãos",
  "Carnes",
  "Laticínios",
  "Bebidas",
  "Insumos",
  "Embalagens",
  "Matéria-prima",
  "Serviços",
  "Vestuário",
  "Costura",
  "Mecânica",
  "Outros",
];

const CLASSIFICACOES_DRE = {
  receita_bruta: "Receita bruta",
  deducao_receita: "Dedução da receita",
  custo: "Custo das vendas/serviços",
  despesa_operacional: "Despesa operacional",
  receita_financeira: "Receita financeira",
  despesa_financeira: "Despesa financeira",
  imposto_lucro: "Imposto sobre o lucro",
  investimento: "Fora do DRE (investimento)",
};

const CLASSIFICACOES_POR_TIPO = {
  receita: ["receita_bruta", "receita_financeira"],
  despesa: [
    "deducao_receita",
    "despesa_operacional",
    "despesa_financeira",
    "imposto_lucro",
  ],
  custo: ["custo"],
  investimento: ["investimento"],
};

function classificacaoPadrao(tipo) {
  return {
    receita: "receita_bruta",
    despesa: "despesa_operacional",
    custo: "custo",
    investimento: "investimento",
  }[tipo];
}

function valorParaNumero(texto) {
  return parseCurrencyInput(texto);
}

function formatarDataExtenso(data) {
  if (!data) return "Selecionar data";
  return new Date(data + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function NovoLancamentoScreen({ navigation, route }) {
  // Permite abrir já no tipo certo vindo da tela de preços
  const tipoInicial = route?.params?.tipoInicial ?? "receita";

  const [tipo, setTipo] = useState(tipoInicial);
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categorias, setCategorias] = useState([]);
  const [contas, setContas] = useState([]);
  const [idCategoria, setIdCategoria] = useState(null);
  const [idConta, setIdConta] = useState(route?.params?.idContaInicial ?? null);
  const [classificacaoDre, setClassificacaoDre] = useState(
    classificacaoPadrao(tipoInicial),
  );
  const [carregando, setCarregando] = useState(false);
  const [mostrarCalendario, setMostrarCalendario] = useState(false);

  // Campos exclusivos de preço de mercado
  const [nomeProduto, setNomeProduto] = useState("");
  const [unidade, setUnidade] = useState("");
  const [categoriaPreco, setCategoriaPreco] = useState("");

  const isPreco = tipo === "preco_mercado";
  const isSaldoInicial = tipo === "saldo_inicial";
  const tipoAtual = TIPOS.find((t) => t.key === tipo);

  useEffect(() => {
    if (!isPreco && !isSaldoInicial) {
      api
        .get("/categorias")
        .then(({ data }) => setCategorias(data))
        .catch(() =>
          Alert.alert("Aviso", "Não foi possível carregar as categorias."),
        );
    }
  }, [isPreco, isSaldoInicial]);

  useFocusEffect(
    useCallback(() => {
      if (isPreco) return;
      api
        .get("/contas")
        .then(({ data }) => {
          setContas(data);
          setIdConta((atual) =>
            data.some((conta) => conta.id_conta === atual)
              ? atual
              : data[0]?.id_conta ?? null,
          );
        })
        .catch(() => Alert.alert("Aviso", "Não foi possível carregar as contas."));
    }, [isPreco]),
  );

  const categoriasFiltradas = useMemo(
    () => categorias.filter((c) => c.tipo === tipo),
    [categorias, tipo],
  );

  const categoriaSelecionada = categoriasFiltradas.find(
    (c) => c.id_categoria === idCategoria,
  );

  function trocarTipo(novoTipo) {
    setTipo(novoTipo);
    setIdCategoria(null);
    setClassificacaoDre(classificacaoPadrao(novoTipo));
  }

  async function salvar() {
    if (!valor) return Alert.alert("Atenção", "Informe o valor.");
    if (!data) return Alert.alert("Atenção", "Selecione a data.");

    setCarregando(true);
    try {
      if (isSaldoInicial) {
        const contaSelecionada = contas.find((conta) => conta.id_conta === idConta);
        if (!contaSelecionada) {
          return Alert.alert("Atenção", "Selecione ou cadastre uma conta.");
        }

        await api.put(`/contas/${idConta}`, {
          nome: contaSelecionada.nome,
          saldo_inicial: valorParaNumero(valor),
          data_saldo_inicial: data,
        });
      } else if (isPreco) {
        // Salva na tabela preco_mercado
        if (!nomeProduto.trim())
          return Alert.alert("Atenção", "Informe o nome do produto.");
        if (!unidade.trim())
          return Alert.alert("Atenção", "Informe a unidade.");
        if (!categoriaPreco)
          return Alert.alert("Atenção", "Selecione uma categoria.");

        await api.post("/precos-medios", {
          nome_produto: nomeProduto.trim(),
          unidade: unidade.trim(),
          categoria: categoriaPreco,
          valor: valorParaNumero(valor),
          data_referencia: data,
        });
      } else {
        // Salva na tabela lancamento_financeiro
        const contaSelecionada = contas.find((conta) => conta.id_conta === idConta);
        if (!contaSelecionada)
          return Alert.alert("Atenção", "Selecione ou cadastre uma conta.");
        if (!idCategoria)
          return Alert.alert("Atenção", "Selecione uma categoria.");

        await api.post("/lancamentos", {
          tipo,
          classificacao_dre: classificacaoDre,
          id_conta: idConta,
          valor: valorParaNumero(valor),
          data_lancamento: data,
          descricao: descricao.trim(),
          id_categoria: idCategoria,
        });
      }
      navigation.goBack();
    } catch {
      Alert.alert("Erro", "Não foi possível salvar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <View style={s.container}>
      {/* Header colorido */}
      <View style={[s.header, { backgroundColor: tipoAtual.cor }]}>
        <TouchableOpacity
          style={s.voltarBotao}
          onPress={() => navigation.goBack()}
        >
          <Text style={s.voltarTexto}>Voltar</Text>
        </TouchableOpacity>
        <View style={s.headerCentro}>
          <Text style={s.headerTitulo}>
            {isPreco
              ? "Registrar Preço"
              : isSaldoInicial
                ? "Informar saldo inicial"
                : "Novo lançamento"}
          </Text>
          <Text style={s.headerSub}>
            {isPreco
              ? "Atualize o preço de um produto"
              : isSaldoInicial
                ? "Informe o valor que já havia na conta"
                : "Preencha os dados do lançamento"}
          </Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Seletor de tipo */}
        <View style={s.bloco}>
          <Text style={s.blocoTitulo}>Tipo</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.tiposRow}
          >
            {TIPOS.map((item) => {
              const ativo = item.key === tipo;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    s.tipoChip,
                    ativo && {
                      backgroundColor: item.bg,
                      borderColor: item.cor,
                    },
                  ]}
                  onPress={() => trocarTipo(item.key)}
                >
                  <Text style={[s.tipoChipTexto, ativo && { color: item.cor }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ─── Campos exclusivos: Preço de Mercado ─── */}
        {isPreco && (
          <>
            <View style={s.bloco}>
              <Text style={s.blocoTitulo}>Nome do produto</Text>
              <TextInput
                style={[s.campoTexto, { borderColor: tipoAtual.cor }]}
                placeholder="Ex: Farinha de trigo, Linha de costura, Óleo de motor..."
                placeholderTextColor="#CBD5E1"
                value={nomeProduto}
                onChangeText={setNomeProduto}
              />
            </View>

            <View style={s.bloco}>
              <Text style={s.blocoTitulo}>Unidade</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.tiposRow}
              >
                {UNIDADES_SUGERIDAS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[
                      s.tipoChip,
                      unidade === u && {
                        backgroundColor: tipoAtual.bg,
                        borderColor: tipoAtual.cor,
                      },
                    ]}
                    onPress={() => setUnidade(u)}
                  >
                    <Text
                      style={[
                        s.tipoChipTexto,
                        unidade === u && { color: tipoAtual.cor },
                      ]}
                    >
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput
                style={[s.campoTexto, { borderColor: "#E2E8F0", marginTop: 8 }]}
                placeholder="Ou digite outra unidade..."
                placeholderTextColor="#CBD5E1"
                value={unidade}
                onChangeText={setUnidade}
              />
            </View>

            <View style={s.bloco}>
              <Text style={s.blocoTitulo}>Categoria do produto</Text>
              <View style={s.listaCategorias}>
                {CATEGORIAS_PRECO.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      s.categoriaItem,
                      categoriaPreco === cat && {
                        borderColor: tipoAtual.cor,
                        backgroundColor: tipoAtual.bg,
                      },
                    ]}
                    onPress={() => setCategoriaPreco(cat)}
                  >
                    <Text
                      style={[
                        s.categoriaTexto,
                        categoriaPreco === cat && {
                          color: tipoAtual.cor,
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {cat}
                    </Text>
                    {categoriaPreco === cat && (
                      <Text
                        style={[s.categoriaStatus, { color: tipoAtual.cor }]}
                      >
                        Selecionada
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Valor */}
        <View style={s.bloco}>
          <Text style={s.blocoTitulo}>
            {isPreco ? "Preço atual" : isSaldoInicial ? "Saldo na data-base" : "Valor"}
          </Text>
          <View style={[s.valorCard, { borderColor: tipoAtual.cor }]}>
            <Text style={[s.valorPrefixo, { color: tipoAtual.cor }]}>R$</Text>
            <TextInput
              style={s.valorInput}
              placeholder="0,00"
              placeholderTextColor="#CBD5E1"
              value={valor}
              onChangeText={(t) => setValor(formatCurrencyInput(t))}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Data */}
        <View style={s.bloco}>
          <Text style={s.blocoTitulo}>
            {isPreco
              ? "Data de referência"
              : isSaldoInicial
                ? "Data-base do saldo"
                : "Data"}
          </Text>
          <TouchableOpacity
            style={[
              s.campoCard,
              data && {
                borderColor: tipoAtual.cor,
                backgroundColor: tipoAtual.bg,
              },
            ]}
            onPress={() => setMostrarCalendario(true)}
          >
            <View style={s.campoTextos}>
              <Text style={[s.campoValor, data && { color: tipoAtual.cor }]}>
                {formatarDataExtenso(data)}
              </Text>
              <Text style={s.campoAjuda}>
                {data ? "Toque para alterar" : "Escolha a data"}
              </Text>
            </View>
            <Text style={s.campoAcao}>Selecionar</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Campos exclusivos: Lançamento financeiro ─── */}
        {!isPreco && (
          <>
            <View style={s.bloco}>
              <Text style={s.blocoTitulo}>Conta</Text>
              {contas.length ? (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.tiposRow}
                  >
                    {contas.map((conta) => {
                      const ativa = conta.id_conta === idConta;
                      return (
                        <TouchableOpacity
                          key={conta.id_conta}
                          style={[
                            s.tipoChip,
                            ativa && {
                              backgroundColor: tipoAtual.bg,
                              borderColor: tipoAtual.cor,
                            },
                          ]}
                          onPress={() => setIdConta(conta.id_conta)}
                        >
                          <Text
                            style={[
                              s.tipoChipTexto,
                              ativa && { color: tipoAtual.cor },
                            ]}
                          >
                            {conta.nome}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  {contas.find((conta) => conta.id_conta === idConta)
                    ?.saldo_inicial_configurado ? (
                    <Text style={s.contaSaldo}>
                      Saldo atual: {formatCurrency(
                        contas.find((conta) => conta.id_conta === idConta)
                          ?.saldo_atual ?? 0,
                      )}
                    </Text>
                  ) : (
                    <View>
                      <Text style={s.contaSaldoPendente}>
                        Saldo inicial não informado. Você pode lançar movimentos normalmente.
                      </Text>
                      {!isSaldoInicial && (
                        <TouchableOpacity
                          style={s.gerenciarContas}
                          onPress={() => trocarTipo("saldo_inicial")}
                        >
                          <Text style={s.gerenciarContasTexto}>
                            Informar saldo inicial
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <View style={s.vazioCard}>
                  <Text style={s.vazioTexto}>
                    Cadastre uma conta e informe o saldo que havia nela na data-base.
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={s.gerenciarContas}
                onPress={() => navigation.navigate("Contas")}
              >
                <Text style={s.gerenciarContasTexto}>
                  {contas.length ? "Gerenciar contas e saldos" : "Cadastrar conta"}
                </Text>
              </TouchableOpacity>
            </View>

            {!isSaldoInicial && CLASSIFICACOES_POR_TIPO[tipo]?.length > 1 && (
              <View style={s.bloco}>
                <Text style={s.blocoTitulo}>Classificação no DRE</Text>
                <View style={s.listaCategorias}>
                  {CLASSIFICACOES_POR_TIPO[tipo].map((classificacao) => {
                    const ativa = classificacaoDre === classificacao;
                    return (
                      <TouchableOpacity
                        key={classificacao}
                        style={[
                          s.categoriaItem,
                          ativa && {
                            borderColor: tipoAtual.cor,
                            backgroundColor: tipoAtual.bg,
                          },
                        ]}
                        onPress={() => setClassificacaoDre(classificacao)}
                      >
                        <Text
                          style={[
                            s.categoriaTexto,
                            ativa && {
                              color: tipoAtual.cor,
                              fontWeight: "700",
                            },
                          ]}
                        >
                          {CLASSIFICACOES_DRE[classificacao]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {!isSaldoInicial && (
              <View style={s.bloco}>
                <Text style={s.blocoTitulo}>Categoria</Text>
                {categoriasFiltradas.length === 0 ? (
                  <View style={s.vazioCard}>
                    <Text style={s.vazioTitulo}>
                      Nenhuma categoria disponível
                    </Text>
                    <Text style={s.vazioTexto}>
                      Não existem categorias para este tipo.
                    </Text>
                  </View>
                ) : (
                  <View style={s.listaCategorias}>
                    {categoriasFiltradas.map((categoria) => {
                      const ativa = categoria.id_categoria === idCategoria;
                      return (
                        <TouchableOpacity
                          key={categoria.id_categoria}
                          style={[
                            s.categoriaItem,
                            ativa && {
                              borderColor: tipoAtual.cor,
                              backgroundColor: tipoAtual.bg,
                            },
                          ]}
                          onPress={() => setIdCategoria(categoria.id_categoria)}
                        >
                          <Text
                            style={[
                              s.categoriaTexto,
                              ativa && {
                                color: tipoAtual.cor,
                                fontWeight: "700",
                              },
                            ]}
                          >
                            {categoria.nome}
                          </Text>
                          {ativa && (
                            <Text
                              style={[
                                s.categoriaStatus,
                                { color: tipoAtual.cor },
                              ]}
                            >
                              Selecionada
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {!isSaldoInicial && (
              <View style={s.bloco}>
                <Text style={s.blocoTitulo}>Descrição</Text>
                <TextInput
                  style={s.descricaoInput}
                  placeholder="Adicione uma descrição opcional"
                  placeholderTextColor="#CBD5E1"
                  value={descricao}
                  onChangeText={setDescricao}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            )}

            {/* Resumo */}
            {!isSaldoInicial && <View style={s.bloco}>
              <Text style={s.blocoTitulo}>Resumo</Text>
              <View style={s.resumoCard}>
                {[
                  { label: "Tipo", valor: tipoAtual.label },
                  {
                    label: "Conta",
                    valor:
                      contas.find((conta) => conta.id_conta === idConta)?.nome ||
                      "Não selecionada",
                  },
                  {
                    label: "Classificação DRE",
                    valor: CLASSIFICACOES_DRE[classificacaoDre],
                  },
                  {
                    label: "Valor",
                    valor: valor ? `R$ ${valor}` : "Não informado",
                  },
                  {
                    label: "Data",
                    valor: data ? formatarDataExtenso(data) : "Não selecionada",
                  },
                  {
                    label: "Categoria",
                    valor: categoriaSelecionada?.nome || "Não selecionada",
                  },
                ].map((linha, i, arr) => (
                  <View
                    key={linha.label}
                    style={[
                      s.resumoLinha,
                      i === arr.length - 1 && {
                        borderBottomWidth: 0,
                        paddingBottom: 0,
                      },
                    ]}
                  >
                    <Text style={s.resumoLabel}>{linha.label}</Text>
                    <Text
                      style={[
                        s.resumoValor,
                        linha.label === "Tipo" && { color: tipoAtual.cor },
                      ]}
                    >
                      {linha.valor}
                    </Text>
                  </View>
                ))}
              </View>
            </View>}
          </>
        )}

        {/* Botão salvar */}
        <TouchableOpacity
          style={[
            s.botaoSalvar,
            { backgroundColor: tipoAtual.cor },
            carregando && { opacity: 0.7 },
          ]}
          onPress={salvar}
          disabled={carregando}
        >
          {carregando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.botaoSalvarTexto}>
              {isPreco
                ? "Registrar preço"
                : isSaldoInicial
                  ? "Salvar saldo inicial"
                  : "Salvar lançamento"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Calendário */}
      <Modal visible={mostrarCalendario} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={[s.modalHeader, { backgroundColor: tipoAtual.cor }]}>
              <Text style={s.modalTitulo}>Selecionar data</Text>
            </View>
            <Calendar
              onDayPress={(dia) => {
                setData(dia.dateString);
                setMostrarCalendario(false);
              }}
              markedDates={
                data
                  ? { [data]: { selected: true, selectedColor: tipoAtual.cor } }
                  : {}
              }
              theme={{
                todayTextColor: tipoAtual.cor,
                selectedDayBackgroundColor: tipoAtual.cor,
                arrowColor: tipoAtual.cor,
              }}
            />
            <TouchableOpacity
              style={s.modalCancelar}
              onPress={() => setMostrarCalendario(false)}
            >
              <Text style={s.modalCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  header: {
    paddingTop:
      Platform.OS === "ios" ? 56 : (StatusBar.currentHeight ?? 24) + 12,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  voltarBotao: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 18,
  },
  voltarTexto: { color: "#fff", fontSize: 13, fontWeight: "700" },
  headerCentro: { alignItems: "flex-start" },
  headerTitulo: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.82)", marginTop: 4 },

  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 36 },

  bloco: { marginBottom: 16 },
  blocoTitulo: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },

  tiposRow: { paddingRight: 8, gap: 10 },
  tipoChip: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  tipoChipTexto: { color: "#64748B", fontSize: 14, fontWeight: "600" },
  contaSaldo: { color: "#64748B", fontSize: 12, marginTop: 8, marginLeft: 4 },
  contaSaldoPendente: { color: "#B45309", fontSize: 12, marginTop: 8, marginLeft: 4 },
  gerenciarContas: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 4 },
  gerenciarContasTexto: { color: "#2660A4", fontSize: 13, fontWeight: "700" },

  campoTexto: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1E293B",
  },

  valorCard: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  valorPrefixo: { fontSize: 22, fontWeight: "700", marginRight: 10 },
  valorInput: {
    flex: 1,
    fontSize: 34,
    fontWeight: "bold",
    color: "#0F172A",
    padding: 0,
  },

  campoCard: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  campoTextos: { flex: 1 },
  campoValor: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  campoAjuda: { fontSize: 12, color: "#94A3B8", marginTop: 4 },
  campoAcao: { fontSize: 12, color: "#64748B", fontWeight: "700" },

  listaCategorias: { gap: 10 },
  categoriaItem: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  categoriaTexto: { fontSize: 14, color: "#1E293B", fontWeight: "600" },
  categoriaStatus: { marginTop: 4, fontSize: 12, fontWeight: "600" },

  vazioCard: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 16,
  },
  vazioTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 4,
  },
  vazioTexto: { fontSize: 13, color: "#94A3B8", lineHeight: 19 },

  descricaoInput: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 16,
    minHeight: 110,
    color: "#1E293B",
    fontSize: 15,
  },

  resumoCard: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  resumoLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  resumoLabel: { fontSize: 13, color: "#64748B" },
  resumoValor: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },

  botaoSalvar: {
    marginTop: 4,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  botaoSalvarTexto: { color: "#fff", fontSize: 16, fontWeight: "bold" },

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
  modalCancelarTexto: { color: "#EF4444", fontWeight: "bold", fontSize: 15 },
});
