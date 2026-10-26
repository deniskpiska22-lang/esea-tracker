/* eslint-disable react-refresh/only-export-components -- context exports its provider and consumer hook */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabaseClient";

import { createAuthSessionLoader, INITIAL_AUTH_STATE } from "../utils/authSession.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState(INITIAL_AUTH_STATE);
  const loaderRef = useRef(null);

  useEffect(() => {
    const loader = createAuthSessionLoader({
      onChange: setState,
      loadProfile: async userId => {
        const { data, error } = await supabase.from("profiles").select(`
          id, username, display_name, avatar_url, bio, country_code,
          favorite_team_slug, is_admin, created_at, updated_at
        `).eq("id", userId).maybeSingle();
        if (error) throw error;
        return data;
      },
    });
    loaderRef.current = loader;
    if (!supabase) {
      loader.setSession(null);
      return () => { loader.dispose(); loaderRef.current = null; };
    }

    let authEventSeen = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      authEventSeen = true;
      loader.setSession(session, { reload: event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' });
    });
    // INITIAL_SESSION normally supplies the restored session. Keep getSession
    // as a fallback, but never overwrite a newer sign-in/sign-out event.
    supabase.auth.getSession().then(({ data, error }) => {
      if (authEventSeen) return;
      if (error) throw error;
      loader.setSession(data?.session ?? null);
    }).catch(error => {
      if (!authEventSeen) {
        console.error("Failed to initialize auth:", error);
        loader.setSession(null);
      }
    });
    return () => {
      loader.dispose();
      loaderRef.current = null;
      subscription.unsubscribe();
    };
  }, []);

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
    await loaderRef.current?.refreshProfile();
  }

  const value = useMemo(() => ({ ...state, signOut, refreshProfile }), [state]);

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