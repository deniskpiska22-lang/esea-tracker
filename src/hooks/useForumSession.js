import { resolveForumSession } from "../utils/forum.js";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
// Each account change immediately clears old permissions; responses from old sessions are ignored.
export function useForumSession() {
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  useEffect(() => {
    let active = true;
    if (user && supabase)
      supabase.rpc("forum_session").then(({ data, error }) => {
        if (active && !error) setSession({ userId: user.id, ...data });
      });
    return () => {
      active = false;
    };
  }, [user]);
  return resolveForumSession(session, user?.id);
}
