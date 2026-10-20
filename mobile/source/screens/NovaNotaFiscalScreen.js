import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  StatusBar,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Calendar } from "react-native-calendars";
import { useSupabaseUpload } from "../hooks/useSupabaseUpload";
import api from "../services/api";
import { LOCAL_ONLY_MODE } from "../services/appMode";

const AZUL = "#2660A4";
const PRETO = "#050505";

function fmtData(data) {
  if (!data) return "Selecionar data";
  return new Date(data + "T12:00:00").toLocaleDateString("pt-BR");
}

export default function NovaNotaFiscalScreen({ navigation }) {
  const [nomeCliente, setNomeCliente] = useState("");
  const [dataVenda, setDataVenda] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState(null); // { uri, tipo, nome }
  const [mostrarCal, setMostrarCal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const { upload, uploading } = useSupabaseUpload();

  async function escolherImagem() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return Alert.alert("Permissão negada", "Precisamos de acesso à galeria.");
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setArquivo({
        uri: asset.uri,
        tipo: "image",
        nome: asset.fileName ?? `foto_${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
    }
  }

  async function escolherPDF() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setArquivo({
        uri: asset.uri,
        tipo: "pdf",
        nome: asset.name,
        mimeType: "application/pdf",
      });
    }
  }

  async function salvar() {
    if (!nomeCliente.trim())
      return Alert.alert("Atenção", "Informe o nome do cliente.");
    if (!dataVenda) return Alert.alert("Atenção", "Selecione a data da venda.");
    if (!arquivo) return Alert.alert("Atenção", "Selecione um arquivo.");

    setSalvando(true);
    try {
      let arquivoUrl;
      if (LOCAL_ONLY_MODE) {
        const diretorio = `${FileSystem.documentDirectory}notas/`;
        await FileSystem.makeDirectoryAsync(diretorio, { intermediates: true });
        const extensao = arquivo.tipo === "pdf" ? "pdf" : "jpg";
        const destino = `${diretorio}${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}.${extensao}`;
        await FileSystem.copyAsync({ from: arquivo.uri, to: destino });
        arquivoUrl = destino;
      } else {
        arquivoUrl = await upload(arquivo);
      }
      if (!arquivoUrl) throw new Error("Falha no upload do arquivo.");

      await api.post("/notas", {
        nome_cliente: nomeCliente.trim(),
        data_venda: dataVenda,
        descricao: descricao.trim(),
        arquivo_url: arquivoUrl,
        arquivo_tipo: arquivo.tipo,
      });

      Alert.alert("Sucesso", "Nota fiscal cadastrada com sucesso!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Não foi possível salvar a nota fiscal.");
    } finally {
      setSalvando(false);
    }
  }

  const carregando = salvando || uploading;

  return (
    <View style={s.container}>
      <View style={[s.header, { backgroundColor: AZUL }]}>
        <TouchableOpacity
          style={s.voltarBotao}
          onPress={() => navigation.goBack()}
        >
          <Text style={s.voltarTexto}>Voltar</Text>
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Nova Nota Fiscal</Text>
        <Text style={s.headerSub}>Preencha os dados e anexe o arquivo</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Nome do cliente */}
        <View style={s.bloco}>
          <Text style={s.blocoTitulo}>Nome do cliente</Text>
          <TextInput
            style={s.input}
            placeholder="Ex: João da Silva"
            placeholderTextColor="#CBD5E1"
            value={nomeCliente}
            onChangeText={setNomeCliente}
          />
        </View>

        {/* Data da venda */}
        <View style={s.bloco}>
          <Text style={s.blocoTitulo}>Data da venda</Text>
          <TouchableOpacity
            style={[
              s.dataCard,
              dataVenda && { borderColor: AZUL, backgroundColor: "#EFF6FF" },
            ]}
            onPress={() => setMostrarCal(true)}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={dataVenda ? AZUL : "#94A3B8"}
            />
            <Text style={[s.dataTexto, dataVenda && { color: AZUL }]}>
              {fmtData(dataVenda)}
            </Text>
          </TouchableOpacity>

          {mostrarCal && (
            <View style={s.calBox}>
              <Calendar
                onDayPress={(d) => {
                  setDataVenda(d.dateString);
                  setMostrarCal(false);
                }}
                markedDates={
                  dataVenda
                    ? { [dataVenda]: { selected: true, selectedColor: AZUL } }
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
                onPress={() => setMostrarCal(false)}
              >
                <Text style={s.calCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Descrição */}
        <View style={s.bloco}>
          <Text style={s.blocoTitulo}>
            Descrição <Text style={s.opcional}>(opcional)</Text>
          </Text>
          <TextInput
            style={[s.input, s.inputMulti]}
            placeholder="Ex: Venda de produtos para festa..."
            placeholderTextColor="#CBD5E1"
            value={descricao}
            onChangeText={setDescricao}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Upload do arquivo */}
        <View style={s.bloco}>
          <Text style={s.blocoTitulo}>Arquivo da nota fiscal</Text>

          {arquivo ? (
            <View style={s.arquivoCard}>
              {arquivo.tipo === "image" ? (
                <Image
                  source={{ uri: arquivo.uri }}
                  style={s.preview}
                  resizeMode="cover"
                />
              ) : (
                <View style={s.pdfPreview}>
                  <Ionicons name="document-text" size={40} color={AZUL} />
                  <Text style={s.pdfNome} numberOfLines={2}>
                    {arquivo.nome}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={s.trocarBotao}
                onPress={() => setArquivo(null)}
              >
                <Text style={s.trocarTexto}>Trocar arquivo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.uploadOpcoes}>
              <TouchableOpacity style={s.uploadOpcao} onPress={escolherImagem}>
                <View
                  style={[s.uploadIconeWrap, { backgroundColor: "#EDE9FE" }]}
                >
                  <Ionicons name="image-outline" size={28} color="#7C3AED" />
                </View>
                <Text style={s.uploadOpcaoTitulo}>Imagem</Text>
                <Text style={s.uploadOpcaoSub}>JPG, PNG, WEBP</Text>
              </TouchableOpacity>

              <View style={s.uploadDivisor} />

              <TouchableOpacity style={s.uploadOpcao} onPress={escolherPDF}>
                <View
                  style={[s.uploadIconeWrap, { backgroundColor: "#FEF3C7" }]}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={28}
                    color="#D97706"
                  />
                </View>
                <Text style={s.uploadOpcaoTitulo}>PDF</Text>
                <Text style={s.uploadOpcaoSub}>Arquivo PDF</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Botão salvar */}
        <TouchableOpacity
          style={[s.botaoSalvar, carregando && { opacity: 0.7 }]}
          onPress={salvar}
          disabled={carregando}
        >
          {carregando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={s.botaoSalvarConteudo}>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              <Text style={s.botaoSalvarTexto}>Salvar nota fiscal</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  headerTitulo: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.82)", marginTop: 4 },

  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

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
  opcional: {
    fontSize: 11,
    fontWeight: "400",
    color: "#94A3B8",
    textTransform: "none",
  },

  input: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: PRETO,
  },
  inputMulti: { minHeight: 90 },

  dataCard: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dataTexto: { fontSize: 15, color: "#94A3B8", fontWeight: "500" },

  calBox: {
    marginTop: 10,
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

  uploadOpcoes: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    flexDirection: "row",
    overflow: "hidden",
  },
  uploadOpcao: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  uploadIconeWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  uploadOpcaoTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: PRETO,
    marginBottom: 3,
  },
  uploadOpcaoSub: { fontSize: 11, color: "#94A3B8" },
  uploadDivisor: { width: 1, backgroundColor: "#E2E8F0", marginVertical: 16 },

  arquivoCard: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: AZUL,
    borderRadius: 20,
    overflow: "hidden",
  },
  preview: { width: "100%", height: 200 },
  pdfPreview: { alignItems: "center", paddingVertical: 32, gap: 10 },
  pdfNome: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    paddingHorizontal: 16,
  },
  trocarBotao: {
    padding: 14,
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
  },
  trocarTexto: { fontSize: 13, color: "#EF4444", fontWeight: "600" },

  botaoSalvar: {
    backgroundColor: AZUL,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  botaoSalvarConteudo: { flexDirection: "row", alignItems: "center", gap: 8 },
  botaoSalvarTexto: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
