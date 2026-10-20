import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Calendar } from "react-native-calendars";
import api from "../services/api";
import {
  formatCurrency,
  formatCurrencyInput,
  formatCurrencyInputFromAmount,
  parseCurrencyInput,
} from "../utils/money";

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
  return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR");
}

export default function ContasScreen({ navigation }) {
  const [contas, setContas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [idContaEditando, setIdContaEditando] = useState(null);
  const [nome, setNome] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [dataSaldoInicial, setDataSaldoInicial] = useState(dataLocal(new Date()));
  const [mostrarCalendario, setMostrarCalendario] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get("/contas");
      setContas(data);
    } catch {
      Alert.alert("Erro", "Não foi possível carregar as contas.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  function limparFormulario() {
    setIdContaEditando(null);
    setNome("");
    setSaldoInicial("");
    setDataSaldoInicial(dataLocal(new Date()));
  }

  function editar(conta) {
    setIdContaEditando(conta.id_conta);
    setNome(conta.nome);
    setSaldoInicial(formatCurrencyInputFromAmount(conta.saldo_inicial));
    setDataSaldoInicial(conta.data_saldo_inicial);
  }

  async function salvar() {
    const saldo = parseCurrencyInput(saldoInicial);
    if (!nome.trim()) return Alert.alert("Atenção", "Informe o nome da conta.");
    if (!saldoInicial.trim() || !Number.isFinite(saldo)) {
      return Alert.alert("Atenção", "Informe um saldo inicial válido.");
    }

    setSalvando(true);
    try {
      const payload = {
        nome: nome.trim(),
        saldo_inicial: saldo,
        data_saldo_inicial: dataSaldoInicial,
      };
      if (idContaEditando) {
        await api.put(`/contas/${idContaEditando}`, payload);
      } else {
        await api.post("/contas", payload);
      }
      limparFormulario();
      await carregar();
    } catch {
      Alert.alert("Erro", "Não foi possível salvar a conta.");
    } finally {
      setSalvando(false);
    }
  }

  const totalAtual = contas.reduce(
    (total, conta) => total + Number(conta.saldo_atual || 0),
    0,
  );
  const saldoConfigurado =
    contas.length > 0 && contas.every((conta) => conta.saldo_inicial_configurado);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.voltar} onPress={() => navigation.goBack()}>
          <Text style={s.voltarTexto}>Voltar</Text>
        </TouchableOpacity>
        <Text style={s.titulo}>Contas e saldos</Text>
        <Text style={s.subtitulo}>Acompanhe o dinheiro disponível e suas movimentações</Text>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.conteudo}
      >
        {carregando ? (
          <ActivityIndicator color={AZUL} size="large" style={s.loading} />
        ) : (
          <>
            <View style={s.totalCard}>
              <Text style={s.totalLabel}>Saldo total atual</Text>
              <Text style={s.totalValor}>
                {saldoConfigurado
                  ? formatCurrency(totalAtual)
                  : "Configure o saldo inicial de cada conta"}
              </Text>
            </View>

            <View style={s.formulario}>
              <Text style={s.secaoTitulo}>
                {idContaEditando ? "Editar conta e saldo inicial" : "Adicionar conta"}
              </Text>
              <Text style={s.campoLabel}>Nome da conta</Text>
              <TextInput
                style={s.input}
                placeholder="Ex.: Banco, carteira, caixa"
                placeholderTextColor="#94A3B8"
                value={nome}
                onChangeText={setNome}
              />
              <Text style={s.campoLabel}>Saldo no início da data-base</Text>
              <View style={s.saldoInputLinha}>
                <Text style={s.moedaPrefixo}>R$</Text>
                <TextInput
                  style={[s.input, s.saldoInput]}
                  placeholder="0,00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                  value={saldoInicial}
                  onChangeText={(value) => setSaldoInicial(formatCurrencyInput(value))}
                />
              </View>
              <Text style={s.campoLabel}>Data em que esse saldo era válido</Text>
              <TouchableOpacity
                style={s.dataBotao}
                onPress={() => setMostrarCalendario(true)}
              >
                <Text style={s.dataValor}>{formatarData(dataSaldoInicial)}</Text>
                <Text style={s.dataAcao}>Alterar</Text>
              </TouchableOpacity>
              <Text style={s.ajuda}>
                Entradas e saídas nesta data e nas seguintes atualizam o saldo.
              </Text>
              <View style={s.acoesForm}>
                {idContaEditando && (
                  <TouchableOpacity style={s.cancelarBotao} onPress={limparFormulario}>
                    <Text style={s.cancelarTexto}>Cancelar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[s.salvarBotao, salvando && s.botaoDesabilitado]}
                  onPress={salvar}
                  disabled={salvando}
                >
                  {salvando ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.salvarTexto}>
                      {idContaEditando ? "Salvar alterações" : "Adicionar conta"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.listaContas}>
              <Text style={s.secaoTitulo}>Contas cadastradas</Text>
              {contas.length ? (
                contas.map((conta) => (
                  <View key={conta.id_conta} style={s.contaItem}>
                    <View style={s.contaTopo}>
                      <Text style={s.contaNome}>{conta.nome}</Text>
                      <TouchableOpacity onPress={() => editar(conta)}>
                        <Text style={s.editarTexto}>Editar</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={s.contaSaldoAtual}>
                      {conta.saldo_inicial_configurado
                        ? formatCurrency(conta.saldo_atual)
                        : "Saldo inicial pendente"}
                    </Text>
                    <Text style={s.contaBase}>
                      Saldo inicial de {formatarData(conta.data_saldo_inicial)}: {formatCurrency(conta.saldo_inicial)}
                    </Text>
                    <View style={s.movimentosLinha}>
                      <View style={s.movimentoItem}>
                        <Text style={s.movimentoLabel}>Entradas</Text>
                        <Text style={[s.movimentoValor, { color: VERDE }]}>
                          {formatCurrency(conta.entradas)}
                        </Text>
                      </View>
                      <View style={s.divisor} />
                      <View style={s.movimentoItem}>
                        <Text style={s.movimentoLabel}>Saídas</Text>
                        <Text style={[s.movimentoValor, { color: VERMELHO }]}>
                          {formatCurrency(conta.saidas)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={s.vazio}>Nenhuma conta cadastrada.</Text>
              )}
            </View>

            <Text style={s.observacao}>
              Movimentações entre contas próprias não são registradas nesta versão. Não as lance como receita ou despesa.
            </Text>
          </>
        )}
      </ScrollView>

      <Modal
        visible={mostrarCalendario}
        transparent
        animationType="fade"
        onRequestClose={() => setMostrarCalendario(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setMostrarCalendario(false)}>
          <Pressable>
            <View style={s.modalBox}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitulo}>Data-base do saldo</Text>
              </View>
              <Calendar
                current={dataSaldoInicial}
                maxDate={dataLocal(new Date())}
                onDayPress={(dia) => {
                  setDataSaldoInicial(dia.dateString);
                  setMostrarCalendario(false);
                }}
                markedDates={{
                  [dataSaldoInicial]: { selected: true, selectedColor: AZUL },
                }}
                theme={{
                  todayTextColor: AZUL,
                  selectedDayBackgroundColor: AZUL,
                  arrowColor: AZUL,
                }}
              />
              <TouchableOpacity
                style={s.modalCancelar}
                onPress={() => setMostrarCalendario(false)}
              >
                <Text style={s.modalCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: FUNDO },
  header: {
    backgroundColor: "#fff",
    paddingTop: Platform.OS === "ios" ? 54 : (StatusBar.currentHeight ?? 24) + 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  voltar: { alignSelf: "flex-start", paddingVertical: 6, marginBottom: 8 },
  voltarTexto: { color: AZUL, fontWeight: "700", fontSize: 13 },
  titulo: { color: "#0F172A", fontSize: 24, fontWeight: "700" },
  subtitulo: { color: "#64748B", fontSize: 13, lineHeight: 18, marginTop: 4 },
  conteudo: { padding: 16, paddingBottom: 32 },
  loading: { marginTop: 64 },
  totalCard: { backgroundColor: AZUL, borderRadius: 12, padding: 18, marginBottom: 14 },
  totalLabel: { color: "rgba(255,255,255,0.78)", fontSize: 13 },
  totalValor: { color: "#fff", fontSize: 28, fontWeight: "700", marginTop: 6 },
  formulario: { backgroundColor: "#fff", borderRadius: 12, padding: 16 },
  secaoTitulo: { color: "#0F172A", fontSize: 16, fontWeight: "700", marginBottom: 14 },
  campoLabel: { color: "#475569", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 10 },
  input: {
    minHeight: 46,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#0F172A",
    fontSize: 14,
  },
  saldoInputLinha: { flexDirection: "row", alignItems: "center", gap: 8 },
  moedaPrefixo: { color: "#64748B", fontWeight: "700" },
  saldoInput: { flex: 1 },
  dataBotao: {
    minHeight: 46,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dataValor: { color: "#0F172A", fontSize: 14, fontWeight: "600" },
  dataAcao: { color: AZUL, fontSize: 12, fontWeight: "700" },
  ajuda: { color: "#64748B", fontSize: 11, lineHeight: 16, marginTop: 6 },
  acoesForm: { flexDirection: "row", gap: 8, marginTop: 16 },
  salvarBotao: {
    minHeight: 46,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AZUL,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  botaoDesabilitado: { opacity: 0.65 },
  salvarTexto: { color: "#fff", fontWeight: "700", fontSize: 14 },
  cancelarBotao: { minHeight: 46, justifyContent: "center", paddingHorizontal: 12 },
  cancelarTexto: { color: "#64748B", fontWeight: "600" },
  listaContas: { marginTop: 20 },
  contaItem: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 10 },
  contaTopo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  contaNome: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
  editarTexto: { color: AZUL, fontSize: 12, fontWeight: "700" },
  contaSaldoAtual: { color: "#0F172A", fontWeight: "700", fontSize: 22, marginTop: 10 },
  contaBase: { color: "#64748B", fontSize: 11, marginTop: 4 },
  movimentosLinha: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
  },
  movimentoItem: { flex: 1 },
  movimentoLabel: { color: "#64748B", fontSize: 11 },
  movimentoValor: { fontSize: 13, fontWeight: "700", marginTop: 3 },
  divisor: { width: 1, height: 30, backgroundColor: "#E2E8F0", marginHorizontal: 10 },
  vazio: { color: "#64748B", fontSize: 13, paddingVertical: 8 },
  observacao: { color: "#64748B", fontSize: 11, lineHeight: 16, marginTop: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden" },
  modalHeader: { backgroundColor: AZUL, padding: 16 },
  modalTitulo: { color: "#fff", fontSize: 16, fontWeight: "700" },
  modalCancelar: { padding: 14, alignItems: "center", borderTopWidth: 1, borderColor: "#F1F5F9" },
  modalCancelarTexto: { color: "#64748B", fontWeight: "600" },
});