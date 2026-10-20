import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { LOCAL_DEMO_ACCOUNT, LOCAL_ONLY_MODE } from "../services/appMode";

const AZUL = "#2660A4";
const AMBAR = "#ECA400";
const PRETO = "#050505";
const FUNDO = "#EDF7F6";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleLogin() {
    const emailLimpo = String(email ?? "").trim();
    const senhaLimpa = String(senha ?? "").trim();

    if (!emailLimpo || !senhaLimpa) {
      return Alert.alert("Atenção", "Preencha e-mail e senha.");
    }

    setCarregando(true);
    try {
      await login(emailLimpo, senhaLimpa);
    } catch (erro) {
      const mensagem =
        erro?.response?.data?.erro ||
        erro?.message ||
        "E-mail ou senha incorretos.";
      Alert.alert("Erro", mensagem);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: FUNDO }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "android" ? -64 : 0}
    >
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.topo}>
          <View style={s.logoWrap}>
            <View style={s.logoCircle} />
          </View>
          <Text style={s.titulo}>Valora</Text>
          <Text style={s.subtitulo}>O valor do seu negócio, organizado.</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitulo}>Entrar</Text>
          <Text style={s.cardSubtitulo}>
            Acesse sua conta para acompanhar o fluxo do seu negócio.
          </Text>

          <View style={s.campo}>
            <Text style={s.label}>E-mail</Text>
            <TextInput
              style={s.input}
              placeholder="seuemail@exemplo.com"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
            />
          </View>

          <View style={s.campo}>
            <Text style={s.label}>Senha</Text>
            <TextInput
              style={s.input}
              placeholder="Digite sua senha"
              placeholderTextColor="#94A3B8"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>

          <TouchableOpacity
            style={s.botao}
            onPress={handleLogin}
            disabled={carregando}
          >
            {carregando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.botaoTexto}>Entrar</Text>
            )}
          </TouchableOpacity>

          {LOCAL_ONLY_MODE ? (
            <>
              <Text style={s.link}>
                Acesso local: {LOCAL_DEMO_ACCOUNT.email} /{" "}
                {LOCAL_DEMO_ACCOUNT.password}
              </Text>
              <Text style={s.avisoLocal}>
                Seus dados ficam neste iPhone e não sincronizam com outros
                dispositivos.
              </Text>
            </>
          ) : (
            <TouchableOpacity onPress={() => navigation.navigate("Cadastro")}>
              <Text style={s.link}>Não tem conta? Cadastre-se</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    paddingBottom: 48,
  },

  topo: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoWrap: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: "#DCEBFA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoCircle: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: AMBAR,
  },
  titulo: { fontSize: 34, fontWeight: "bold", color: AZUL, marginBottom: 6 },
  subtitulo: { fontSize: 14, color: "#64748B", textAlign: "center" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitulo: {
    fontSize: 24,
    fontWeight: "bold",
    color: PRETO,
    marginBottom: 6,
  },
  cardSubtitulo: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 19,
    marginBottom: 20,
  },

  campo: { marginBottom: 14 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: PRETO,
  },

  botao: {
    backgroundColor: AZUL,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  botaoTexto: { color: "#fff", fontWeight: "bold", fontSize: 16 },

  link: {
    color: AZUL,
    textAlign: "center",
    marginTop: 18,
    fontSize: 14,
    fontWeight: "600",
  },
  avisoLocal: {
    color: "#64748B",
    textAlign: "center",
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
  },
});
