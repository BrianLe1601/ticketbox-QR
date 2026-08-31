import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  clearStoredToken,
  loginRequest,
  logoutRequest,
  refreshSessionRequest,
  storeToken,
} from "@/services/auth.service";
import type { AuthUser, LoginCredentials } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const restored = await refreshSessionRequest();
        storeToken(restored.accessToken);
        if (active) {
          setToken(restored.accessToken);
          setUser(restored.user);
        }
      } catch {
        clearStoredToken();
        if (active) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  async function login(credentials: LoginCredentials): Promise<AuthUser> {
    const result = await loginRequest(credentials);
    storeToken(result.accessToken);
    setToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }

  function logout(): void {
    void logoutRequest();
    clearStoredToken();
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, token, isLoading, login, logout }),
    [user, token, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
