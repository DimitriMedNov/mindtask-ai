/**
 * Políticas de RLS contra el Supabase local (`supabase start`).
 *
 * Crea dos usuarios normales (sin rol admin, que por diseño sí ve todo), los
 * hace entrar con su propia sesión y comprueba que ninguno alcanza las filas
 * del otro. Al final los borra.
 *
 * Toma la URL y las llaves de SUPABASE_URL, SUPABASE_ANON_KEY y
 * SUPABASE_SERVICE_ROLE_KEY; si no están, se las pide a `supabase status`.
 */
import { execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

function entornoLocal() {
  let url = process.env.SUPABASE_URL;
  let anon = process.env.SUPABASE_ANON_KEY;
  let service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) {
    const status = JSON.parse(execSync("supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
    url ??= status.API_URL;
    anon ??= status.ANON_KEY;
    service ??= status.SERVICE_ROLE_KEY;
  }
  if (!url || !anon || !service) throw new Error("No encontré el Supabase local. Corre `supabase start` primero.");
  return { url, anon, service };
}

const { url, anon, service } = entornoLocal();
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

type Usuario = { id: string; email: string; db: SupabaseClient };
const PASSWORD = "prueba-rls-123456";
const creados: string[] = [];

async function crearUsuario(nombre: string): Promise<Usuario> {
  const email = `${nombre}-${crypto.randomUUID().slice(0, 8)}@rls.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  creados.push(data.user.id);

  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: loginError } = await db.auth.signInWithPassword({ email, password: PASSWORD });
  if (loginError) throw loginError;
  return { id: data.user.id, email, db };
}

let ana: Usuario;
let beto: Usuario;
let tareaDeAna: string;

beforeAll(async () => {
  ana = await crearUsuario("ana");
  beto = await crearUsuario("beto");

  const { data, error } = await ana.db
    .from("tasks")
    .insert({ user_id: ana.id, title: "Tarea privada de Ana", priority: "high", category: "Personal" })
    .select("id")
    .single();
  if (error) throw error;
  tareaDeAna = data.id;
});

afterAll(async () => {
  for (const id of creados) await admin.auth.admin.deleteUser(id);
  // Las tareas no tienen llave foránea a auth.users; se borran aparte
  if (creados.length) await admin.from("tasks").delete().in("user_id", creados);
});

describe("RLS de tasks", () => {
  it("cada usuario empieza con un rol normal, no admin", async () => {
    const { data } = await admin.from("user_roles").select("user_id, role").in("user_id", [ana.id, beto.id]);
    expect(data?.map((r) => r.role)).toEqual(["user", "user"]);
  });

  it("la dueña sí ve su tarea", async () => {
    const { data, error } = await ana.db.from("tasks").select("id, title");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: tareaDeAna, title: "Tarea privada de Ana" }]);
  });

  it("otro usuario no ve las tareas ajenas, ni pidiéndolas por id", async () => {
    const todas = await beto.db.from("tasks").select("id");
    expect(todas.error).toBeNull();
    expect(todas.data).toEqual([]);

    const porId = await beto.db.from("tasks").select("id").eq("id", tareaDeAna);
    expect(porId.data).toEqual([]);

    const porDueño = await beto.db.from("tasks").select("id").eq("user_id", ana.id);
    expect(porDueño.data).toEqual([]);
  });

  it("otro usuario no puede editar una tarea ajena", async () => {
    const { data } = await beto.db.from("tasks").update({ title: "hackeada" }).eq("id", tareaDeAna).select();
    expect(data).toEqual([]);

    const { data: real } = await admin.from("tasks").select("title").eq("id", tareaDeAna).single();
    expect(real?.title).toBe("Tarea privada de Ana");
  });

  it("otro usuario no puede borrar una tarea ajena", async () => {
    const { data } = await beto.db.from("tasks").delete().eq("id", tareaDeAna).select();
    expect(data).toEqual([]);

    const { count } = await admin.from("tasks").select("id", { count: "exact", head: true }).eq("id", tareaDeAna);
    expect(count).toBe(1);
  });

  it("nadie puede crear tareas a nombre de otro", async () => {
    const { error } = await beto.db.from("tasks").insert({ user_id: ana.id, title: "Tarea plantada" });
    expect(error?.message).toMatch(/row-level security/);
  });

  it("sin sesión no se ve nada", async () => {
    const anonimo = createClient(url, anon, { auth: { persistSession: false } });
    const { data } = await anonimo.from("tasks").select("id");
    expect(data).toEqual([]);
  });
});

describe("RLS de las tablas de IA", () => {
  it("nadie puede escribir en ai_usage desde el navegador", async () => {
    const { error } = await ana.db.from("ai_usage").insert({
      user_id: ana.id, function_name: "ai-task-suggestions", kind: "chat",
      provider: "x", model: "x", duration_ms: 1, status: 200,
    });
    expect(error?.message).toMatch(/row-level security/);
  });

  it("consume_ai_quota cuenta por usuario y no deja borrar el historial", async () => {
    const { data, error } = await ana.db.rpc("consume_ai_quota", { p_function: "voice-to-text" });
    expect(error).toBeNull();
    expect(data).toEqual([{ allowed: true, used: 1, retry_after_seconds: 0 }]);

    // Ana ve su registro; Beto no
    expect((await ana.db.from("ai_rate_limits").select("id")).data).toHaveLength(1);
    expect((await beto.db.from("ai_rate_limits").select("id")).data).toEqual([]);

    // Borrar el registro para saltarse el límite no hace nada
    await ana.db.from("ai_rate_limits").delete().eq("user_id", ana.id);
    expect((await ana.db.from("ai_rate_limits").select("id")).data).toHaveLength(1);
  });

  it("consume_ai_quota rechaza nombres de función inventados", async () => {
    const { error } = await ana.db.rpc("consume_ai_quota", { p_function: "otra-cosa" });
    expect(error?.message).toMatch(/Función desconocida/);
  });
});
