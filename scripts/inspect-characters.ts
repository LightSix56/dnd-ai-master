import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import { getSupabaseAdminClient } from "../src/lib/supabase/client";

async function inspectCharactersSchema() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("characters").select("*").limit(1);
  console.log("Characters query:", data, error);
}

inspectCharactersSchema().catch(console.error);
