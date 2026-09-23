import { getSupabaseAdminClient } from "../src/lib/supabase/client";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function listUsers() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Error listing users:", error.message);
  } else {
    console.log("Users count:", data.users.length);
    data.users.forEach((u) => console.log(`User: ${u.id} - ${u.email}`));
  }
}

listUsers().catch(console.error);
