"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatBRL, parseToCents, getTodayBR } from "@/lib/format";
import { generatePixBRCode, normalizePixKey, type PixKeyType } from "@/lib/pix";
import { PixDisplay } from "@/components/PixDisplay";
import { msgLembrete } from "@/lib/whatsapp";

// -- ALTER TABLE public.charges ADD COLUMN IF NOT EXISTS send_history text[];

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
  send_history: string[] | null;
};

type Profile = {
  id: string;
  pix_key: string | null;
  pix_key_type: string | null;
  pix_merchant_name: string | null;
  pix_merchant_city: string | null;
  payment_link: string | null;
  msg_lembrete: string | null;
  msg_pix: string | null;
};

type ClientOption = {
  id: string;
  name: string;
  phone: string | null;
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

const WEEKDAY_NAMES = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function getRecurrenceInfo(dueDate: string, recurrence: string): { label: string; nextDates: string[] } | null {
  if (recurrence === "none" || !dueDate) return null;
  const base = new Date(dueDate + "T00:00:00");
  const day = base.getDate();
  const weekdayName = WEEKDAY_NAMES[base.getDay()];
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

  const nextDates: string[] = [];
  let cur = new Date(base);
  for (let i = 0; i < 4; i++) {
    if (recurrence === "monthly") cur.setMonth(cur.getMonth() + 1);
    else if (recurrence === "weekly") cur.setDate(cur.getDate() + 7);
    else if (recurrence === "biweekly") cur.setDate(cur.getDate() + 14);
    nextDates.push(fmt(new Date(cur)));
  }

  const label =
    recurrence === "monthly"
      ? `Todo mês no dia ${day}`
      : recurrence === "weekly"
      ? `Toda ${weekdayName}`
      : `A cada 14 dias`;

  return { label, nextDates };
}

function nextDate(from: string, rec: string): string {
  const d = new Date(from + "T00:00:00");
  if (rec === "weekly") d.setDate(d.getDate() + 7);
  else if (rec === "biweekly") d.setDate(d.getDate() + 14);
  else if (rec === "monthly") d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function formatSendDate(isoStr: string): string {
  const d = new Date(isoStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month} às ${hour}:${min}`;
}

export default function CobrancasPage() {
  const supabase = createClient();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"todos" | "pendente" | "pago" | "atrasado">("todos");
  const [showModal, setShowModal] = useState(false);
  const [openPix, setOpenPix] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  // Modais de ação
  const [reminderModal, setReminderModal] = useState<Charge | null>(null);
  const [reminderText, setReminderText] = useState("");
  const [reminderSendMode, setReminderSendMode] = useState<"now" | "schedule">("now");
  const [reminderScheduledAt, setReminderScheduledAt] = useState("");
  const [pixModal, setPixModal] = useState<Charge | null>(null);
  const [pixOptKey, setPixOptKey] = useState(true);
  const [pixOptLink, setPixOptLink] = useState(false);
  const [flashSent, setFlashSent] = useState<string | null>(null);

  // Form nova cobrança
  const [fClientName, setFClientName] = useState("");
  const [fClientPhone, setFClientPhone] = useState("");
  const [fDescription, setFDescription] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fDueDate, setFDueDate] = useState(getTodayBR);
  const [fRecurrence, setFRecurrence] = useState("none");
  const [fAutoReminder, setFAutoReminder] = useState(false);
  const [fScheduledAt, setFScheduledAt] = useState("");
  const [fSaving, setFSaving] = useState(false);
  const [fError, setFError] = useState("");

  // Form editar cobrança
  const [editModal, setEditModal] = useState<Charge | null>(null);
  const [eClientName, setEClientName] = useState("");
  const [eClientPhone, setEClientPhone] = useState("");
  const [eDescription, setEDescription] = useState("");
  const [eAmount, setEAmount] = useState("");
  const [eDueDate, setEDueDate] = useState("");
  const [eSaving, setESaving] = useState(false);
  const [eError, setEError] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: p }, { data: cls }] = await Promise.all([
      supabase.from("profiles").select("id, pix_key, pix_key_type, pix_merchant_name, pix_merchant_city, payment_link, msg_lembrete, msg_pix").eq("id", user.id).single(),
      supabase.from("clients").select("id, name, phone").eq("profile_id", user.id).eq("status", "ativo").order("name"),
    ]);
    setProfile(p);
    setClientOptions((cls as ClientOption[]) || []);

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

  const today = getTodayBR();
  const dueToday = charges.filter(
    (c) => c.recurrence !== "none" && c.status === "pendente" && c.next_due_date && c.next_due_date <= today
  );

  const formatDate = (d: string | null) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  // ─── Pix modal ────────────────────────────────────────────────────────────
  function buildPixMessage(charge: Charge): string {
    const lines: string[] = [
      `Olá, ${charge.client_name || "Cliente"}! 💳`,
      ``,
      `Pagamento referente a: *${charge.description || "Serviço"}*`,
      `💰 Valor: *${formatBRL(charge.amount_cents)}*`,
    ];
    if (charge.due_date) lines.push(`📅 Vencimento: ${formatDate(charge.due_date)}`);
    if (pixOptKey && profile?.pix_key) {
      lines.push(``, `🔑 Chave Pix:`, profile.pix_key);
    }
    if (pixOptLink && profile?.payment_link) {
      lines.push(``, `🔗 Link de pagamento:`, profile.payment_link);
    }
    lines.push(``, `Obrigado! 🙏`);
    return lines.join("\n");
  }

  function openPixModal(charge: Charge) {
    setPixModal(charge);
    setPixOptKey(!!profile?.pix_key);
    setPixOptLink(!!profile?.payment_link);
  }

  function isOverdue(charge: Charge): boolean {
    return charge.status === "atrasado" || (charge.status === "pendente" && !!charge.due_date && charge.due_date < today);
  }

  function buildRecoveryMessage(charge: Charge): string {
    const lines = [
      `Olá, ${charge.client_name || "Cliente"}! 😊`,
      ``,
      `Passando para lembrar que temos uma cobrança em aberto no seu nome:`,
      ``,
      `📋 ${charge.description || "Serviço"}`,
      `💰 Valor: *${formatBRL(charge.amount_cents)}*`,
      charge.due_date ? `📅 Vencimento: *${formatDate(charge.due_date)}*` : null,
      profile?.pix_key ? `\n🔑 Chave Pix para pagamento:\n${profile.pix_key}` : null,
      ``,
      `Caso já tenha efetuado o pagamento, desconsidere esta mensagem. 🙏`,
      ``,
      `Qualquer dúvida estou à disposição!`,
    ].filter((l) => l !== null) as string[];
    return lines.join("\n");
  }

  function openReminderModal(charge: Charge, forceRecovery = false) {
    const overdue = forceRecovery || isOverdue(charge);
    const text = overdue
      ? buildRecoveryMessage(charge)
      : msgLembrete(
          charge.client_name || "Cliente",
          charge.description || "Serviço",
          formatBRL(charge.amount_cents),
          profile?.pix_key || "",
          profile?.msg_lembrete || null,
          formatDate(charge.due_date)
        );
    setReminderModal(charge);
    setReminderText(text);
    setReminderSendMode("now");
    setReminderScheduledAt("");
  }

  async function scheduleReminder(charge: Charge) {
    if (!reminderScheduledAt) return;
    setActionId(charge.id + "-lembrete");
    try {
      const { error } = await supabase
        .from("charges")
        .update({
          auto_reminder: true,
          scheduled_reminder_at: new Date(reminderScheduledAt + "T00:00:00").toISOString(),
          last_auto_reminder_at: null,
        })
        .eq("id", charge.id);
      if (!error) {
        setCharges((prev) =>
          prev.map((c) =>
            c.id === charge.id
              ? { ...c, auto_reminder: true, scheduled_reminder_at: reminderScheduledAt }
              : c
          )
        );
        showToast("⏰ Lembrete agendado!");
        setReminderModal(null);
      } else {
        showToast("Erro ao agendar lembrete.");
      }
    } finally {
      setActionId(null);
    }
  }

  async function doSend(charge: Charge, message: string, type: "pix" | "lembrete") {
    setActionId(charge.id + (type === "pix" ? "-wa" : "-lembrete"));
    try {
      const res = await fetch("/api/whatsapp-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ charge_id: charge.id, type, message }),
      });
      if (res.ok) {
        const nowIso = new Date().toISOString();
        // Atualiza send_history e reminders_sent
        await supabase
          .from("charges")
          .update({
            reminders_sent: charge.reminders_sent + 1,
            send_history: [...(charge.send_history || []), nowIso],
          })
          .eq("id", charge.id);

        setCharges((prev) =>
          prev.map((c) =>
            c.id === charge.id
              ? {
                  ...c,
                  reminders_sent: c.reminders_sent + 1,
                  send_history: [...(c.send_history || []), nowIso],
                }
              : c
          )
        );
        setFlashSent(charge.id);
        setTimeout(() => setFlashSent(null), 5000);
        showToast(type === "pix" ? "✅ Cobrança enviada pelo WhatsApp!" : "✅ Lembrete enviado!");
        setPixModal(null);
        setReminderModal(null);
      } else {
        const body = await res.json().catch(() => ({}));
        showToast(`Erro: ${body.error || "Falha ao enviar"}`);
      }
    } catch {
      showToast("Erro de conexão.");
    } finally {
      setActionId(null);
    }
  }

  // ─── Duplicar cobrança ────────────────────────────────────────────────────
  async function duplicarCobranca(charge: Charge) {
    setActionId(charge.id + "-dup");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast("Sessão expirada.");
        return;
      }

      let pix_payload: string | null = null;
      if (profile?.pix_key) {
        try {
          pix_payload = generatePixBRCode({
            pixKey: normalizePixKey(profile.pix_key, (profile.pix_key_type as PixKeyType) || "celular"),
            amount: charge.amount_cents / 100,
            merchantName: profile.pix_merchant_name || "PROFISSIONAL",
            merchantCity: profile.pix_merchant_city || "BR",
            txid: ("DUP" + Date.now()).slice(0, 25),
          });
        } catch { /* segue sem QR */ }
      }

      const { error } = await supabase.from("charges").insert({
        profile_id: user.id,
        client_name: charge.client_name,
        client_phone: charge.client_phone,
        description: charge.description,
        amount_cents: charge.amount_cents,
        pix_payload,
        due_date: today,
        status: "pendente",
        recurrence: "none",
        auto_reminder: false,
        next_due_date: null,
        scheduled_reminder_at: null,
        last_auto_reminder_at: null,
        send_history: null,
      });

      if (!error) {
        showToast("📋 Cobrança duplicada!");
        load();
      } else {
        showToast("Erro ao duplicar: " + error.message);
      }
    } finally {
      setActionId(null);
    }
  }

  // ─── Pago ────────────────────────────────────────────────────────────────
  async function marcarPago(charge: Charge) {
    setActionId(charge.id + "-pago");
    await supabase.from("charges").update({ status: "pago", paid_at: new Date().toISOString() }).eq("id", charge.id);

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

        // Propaga lembrete automático: recalcula a data do lembrete com base nos dias de antecedência originais
        let new_scheduled_reminder_at: string | null = null;
        if (charge.auto_reminder && charge.scheduled_reminder_at && charge.due_date) {
          const origDue = new Date(charge.due_date + "T00:00:00").getTime();
          const origReminder = new Date(charge.scheduled_reminder_at).getTime();
          const advanceMs = origDue - origReminder;
          if (advanceMs > 0) {
            const newDueMs = new Date(nextDue + "T00:00:00").getTime();
            new_scheduled_reminder_at = new Date(newDueMs - advanceMs).toISOString();
          }
        }

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
          auto_reminder: charge.auto_reminder,
          scheduled_reminder_at: new_scheduled_reminder_at,
          last_auto_reminder_at: null,
        });
      }
    }

    setActionId(null);
    load();
    showToast("✅ Cobrança marcada como paga!");
  }

  function openEditModal(charge: Charge) {
    setEClientName(charge.client_name || "");
    setEClientPhone(charge.client_phone || "");
    setEDescription(charge.description || "");
    setEAmount((charge.amount_cents / 100).toFixed(2).replace(".", ","));
    setEDueDate(charge.due_date || "");
    setEError("");
    setEditModal(charge);
  }

  async function salvarEdicao() {
    if (!editModal) return;
    setEError("");
    if (!eClientName.trim()) { setEError("Informe o nome do cliente."); return; }
    const amount_cents = parseToCents(eAmount);
    if (amount_cents <= 0) { setEError("Informe um valor maior que R$ 0,00."); return; }

    setESaving(true);
    try {
      // Regenera Pix payload se o valor mudou
      let pix_payload = editModal.pix_payload;
      if (amount_cents !== editModal.amount_cents && profile?.pix_key) {
        try {
          pix_payload = generatePixBRCode({
            pixKey: normalizePixKey(profile.pix_key, (profile.pix_key_type as PixKeyType) || "celular"),
            amount: amount_cents / 100,
            merchantName: profile.pix_merchant_name || "PROFISSIONAL",
            merchantCity: profile.pix_merchant_city || "BR",
            txid: ("EDT" + Date.now()).slice(0, 25),
          });
        } catch { /* mantém o anterior */ }
      }

      const { error } = await supabase
        .from("charges")
        .update({
          client_name: eClientName.trim(),
          client_phone: eClientPhone.trim() || null,
          description: eDescription.trim() || "Serviço",
          amount_cents,
          pix_payload,
          due_date: eDueDate || null,
        })
        .eq("id", editModal.id);

      if (error) {
        setEError("Erro ao salvar: " + error.message);
      } else {
        setEditModal(null);
        load();
        showToast("✅ Cobrança atualizada!");
      }
    } finally {
      setESaving(false);
    }
  }

  async function excluirCobranca(id: string) {
    setActionId(id + "-del");
    await supabase.from("charges").delete().eq("id", id);
    setActionId(null);
    setConfirmDelete(null);
    load();
    showToast("Cobrança excluída.");
  }

  async function criarCobranca() {
    setFError("");

    if (!fClientName.trim()) {
      setFError("Informe o nome do cliente.");
      return;
    }
    if (!fAmount.trim()) {
      setFError("Informe o valor da cobrança.");
      return;
    }

    setFSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFError("Sessão expirada. Recarregue a página e faça login novamente.");
        return;
      }

      const amount_cents = parseToCents(fAmount);
      if (amount_cents <= 0) {
        setFError("Informe um valor maior que R$ 0,00.");
        return;
      }

      let pix_payload: string | null = null;
      if (profile?.pix_key) {
        try {
          pix_payload = generatePixBRCode({
            pixKey: normalizePixKey(profile.pix_key, (profile.pix_key_type as PixKeyType) || "celular"),
            amount: amount_cents / 100,
            merchantName: profile.pix_merchant_name || "PROFISSIONAL",
            merchantCity: profile.pix_merchant_city || "BR",
            txid: ("MAN" + Date.now()).slice(0, 25),
          });
        } catch { /* segue sem QR */ }
      }

      const { error: insertError } = await supabase.from("charges").insert({
        profile_id: user.id,
        client_name: fClientName.trim(),
        client_phone: fClientPhone.trim(),
        description: fDescription.trim() || "Serviço",
        amount_cents,
        pix_payload,
        due_date: fDueDate,
        recurrence: fRecurrence,
        next_due_date: fRecurrence !== "none" ? nextDate(fDueDate, fRecurrence) : null,
        auto_reminder: fAutoReminder,
        scheduled_reminder_at: fAutoReminder && fScheduledAt ? new Date(fScheduledAt).toISOString() : null,
      });

      if (insertError) {
        console.error("[criarCobranca] insert error:", insertError);
        setFError("Erro ao salvar: " + insertError.message);
        return;
      }

      setFClientName(""); setFClientPhone(""); setFDescription(""); setFAmount("");
      setFDueDate(getTodayBR()); setFRecurrence("none");
      setFAutoReminder(false); setFScheduledAt(""); setFError("");
      setShowModal(false);
      load();
      showToast("✅ Cobrança criada!");
    } catch (err) {
      console.error("[criarCobranca] unexpected error:", err);
      setFError("Erro inesperado: " + String(err));
    } finally {
      setFSaving(false);
    }
  }

  const filtered = filterStatus === "todos" ? charges : charges.filter((c) => c.status === filterStatus);

  const clientSuggestions = fClientName.trim().length > 0
    ? clientOptions.filter((c) =>
        c.name.toLowerCase().includes(fClientName.toLowerCase()) ||
        (c.phone || "").includes(fClientName)
      ).slice(0, 6)
    : [];

  return (
    <div className="space-y-5 pb-4">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Cobranças</h1>
        <button className="btn-primary text-sm px-4 py-2" onClick={() => setShowModal(true)}>
          + Nova
        </button>
      </div>

      {dueToday.length > 0 && (
        <div className="card bg-amber-50 border-amber-200 py-3 px-4">
          <p className="text-sm font-semibold text-amber-700">
            🔁 {dueToday.length} cobrança{dueToday.length > 1 ? "s" : ""} recorrente{dueToday.length > 1 ? "s" : ""} vence{dueToday.length > 1 ? "m" : ""} hoje
          </p>
          <p className="text-xs text-amber-600 mt-0.5">Envie a cobrança pelo WhatsApp para seus clientes.</p>
        </div>
      )}

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
            <div
              key={c.id}
              className={`card py-4 space-y-3 transition-all duration-300 ${
                flashSent === c.id ? "ring-2 ring-green-400" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900">{c.client_name || "—"}</p>
                  <p className="text-sm text-slate-500">{c.description || "Serviço"}</p>
                  {c.due_date && (
                    <p className="text-xs text-slate-400">
                      Vencimento: {formatDate(c.due_date)}
                      {c.recurrence !== "none" && ` · ${RECURRENCE_LABELS[c.recurrence]}`}
                    </p>
                  )}

                  {/* Badge de envio */}
                  {flashSent === c.id ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping inline-block" />
                      Enviado agora!
                    </span>
                  ) : c.reminders_sent > 0 ? (
                    <div className="mt-1 space-y-1">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                        onClick={() => setExpandedHistory(expandedHistory === c.id ? null : c.id)}
                      >
                        ✓ {c.reminders_sent} envio{c.reminders_sent > 1 ? "s" : ""} realizado{c.reminders_sent > 1 ? "s" : ""}
                        <span className="text-slate-400">{expandedHistory === c.id ? "▲" : "▼"}</span>
                      </button>

                      {/* Último envio automático */}
                      {c.last_auto_reminder_at && (
                        <p className="text-xs text-slate-400">
                          Último envio automático: {formatSendDate(c.last_auto_reminder_at)}
                        </p>
                      )}

                      {/* Histórico expandido */}
                      {expandedHistory === c.id && (
                        <div className="mt-1.5 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 space-y-1">
                          <p className="text-xs font-semibold text-slate-500 mb-1">Histórico de envios</p>
                          {c.send_history && c.send_history.length > 0 ? (
                            [...c.send_history].reverse().slice(0, 3).map((ts, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                                {formatSendDate(ts)}
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400">Nenhum envio registrado ainda.</p>
                          )}
                          {c.send_history && c.send_history.length > 3 && (
                            <p className="text-xs text-slate-400 pt-0.5">
                              + {c.send_history.length - 3} envio{c.send_history.length - 3 > 1 ? "s" : ""} anterior{c.send_history.length - 3 > 1 ? "es" : ""}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {c.auto_reminder && c.scheduled_reminder_at && !c.last_auto_reminder_at && (
                    <p className="text-xs text-amber-600 font-medium mt-0.5">
                      ⏰ Lembrete automático em {new Date(c.scheduled_reminder_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                  {c.auto_reminder && c.last_auto_reminder_at && (
                    <p className="text-xs text-brand mt-0.5">✅ Lembrete automático enviado</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-lg font-bold text-slate-900">{formatBRL(c.amount_cents)}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[c.status]}`}>
                    {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                  </span>
                </div>
              </div>

              {openPix === c.id && c.pix_payload && (
                <div className="pt-2 border-t border-slate-100">
                  <PixDisplay payload={c.pix_payload} amountLabel={formatBRL(c.amount_cents)} />
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                {c.pix_payload && (
                  <button
                    className="btn text-xs px-3 py-1.5 border border-slate-200 hover:bg-slate-50"
                    onClick={() => setOpenPix(openPix === c.id ? null : c.id)}
                  >
                    {openPix === c.id ? "Fechar QR" : "Ver QR / Pix"}
                  </button>
                )}
                {c.status !== "pago" && (
                  <>
                    {isOverdue(c) ? (
                      /* ── Vencido: botão de recuperação em destaque ── */
                      <button
                        className="btn text-xs px-3 py-1.5 bg-red-500 text-white hover:bg-red-600 font-semibold"
                        onClick={() => openReminderModal(c, true)}
                        disabled={actionId === c.id + "-lembrete"}
                      >
                        {actionId === c.id + "-lembrete" ? "Enviando..." : "💸 Cobrar vencido"}
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn-primary text-xs px-3 py-1.5"
                          onClick={() => openPixModal(c)}
                          disabled={actionId === c.id + "-wa"}
                        >
                          {actionId === c.id + "-wa" ? "Enviando..." : "📲 Enviar cobrança"}
                        </button>
                        <button
                          className="btn text-xs px-3 py-1.5 border border-slate-200 hover:bg-slate-50"
                          onClick={() => openReminderModal(c)}
                          disabled={actionId === c.id + "-lembrete"}
                        >
                          {actionId === c.id + "-lembrete" ? "Enviando..." : "🔔 Lembrete"}
                        </button>
                      </>
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
                {/* Botão Duplicar */}
                <button
                  className="btn text-xs px-3 py-1.5 border border-slate-200 hover:bg-slate-50"
                  onClick={() => duplicarCobranca(c)}
                  disabled={actionId === c.id + "-dup"}
                >
                  {actionId === c.id + "-dup" ? "..." : "📋 Duplicar"}
                </button>
                <button
                  className="btn text-xs px-3 py-1.5 border border-slate-200 hover:bg-slate-50"
                  onClick={() => openEditModal(c)}
                >
                  ✏️ Editar
                </button>
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

      {/* ── Modal: editar cobrança ─────────────────────────────────── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">✏️ Editar cobrança</h3>
              <button onClick={() => setEditModal(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nome do cliente</label>
                  <input className="input" value={eClientName} onChange={(e) => setEClientName(e.target.value)} placeholder="Ana Souza" />
                </div>
                <div>
                  <label className="label">WhatsApp</label>
                  <input className="input" type="tel" value={eClientPhone} onChange={(e) => setEClientPhone(e.target.value)} placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div>
                <label className="label">Descrição</label>
                <input className="input" value={eDescription} onChange={(e) => setEDescription(e.target.value)} placeholder="Serviço realizado" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Valor (R$)</label>
                  <input className="input" value={eAmount} onChange={(e) => setEAmount(e.target.value)} placeholder="0,00" inputMode="decimal" />
                </div>
                <div>
                  <label className="label">Vencimento</label>
                  <input className="input" type="date" value={eDueDate} onChange={(e) => setEDueDate(e.target.value)} />
                </div>
              </div>
            </div>
            {eError && <p className="text-sm text-red-500">{eError}</p>}
            <div className="flex gap-3 pt-1">
              <button className="flex-1 btn border border-slate-200" onClick={() => setEditModal(null)}>Cancelar</button>
              <button className="flex-1 btn-primary" onClick={salvarEdicao} disabled={eSaving}>
                {eSaving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: excluir ─────────────────────────────────────────── */}
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

      {/* ── Modal: lembrete ────────────────────────────────────────── */}
      {reminderModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                {isOverdue(reminderModal) ? "💸 Cobrar vencido" : "🔔 Enviar lembrete"}
              </h3>
              <button onClick={() => setReminderModal(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>
            {isOverdue(reminderModal) && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700 font-medium">
                ⚠️ Esta cobrança está vencida. A mensagem foi adaptada para recuperação do pagamento.
              </div>
            )}
            <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-0.5">
              <p className="font-medium text-slate-900">{reminderModal.client_name}</p>
              <p className="text-slate-500">{reminderModal.description} · <strong>{formatBRL(reminderModal.amount_cents)}</strong></p>
              {reminderModal.due_date && (
                <p className={`text-xs ${isOverdue(reminderModal) ? "text-red-500 font-medium" : "text-slate-400"}`}>
                  {isOverdue(reminderModal) ? "⚠️ Venceu em" : "Vence em"} {formatDate(reminderModal.due_date)}
                </p>
              )}
            </div>
            {/* Quando enviar */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReminderSendMode("now")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  reminderSendMode === "now"
                    ? "bg-brand text-white border-brand"
                    : "border-slate-200 text-slate-600 hover:border-brand"
                }`}
              >
                📲 Enviar agora
              </button>
              <button
                type="button"
                onClick={() => setReminderSendMode("schedule")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  reminderSendMode === "schedule"
                    ? "bg-brand text-white border-brand"
                    : "border-slate-200 text-slate-600 hover:border-brand"
                }`}
              >
                ⏰ Agendar envio
              </button>
            </div>

            {reminderSendMode === "schedule" && (
              <div>
                <label className="label text-sm">Data do envio</label>
                <input
                  type="date"
                  className="input"
                  value={reminderScheduledAt}
                  onChange={(e) => setReminderScheduledAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                />
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">
                  ⏰ Os lembretes são disparados automaticamente entre 09h e 18h do dia escolhido.
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0 text-sm">Mensagem</label>
                <button
                  type="button"
                  className="text-xs text-brand underline"
                  onClick={() =>
                    setReminderText(
                      isOverdue(reminderModal)
                        ? buildRecoveryMessage(reminderModal)
                        : msgLembrete(
                            reminderModal.client_name || "Cliente",
                            reminderModal.description || "Serviço",
                            formatBRL(reminderModal.amount_cents),
                            profile?.pix_key || "",
                            profile?.msg_lembrete || null,
                            formatDate(reminderModal.due_date)
                          )
                    )
                  }
                >
                  Restaurar padrão
                </button>
              </div>
              <textarea
                className="input resize-none text-sm font-mono leading-relaxed"
                rows={7}
                value={reminderText}
                onChange={(e) => setReminderText(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">O que você vê aqui é exatamente o que o cliente receberá.</p>
            </div>
            <div className="flex gap-3">
              <button className="flex-1 btn border border-slate-200" onClick={() => setReminderModal(null)}>Cancelar</button>
              {reminderSendMode === "now" ? (
                <button
                  className="flex-1 btn-primary"
                  disabled={!reminderText.trim() || actionId === reminderModal.id + "-lembrete"}
                  onClick={() => doSend(reminderModal, reminderText, "lembrete")}
                >
                  {actionId === reminderModal.id + "-lembrete" ? "Enviando..." : "📲 Enviar agora"}
                </button>
              ) : (
                <button
                  className="flex-1 btn-primary"
                  disabled={!reminderScheduledAt || actionId === reminderModal.id + "-lembrete"}
                  onClick={() => scheduleReminder(reminderModal)}
                >
                  {actionId === reminderModal.id + "-lembrete" ? "Salvando..." : "⏰ Agendar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: enviar cobrança ──────────────────────────────────── */}
      {pixModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">📲 Enviar cobrança</h3>
              <button onClick={() => setPixModal(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-0.5">
              <p className="font-medium text-slate-900">{pixModal.client_name}</p>
              <p className="text-slate-500">{pixModal.description} · <strong>{formatBRL(pixModal.amount_cents)}</strong></p>
              {pixModal.due_date && <p className="text-xs text-slate-400">Vence em {formatDate(pixModal.due_date)}</p>}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">O que incluir na mensagem?</p>

              <label className={`flex items-start gap-3 cursor-pointer rounded-xl border p-3 transition-colors ${pixOptKey ? "border-brand bg-brand-light/30" : "border-slate-200"} ${!profile?.pix_key ? "opacity-50 cursor-not-allowed" : ""}`}>
                <input
                  type="checkbox"
                  checked={pixOptKey}
                  onChange={(e) => setPixOptKey(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-brand"
                  disabled={!profile?.pix_key}
                />
                <span className="text-sm flex-1">
                  <span className="font-medium block">🔑 Chave Pix</span>
                  {profile?.pix_key
                    ? <span className="text-xs text-slate-500 font-mono mt-0.5 block break-all">{profile.pix_key}</span>
                    : <span className="text-xs text-red-400 mt-0.5 block">Não cadastrada — configure nas Configurações</span>
                  }
                </span>
              </label>

              <label className={`flex items-start gap-3 cursor-pointer rounded-xl border p-3 transition-colors ${pixOptLink ? "border-brand bg-brand-light/30" : "border-slate-200"} ${!profile?.payment_link ? "opacity-50 cursor-not-allowed" : ""}`}>
                <input
                  type="checkbox"
                  checked={pixOptLink}
                  onChange={(e) => setPixOptLink(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-brand"
                  disabled={!profile?.payment_link}
                />
                <span className="text-sm flex-1">
                  <span className="font-medium block">🔗 Link de pagamento</span>
                  {profile?.payment_link
                    ? <span className="text-xs text-slate-500 mt-0.5 block truncate">{profile.payment_link}</span>
                    : <span className="text-xs text-slate-400 mt-0.5 block">Configure nas Configurações</span>
                  }
                </span>
              </label>
            </div>

            {/* Prévia */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">Prévia:</p>
              <pre className="text-xs bg-green-50 border border-green-200 rounded-xl p-3 whitespace-pre-wrap font-sans leading-relaxed text-slate-700 max-h-44 overflow-y-auto">
                {buildPixMessage(pixModal)}
              </pre>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 btn border border-slate-200" onClick={() => setPixModal(null)}>Cancelar</button>
              <button
                className="flex-1 btn-primary"
                disabled={(!pixOptKey && !pixOptLink) || actionId === pixModal.id + "-wa"}
                onClick={() => doSend(pixModal, buildPixMessage(pixModal), "pix")}
              >
                {actionId === pixModal.id + "-wa" ? "Enviando..." : "📲 Enviar pelo WhatsApp"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: nova cobrança ──────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md flex flex-col max-h-[92vh]">
            {/* Header fixo */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-slate-900 text-lg">Nova cobrança</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            {/* Conteúdo rolável */}
            <div className="overflow-y-auto px-5 py-4 flex-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Nome do cliente</label>
                  <button
                    type="button"
                    className="text-xs text-brand underline"
                    onClick={async () => {
                      if (!("contacts" in navigator)) {
                        alert("Seu navegador não suporta busca de contatos. No iOS, use os campos normalmente.");
                        return;
                      }
                      try {
                        // @ts-expect-error Contact Picker API
                        const contacts = await navigator.contacts.select(["name", "tel"], { multiple: false });
                        if (contacts.length > 0) {
                          setFClientName(contacts[0].name?.[0] || "");
                          setFClientPhone(contacts[0].tel?.[0] || "");
                        }
                      } catch { /* cancelado */ }
                    }}
                  >
                    📞 Buscar contato
                  </button>
                </div>
                <input
                  className="input"
                  value={fClientName}
                  onChange={(e) => { setFClientName(e.target.value); setShowClientSuggestions(true); }}
                  onFocus={() => setShowClientSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowClientSuggestions(false), 150)}
                  placeholder="Digite o nome ou busque um cliente cadastrado"
                  autoComplete="off"
                />
                {showClientSuggestions && clientSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    {clientSuggestions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-3 border-b border-slate-100 last:border-0"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFClientName(c.name);
                          setFClientPhone(c.phone || "");
                          setShowClientSuggestions(false);
                        }}
                      >
                        <span className="text-sm font-medium text-slate-900">{c.name}</span>
                        {c.phone && <span className="text-xs text-slate-400 shrink-0">{c.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
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
                {(() => {
                  const info = getRecurrenceInfo(fDueDate, fRecurrence);
                  if (!info) return null;
                  return (
                    <div className="mt-2 bg-brand-light border border-brand/20 rounded-xl p-3 space-y-2">
                      <p className="text-sm font-medium text-brand-dark">🔁 {info.label}</p>
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 font-medium">Próximas cobranças:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {info.nextDates.map((d, i) => (
                            <span key={i} className="text-xs bg-white border border-brand/30 text-brand-dark px-2 py-0.5 rounded-full font-mono">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">A cobrança é gerada automaticamente após marcar cada pagamento como pago.</p>
                    </div>
                  );
                })()}
              </div>
              <div className="col-span-2 border-t border-slate-100 pt-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={fAutoReminder} onChange={(e) => setFAutoReminder(e.target.checked)} className="w-4 h-4 accent-brand" />
                  <span className="text-sm font-medium text-slate-700">🔔 Agendar lembrete automático</span>
                </label>
                {fAutoReminder && (
                  <div className="mt-3">
                    <label className="label">Data e hora do envio</label>
                    <input className="input" type="datetime-local" value={fScheduledAt} onChange={(e) => setFScheduledAt(e.target.value)} />
                    <p className="text-xs text-slate-400 mt-1">O sistema enviará o lembrete via WhatsApp automaticamente nesse horário.</p>
                  </div>
                )}
              </div>
            </div>{/* fim grid */}
            </div>{/* fim scroll */}
            {/* Rodapé fixo com botão */}
            <div className="px-5 pb-5 pt-3 border-t border-slate-100 shrink-0 space-y-3">
              {fError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700 font-medium">
                  ❌ {fError}
                </div>
              )}
              <button className="btn-primary w-full" onClick={criarCobranca} disabled={fSaving}>
                {fSaving ? "Criando..." : "Criar cobrança"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
