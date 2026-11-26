// Боевые модули рас: каждый файл при загрузке регистрирует себя в class-hooks.ts / class-kit.ts.
// Импортируется из classes/combat-index.ts, чтобы движок подхватывал расовые механики один раз.
import "./race-combat";
import "./core-phb-combat";
import "./legacy-volo-mtf-combat";
import "./legacy-settings-combat";
import "./mpmm-combat";
