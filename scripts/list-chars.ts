import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import { getSupabaseAdminClient } from "../src/lib/supabase/client";

async function listCharacters() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("characters").select("id, user_id, name, data").limit(10);
  console.log("Characters count:", data?.length, error);
  data?.forEach((c) => {
    console.log(`Char: ${c.id} | User: ${c.user_id} | Name: ${c.name} | Level: ${c.data?.level}`);
  });
}

listCharacters().catch(console.error);
