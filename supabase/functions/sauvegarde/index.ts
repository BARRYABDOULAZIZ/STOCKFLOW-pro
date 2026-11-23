// Sauvegarde quotidienne de BoromBoutik (appelée chaque jour par pg_cron).
// Exporte chaque table du schéma public en JSON dans le bucket privé « sauvegardes »,
// dans un dossier AAAA-MM-JJ/, et ne garde que les 14 derniers jours.
import { createClient } from "jsr:@supabase/supabase-js@2";

const GARDER = 14;

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Seul l'appel programmé (qui connaît la clé gardée dans Vault) peut lancer la sauvegarde
  const cle = req.headers.get("x-cle") ?? "";
  const { data: ok } = await sb.rpc("sauvegarde_cle_ok", { p: cle });
  if (!ok) return new Response(JSON.stringify({ error: "refusé" }), { status: 403 });

  const jour = new Date().toISOString().slice(0, 10);
  const { data: tables, error: eT } = await sb.rpc("sauvegarde_tables");
  if (eT) return new Response(JSON.stringify({ error: eT.message }), { status: 500 });

  const bilan: Record<string, number | string> = {};
  for (const t of (tables as string[])) {
    const lignes: unknown[] = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await sb.from(t).select("*").range(i, i + 999);
      if (error) { bilan[t] = "erreur : " + error.message; break; }
      lignes.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    if (typeof bilan[t] === "string") continue;
    const corps = new Blob([JSON.stringify(lignes)], { type: "application/json" });
    const { error: eU } = await sb.storage.from("sauvegardes").upload(`${jour}/${t}.json`, corps, { upsert: true, contentType: "application/json" });
    bilan[t] = eU ? "erreur envoi : " + eU.message : lignes.length;
  }

  // Ménage : on ne garde que les GARDER derniers jours
  const { data: dossiers } = await sb.storage.from("sauvegardes").list("", { limit: 1000 });
  const jours = (dossiers ?? []).map((d) => d.name).filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
  const aSupprimer = jours.slice(0, Math.max(0, jours.length - GARDER));
  for (const j of aSupprimer) {
    const { data: fichiers } = await sb.storage.from("sauvegardes").list(j, { limit: 1000 });
    if (fichiers?.length) await sb.storage.from("sauvegardes").remove(fichiers.map((f) => `${j}/${f.name}`));
  }

  return new Response(JSON.stringify({ jour, tables: bilan, supprimes: aSupprimer }), {
    headers: { "Content-Type": "application/json" },
  });
});
