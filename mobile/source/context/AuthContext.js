import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";
import { usePushRegistration } from "../hooks/usePushRegistration";
import { LOCAL_DEMO_ACCOUNT, LOCAL_ONLY_MODE } from "../services/appMode";

const AuthContext = createContext({});

function validarRespostaLogin(data) {
  if (
    typeof data?.token !== "string" ||
    !data.token.trim() ||
    !data.usuario ||
    typeof data.usuario !== "object"
  ) {
    throw new Error("O servidor não retornou os dados de acesso esperados.");
  }

  return data;
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const token = await AsyncStorage.getItem("token");
        const usuarioSalvo = await AsyncStorage.getItem("usuario");

        if (token === "sessao-local" && usuarioSalvo) {
          setUsuario(JSON.parse(usuarioSalvo));
          setCarregando(false);
          return;
        }

        await AsyncStorage.removeItem("token");
        await AsyncStorage.removeItem("usuario");
        setUsuario(null);
      } catch (err) {
        console.error("Erro ao carregar sessão:", err);
        setUsuario(null);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  usePushRegistration(usuario);

  async function login(email, senha) {
    const emailLimpo = String(email ?? "").trim().toLowerCase();
    const senhaLimpa = String(senha ?? "").trim();

    if (!emailLimpo || !senhaLimpa) {
      throw new Error("E-mail e senha são obrigatórios.");
    }

    if (LOCAL_ONLY_MODE) {
      if (
        emailLimpo !== LOCAL_DEMO_ACCOUNT.email ||
        senhaLimpa !== LOCAL_DEMO_ACCOUNT.password
      ) {
        throw new Error("E-mail ou senha incorretos.");
      }

      const tokenLocal = "sessao-local";
      await AsyncStorage.setItem("token", tokenLocal);
      await AsyncStorage.setItem(
        "usuario",
        JSON.stringify(LOCAL_DEMO_ACCOUNT.user),
      );
      setUsuario(LOCAL_DEMO_ACCOUNT.user);
      return { token: tokenLocal, usuario: LOCAL_DEMO_ACCOUNT.user };
    }

    const { data: resposta } = await api.post("/auth/login", {
      email: emailLimpo,
      senha: senhaLimpa,
    });
    const data = validarRespostaLogin(resposta);

    await AsyncStorage.setItem("token", data.token);
    await AsyncStorage.setItem("usuario", JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data;
  }

  async function cadastro(dados) {
    if (LOCAL_ONLY_MODE) {
      throw new Error("O cadastro não está disponível no modo somente local.");
    }
    await api.post("/auth/cadastro", dados);
  }

  async function logout() {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("usuario");
    setUsuario(null);
  }

  return (
    <AuthContext.Provider
      value={{ usuario, carregando, login, cadastro, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
