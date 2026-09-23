import { getSupabaseAdminClient } from "../src/lib/supabase/client";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function checkAllTables() {
  const supabase = getSupabaseAdminClient();
  const tables = ["rooms", "room_participants", "room_turns", "characters", "users"];
  
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select("*").limit(2);
    if (error) {
      console.log(`Table ${t}: ERROR ->`, error.message);
    } else {
      console.log(`Table ${t}: OK, row count in sample: ${data.length}`);
    }
  }
}

checkAllTables().catch(console.error);
