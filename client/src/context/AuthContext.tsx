import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  AUTH_SESSION_EXPIRED_EVENT,
  clearStoredToken,
  googleLoginRequest,
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
  loginWithGoogle: (idToken: string) => Promise<{ status: "pending" } | { status: "approved"; user: AuthUser }>;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const expireSession = () => {
      clearStoredToken();
      setToken(null);
      setUser(null);
    };
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, expireSession);

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
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, expireSession);
    };
  }, []);

  async function login(credentials: LoginCredentials): Promise<AuthUser> {
    const result = await loginRequest(credentials);
    storeToken(result.accessToken);
    setToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }

  async function loginWithGoogle(idToken: string) {
    const result = await googleLoginRequest(idToken);
    if (result.status === "pending") return result;
    storeToken(result.accessToken);
    setToken(result.accessToken);
    setUser(result.user);
    return { status: "approved" as const, user: result.user };
  }

  function logout(): void {
    void logoutRequest();
    clearStoredToken();
    setToken(null);
    setUser(null);
  }

  function updateUser(nextUser: AuthUser): void {
    setUser(nextUser);
  }

  const value = useMemo(
    () => ({ user, token, isLoading, login, loginWithGoogle, logout, updateUser }),
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
