import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";
import { usePushRegistration } from "../hooks/usePushRegistration";

const AuthContext = createContext({});

// ─── Credenciais para desenvolvimento ────────────────────────
// Login manual obrigatório quando o usuário estiver acessando a app.
const AUTO_LOGIN = false;
const AUTO_EMAIL = "felipe@teste.com";
const AUTO_SENHA = "123456";
// ─────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const token = await AsyncStorage.getItem("token");
        const usuarioSalvo = await AsyncStorage.getItem("usuario");

        if (token && usuarioSalvo) {
          setUsuario(JSON.parse(usuarioSalvo));
          setCarregando(false);
          return;
        }

        // Login automático apenas para ambiente de desenvolvimento, mas
        // desativado por padrão para forçar a tela de autenticação real.
        if (AUTO_LOGIN) {
          const { data } = await api.post("/auth/login", {
            email: AUTO_EMAIL,
            senha: AUTO_SENHA,
          });
          await AsyncStorage.setItem("token", data.token);
          await AsyncStorage.setItem("usuario", JSON.stringify(data.usuario));
          setUsuario(data.usuario);
        } else {
          setUsuario(null);
        }
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

    const { data } = await api.post("/auth/login", {
      email: emailLimpo,
      senha: senhaLimpa,
    });

    await AsyncStorage.setItem("token", data.token);
    await AsyncStorage.setItem("usuario", JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data;
  }

  async function cadastro(dados) {
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
