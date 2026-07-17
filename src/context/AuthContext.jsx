import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        username,
        display_name,
        avatar_url,
        bio,
        country_code,
        favorite_team_slug,
        account_type,
        team_slug,
        team_role,
        verification_status,
        is_admin,
        created_at,
        updated_at
      `)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to load profile:", error);
      setProfile(null);
      return;
    }

    setProfile(data);
  }, []);

  useEffect(() => {
    let active = true;

    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    async function initializeAuth() {
      try {
        const {
          data,
          error,
        } = await supabase.auth.getSession();

        if (!active) {
          return;
        }

        if (error) {
          throw error;
        }

        const currentSession =
          data?.session ?? null;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await loadProfile(
            currentSession.user.id
          );
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error(
          "Failed to initialize auth:",
          error
        );

        if (active) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (nextSession?.user) {
          window.setTimeout(() => {
            loadProfile(nextSession.user.id);
          }, 0);
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  async function signOut() {
    if (!supabase) {
      throw new Error(
        "Supabase is not configured"
      );
    }

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }

  async function refreshProfile() {
    if (!user?.id) {
      setProfile(null);
      return;
    }

    await loadProfile(user.id);
  }

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      signOut,
      refreshProfile,
    }),
    [
      session,
      user,
      profile,
      loading,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}