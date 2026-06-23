"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatBRL, parseToCents } from "@/lib/format";
import { generatePixBRCode, normalizePixKey, type PixKeyType } from "@/lib/pix";
import { PixDisplay } from "@/components/PixDisplay";
import { msgPix, msgLembrete } from "@/lib/whatsapp";

type Charge = {
  id: string;
  client_name: string | null;
  client_phone: string | null;
  description: string | null;
  amount_cents: number;
  status: "pendente" | "pago" | "atrasado";
  pix_payload: string | null;
  due_date: string | null;
  paid_at: string | null;
  reminders_sent: number;
  recurrence: "none" | "weekly" | "biweekly" | "monthly";
  next_due_date: string | null;
  booking_id: string | null;
  scheduled_reminder_at: string | null;
  auto_reminder: boolean;
  last_auto_reminder_at: string | null;
};

type Profile = {
  id: string;
  pix_key: string | null;
  pix_key_type: string | null;
  pix_merchant_name: string | null;
  pix_merchant_city: string | null;
  whatsapp_provider: string;
  whatsapp_token: string | null;
  whatsapp_instance_id: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-700",
  pago:     "bg-brand-light text-brand-dark",
  atrasado: "bg-red-100 text-red-600",
};

const RECURRENCE_LABELS: Record<string, string> = {
  none: "Sem recorrência",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

function nextDate(from: string, rec: string): string {
  const d = new Date(from + "T00:00:00");
  if (rec === "weekly") d.setDate(d.getDate() + 7);
  else if (rec === "biweekly") d.setDate(d.getDate() + 14);
  else if (rec === "monthly") d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export default function CobrancasPage() {
  const supabase = createClient();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"todos" | "pendente" | "pago" | "atrasado">("todos");
  const [showModal, setShowModal] = useState(false);
  const [openPix, setOpenPix] = useState<string | null>(null); // charge id
  const [toast, setToast] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Form nova cobrança
  const [fClientName, setFClientName] = useState("");
  const [fClientPhone, setFClientPhone] = useState("");
  const [fDescription, setFDescription] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fDueDate, setFDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [fRecurrence, setFRecurrence] = useState("none");
  const [fAutoReminder, setFAutoReminder] = useState(false);
  const [fScheduledAt, setFScheduledAt] = useState("");
  const [fSaving, setFSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: p } = await supabase
      .from("profiles")
      .select("id, pix_key, pix_key_type, pix_merchant_name, pix_merchant_city, whatsapp_provider, whatsapp_token, whatsapp_instance_id")
      .eq("id", user.id)
      .single();
    setProfile(p);

    let q = supabase
      .from("charges")
      .select("*")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false });

    if (filterStatus !== "todos") q = q.eq("status", filterStatus);

    const { data } = await q;
    setCharges((data as Charge[]) || []);
    setLoading(false);
  }, [supabase, filterStatus]);

  useEffect(() => { load(); }, [load]);

  // Cobranças recorrentes que vencem hoje
  const today = new Date().toISOString().slice(0, 10);
  const dueToday = charges.filter(
    (c) => c.recurrence !== "none" && c.status === "pendente" && c.next_due_date && c.next_due_date <= today
  );

  async function marcarPago(charge: Charge) {
    setActionId(charge.id + "-pago");
    await supabase.from("charges").update({ status: "pago", paid_at: new Date().toISOString() }).eq("id", charge.id);

    // Se recorrente, cria próxima cobrança
    if (charge.recurrence !== "none" && profile?.pix_key) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const nextDue = nextDate(charge.due_date || today, charge.recurrence);
        let pix_payload: string | null = null;
        try {
          pix_payload = generatePixBRCode({
            pixKey: normalizePixKey(profile.pix_key, (profile.pix_key_type as PixKeyType) || "celular"),
            amount: charge.amount_cents / 100,
            merchantName: profile.pix_merchant_name || "PROFISSIONAL",
            merchantCity: profile.pix_merchant_city || "BR",
            txid: ("REC" + Date.now()).slice(0, 25),
          });
        } catch { /* gera sem payload */ }

        await supabase.from("charges").insert({
          profile_id: user.id,
          client_name: charge.client_name,
          client_phone: charge.client_phone,
          description: charge.description,
          amount_cents: charge.amount_cents,
          pix_payload,
          due_date: nextDue,
          recurrence: charge.recurrence,
          next_due_date: nextDate(nextDue, charge.recurrence),
        });
      }
    }

    setActionId(null);
    load();
    showToast("Cobrança marcada como paga.");
  }

  async function sendPixWhatsApp(charge: Charge) {
    if (!charge.client_phone) { showToast("Sem número de WhatsApp."); return; }
    if (!charge.pix_payload) { showToast("Sem código Pix gerado."); return; }
    setActionId(charge.id + "-wa");

    const message = msgPix(
      charge.client_name || "Cliente",
      charge.description || "Serviço",
      formatBRL(charge.amount_cents),
      charge.pix_payload
    );

    const phone = charge.client_phone.replace(/\D/g, "");
    const url = `https://wa.me/${phone.startsWith("55") ? phone : "55" + phone}?text=${encodeURIComponent(message)}`;

    // Se tem provedor configurado, usa API automática; senão, abre wa.me
    if (profile?.whatsapp_provider && profile.whatsapp_provider !== "mock") {
      try {
        const res = await fetch("/api/whatsapp-charge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ charge_id: charge.id }),
        });
        if (res.ok) {
          await supabase.from("charges").update({ reminders_sent: charge.reminders_sent + 1 }).eq("id", charge.id);
          showToast("Pix enviado pelo WhatsApp!");
          setActionId(null);
          load();
          return;
        }
      } catch { /* fallback para wa.me */ }
    }

    window.open(url, "_blank");
    await supabase.from("charges").update({ reminders_sent: charge.reminders_sent + 1 }).eq("id", charge.id);
    setActionId(null);
    load();
  }

  async function excluirCobranca(id: string) {
    setActionId(id + "-del");
    await supabase.from("charges").delete().eq("id", id);
    setActionId(null);
    setConfirmDelete(null);
    load();
    showToast("Cobrança excluída.");
  }

  async function sendLembrete(charge: Charge) {
    if (!charge.client_phone || !charge.pix_payload) { showToast("Sem número ou Pix gerado."); return; }
    setActionId(charge.id + "-lembrete");

    const message = msgLembrete(
      charge.client_name || "Cliente",
      charge.description || "Serviço",
      formatBRL(charge.amount_cents),
      charge.pix_payload
    );

    const phone = charge.client_phone.replace(/\D/g, "");
    const url = `https://wa.me/${phone.startsWith("55") ? phone : "55" + phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    await supabase.from("charges").update({ reminders_sent: charge.reminders_sent + 1 }).eq("id", charge.id);
    setActionId(null);
    load();
  }

  async function criarCobranca() {
    if (!fClientName || !fAmount) return;
    if (!profile?.pix_key) { showToast("Cadastre sua chave Pix nas Configurações."); return; }
    setFSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const amount_cents = parseToCents(fAmount);
    let pix_payload: string | null = null;
    try {
      pix_payload = generatePixBRCode({
        pixKey: normalizePixKey(profile.pix_key, (profile.pix_key_type as PixKeyType) || "celular"),
        amount: amount_cents / 100,
        merchantName: profile.pix_merchant_name || "PROFISSIONAL",
        merchantCity: profile.pix_merchant_city || "BR",
        txid: ("MAN" + Date.now()).slice(0, 25),
      });
    } catch { /* continua sem payload */ }

    await supabase.from("charges").insert({
      profile_id: user.id,
      client_name: fClientName,
      client_phone: fClientPhone,
      description: fDescription || "Serviço",
      amount_cents,
      pix_payload,
      due_date: fDueDate,
      recurrence: fRecurrence,
      next_due_date: fRecurrence !== "none" ? nextDate(fDueDate, fRecurrence) : null,
      auto_reminder: fAutoReminder,
      scheduled_reminder_at: fAutoReminder && fScheduledAt ? new Date(fScheduledAt).toISOString() : null,
    });

    setFClientName(""); setFClientPhone(""); setFDescription(""); setFAmount("");
    setFDueDate(new Date().toISOString().slice(0, 10)); setFRecurrence("none");
    setFAutoReminder(false); setFScheduledAt("");
    setFSaving(false);
    setShowModal(false);
    load();
    showToast("Cobrança criada!");
  }

  const formatDate = (d: string | null) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const filtered = filterStatus === "todos" ? charges : charges.filter((c) => c.status === filterStatus);

  return (
    <div className="space-y-5 pb-4">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Cobranças</h1>
        <button className="btn-primary text-sm px-4 py-2" onClick={() => setShowModal(true)}>
          + Nova
        </button>
      </div>

      {/* Alerta de recorrentes vencidas */}
      {dueToday.length > 0 && (
        <div className="card bg-amber-50 border-amber-200 py-3 px-4">
          <p className="text-sm font-semibold text-amber-700">
            🔁 {dueToday.length} cobrança{dueToday.length > 1 ? "s" : ""} recorrente{dueToday.length > 1 ? "s" : ""} vence{dueToday.length > 1 ? "m" : ""} hoje
          </p>
          <p className="text-xs text-amber-600 mt-0.5">Envie o Pix pelo WhatsApp para seus clientes.</p>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(["todos", "pendente", "atrasado", "pago"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
              filterStatus === s ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s === "todos" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="card text-center text-slate-500 text-sm py-10">
          <p className="text-3xl mb-3">💰</p>
          <p>Nenhuma cobrança {filterStatus !== "todos" ? `com status "${filterStatus}"` : "registrada"}.</p>
          <p className="mt-1 text-xs">Conclua um atendimento na Agenda ou crie uma cobrança manual.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="card py-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{c.client_name || "—"}</p>
                  <p className="text-sm text-slate-500">{c.description || "Serviço"}</p>
                  {c.due_date && (
                    <p className="text-xs text-slate-400">
                      Vencimento: {formatDate(c.due_date)}
                      {c.recurrence !== "none" && ` · ${RECURRENCE_LABELS[c.recurrence]}`}
                    </p>
                  )}
                  {c.reminders_sent > 0 && (
                    <p className="text-xs text-slate-400">{c.reminders_sent} lembrete{c.reminders_sent > 1 ? "s" : ""} enviado{c.reminders_sent > 1 ? "s" : ""}</p>
                  )}
                  {c.auto_reminder && c.scheduled_reminder_at && !c.last_auto_reminder_at && (
                    <p className="text-xs text-amber-600 font-medium mt-0.5">
                      ⏰ Lembrete automático em {new Date(c.scheduled_reminder_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                  {c.auto_reminder && c.last_auto_reminder_at && (
                    <p className="text-xs text-brand mt-0.5">✅ Lembrete automático enviado</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-lg font-bold text-slate-900">{formatBRL(c.amount_cents)}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[c.status]}`}>
                    {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Pix expandido */}
              {openPix === c.id && c.pix_payload && (
                <div className="pt-2 border-t border-slate-100">
                  <PixDisplay payload={c.pix_payload} amountLabel={formatBRL(c.amount_cents)} />
                </div>
              )}

              {/* Ações */}
              <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                {c.pix_payload && (
                  <button
                    className="btn text-xs px-3 py-1.5 border border-slate-200 hover:bg-slate-50"
                    onClick={() => setOpenPix(openPix === c.id ? null : c.id)}
                  >
                    {openPix === c.id ? "Fechar Pix" : "Ver QR / Pix"}
                  </button>
                )}
                {c.status !== "pago" && (
                  <>
                    {c.pix_payload && (
                      <button
                        className="btn-primary text-xs px-3 py-1.5"
                        onClick={() => sendPixWhatsApp(c)}
                        disabled={actionId === c.id + "-wa"}
                      >
                        {actionId === c.id + "-wa" ? "..." : "📲 Enviar Pix (WA)"}
                      </button>
                    )}
                    {c.pix_payload && (
                      <button
                        className="btn text-xs px-3 py-1.5 border border-slate-200 hover:bg-slate-50"
                        onClick={() => sendLembrete(c)}
                        disabled={actionId === c.id + "-lembrete"}
                      >
                        🔔 Lembrete
                      </button>
                    )}
                    <button
                      className="btn text-xs px-3 py-1.5 border border-brand text-brand hover:bg-brand-light"
                      onClick={() => marcarPago(c)}
                      disabled={actionId === c.id + "-pago"}
                    >
                      {actionId === c.id + "-pago" ? "..." : "✓ Recebi o pagamento"}
                    </button>
                  </>
                )}
                {c.status === "pago" && c.paid_at && (
                  <p className="text-xs text-slate-400">Pago em {formatDate(c.paid_at.slice(0, 10))}</p>
                )}
                <button
                  className="btn text-xs px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 ml-auto"
                  onClick={() => setConfirmDelete(c.id)}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal confirmar exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 text-center">
            <p className="text-2xl">🗑️</p>
            <h3 className="font-bold text-slate-900">Excluir cobrança?</h3>
            <p className="text-sm text-slate-500">Essa ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button className="flex-1 btn border border-slate-200" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button
                className="flex-1 btn bg-red-500 text-white hover:bg-red-600"
                disabled={actionId === confirmDelete + "-del"}
                onClick={() => excluirCobranca(confirmDelete)}
              >
                {actionId === confirmDelete + "-del" ? "..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nova cobrança */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-lg">Nova cobrança</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Nome do cliente</label>
                  <button
                    type="button"
                    className="text-xs text-brand underline"
                    onClick={async () => {
                      if (!("contacts" in navigator)) {
                        alert("Seu navegador não suporta busca de contatos. No iOS, use os campos normalmente — o teclado sugere contatos automaticamente.");
                        return;
                      }
                      try {
                        // @ts-expect-error Contact Picker API
                        const contacts = await navigator.contacts.select(["name", "tel"], { multiple: false });
                        if (contacts.length > 0) {
                          setFClientName(contacts[0].name?.[0] || "");
                          setFClientPhone(contacts[0].tel?.[0] || "");
                        }
                      } catch {
                        /* usuário cancelou */
                      }
                    }}
                  >
                    📞 Buscar contato
                  </button>
                </div>
                <input className="input" value={fClientName} onChange={(e) => setFClientName(e.target.value)} placeholder="João Silva" autoComplete="name" />
              </div>
              <div className="col-span-2">
                <label className="label">WhatsApp do cliente</label>
                <input className="input" value={fClientPhone} onChange={(e) => setFClientPhone(e.target.value)} placeholder="(11) 99999-8888" inputMode="tel" autoComplete="tel" />
              </div>
              <div className="col-span-2">
                <label className="label">Descrição</label>
                <input className="input" value={fDescription} onChange={(e) => setFDescription(e.target.value)} placeholder="Corte + escova" />
              </div>
              <div>
                <label className="label">Valor (R$)</label>
                <input className="input" value={fAmount} onChange={(e) => setFAmount(e.target.value)} placeholder="80,00" inputMode="decimal" />
              </div>
              <div>
                <label className="label">Vencimento</label>
                <input className="input" type="date" value={fDueDate} onChange={(e) => setFDueDate(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">Recorrência</label>
                <select className="input" value={fRecurrence} onChange={(e) => setFRecurrence(e.target.value)}>
                  {Object.entries(RECURRENCE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Lembrete automático */}
              <div className="col-span-2 border-t border-slate-100 pt-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fAutoReminder}
                    onChange={(e) => setFAutoReminder(e.target.checked)}
                    className="w-4 h-4 accent-brand"
                  />
                  <span className="text-sm font-medium text-slate-700">🔔 Agendar lembrete automático</span>
                </label>
                {fAutoReminder && (
                  <div className="mt-3">
                    <label className="label">Data e hora do envio automático</label>
                    <input
                      className="input"
                      type="datetime-local"
                      value={fScheduledAt}
                      onChange={(e) => setFScheduledAt(e.target.value)}
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      O sistema enviará o lembrete via WhatsApp automaticamente nesse horário.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <button className="btn-primary w-full" onClick={criarCobranca} disabled={fSaving || !fClientName || !fAmount}>
              {fSaving ? "Criando..." : "Criar cobrança"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
