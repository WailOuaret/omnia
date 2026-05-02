import { DependencyList, useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { useSessionStore } from "../store/session";

export function useApiData<T>(loader: () => Promise<T>, deps: DependencyList, immediate = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loader();
      setData(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      throw err;
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!immediate) {
      return;
    }
    reload().catch(() => undefined);
  }, [reload, immediate]);

  return { data, loading, error, reload, setData };
}


export function useSessionSummary() {
  const session = useSessionStore((state) => state.session);
  const setSession = useSessionStore((state) => state.setSession);

  useEffect(() => {
    if (!session?.session_id) {
      return;
    }
    api
      .getSession(session.session_id)
      .then(setSession)
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Unknown session")) {
          setSession(null);
        }
      });
  }, [session?.session_id, setSession]);

  return { session, setSession };
}
