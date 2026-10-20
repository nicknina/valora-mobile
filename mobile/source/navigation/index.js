import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";

import LoginScreen from "../screens/LoginScreen";
import CadastroScreen from "../screens/CadastroScreen";
import HomeScreen from "../screens/HomeScreen";
import LancamentosScreen from "../screens/LancamentosScreen";
import NovoLancamentoScreen from "../screens/NovoLancamentoScreen";
import PrecosMediosScreen from "../screens/PrecosMediosScreen";
import NotasScreen from "../screens/NotasScreen";
import NovaNotaFiscalScreen from "../screens/NovaNotaFiscalScreen";
import AlertasScreen from "../screens/AlertasScreen"; // FIX: novo import
import DreScreen from "../screens/DreScreen";
import ContasScreen from "../screens/ContasScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabsAutenticadas() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2660A4",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#E2E8F0",
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: "Início",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Lancamentos"
        component={LancamentosScreen}
        options={{
          tabBarLabel: "Lançamentos",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "swap-vertical" : "swap-vertical-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="PrecosMedios"
        component={PrecosMediosScreen}
        options={{
          tabBarLabel: "Preços",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "trending-up" : "trending-up-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Notas"
        component={NotasScreen}
        options={{
          tabBarLabel: "Notas",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "document-text" : "document-text-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="DRE"
        component={DreScreen}
        options={{
          tabBarLabel: "DRE",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "calculator" : "calculator-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { usuario } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {usuario ? (
          <>
            <Stack.Screen name="Tabs" component={TabsAutenticadas} />
            <Stack.Screen
              name="NovoLancamento"
              component={NovoLancamentoScreen}
            />
            <Stack.Screen
              name="NovaNotaFiscal"
              component={NovaNotaFiscalScreen}
            />
            <Stack.Screen name="Contas" component={ContasScreen} />
            {/* FIX: Alertas acessível via botão na Home, fora das tabs */}
            <Stack.Screen name="Alertas" component={AlertasScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Cadastro" component={CadastroScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}