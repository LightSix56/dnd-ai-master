import { getSupabaseBrowserClient } from "../src/lib/supabase/client";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function testAuth() {
  const supabase = getSupabaseBrowserClient();
  const email = `hero_${Date.now()}@gmail.com`;
  const password = "Password123!@#";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error("Sign up error:", error);
  } else {
    console.log("Sign up success! User id:", data.user?.id);
    console.log("Session token:", data.session?.access_token ? "present" : "none (email confirmation maybe required)");
  }
}

testAuth().catch(console.error);
