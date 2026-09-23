import { getSupabaseAdminClient } from "../src/lib/supabase/client";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function inspectData() {
  const supabase = getSupabaseAdminClient();
  const { data: chars, error: charErr } = await supabase.from("characters").select("*").limit(5);
  console.log("Characters:", chars, charErr);
}

inspectData().catch(console.error);
