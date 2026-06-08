import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet: CookieToSet[]) {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // setAll called from a Server Component — ignore; middleware refreshes.
        }
      },
    },
  });
}
