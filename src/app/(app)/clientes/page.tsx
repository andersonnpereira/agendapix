"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { ModalPortal } from "@/components/ModalPortal";

type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthdate: string | null;
  cpf: string | null;
  address: string | null;
  notes: string | null;
  source: string | null;
  status: string;
  tags: string[] | null;
  created_at: string;
};

type SortBy = "nome" | "recente" | "gasto";

// Normaliza telefone p/ detectar duplicados: só dígitos, sem DDI 55 e sem o
// 9º dígito do celular (mesma lógica usada no bot de WhatsApp).
function normalizePhone(raw: string | null | undefined): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) d = d.slice(0, 2) + d.slice(3);
  return d;
}

type ChargeItem = {
  id: string;
  description: string | null;
  amount_cents: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
};

const SOURCE_LABELS: Record<string, string> = {
  link: "Link",
  indicacao: "Indicação",
  presencial: "Presencial",
  instagram: "Instagram",
  outro: "Outro",
};

const STATUS_CHARGE: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-700",
  pago: "bg-brand-light text-brand-dark",
  atrasado: "bg-red-100 text-red-600",
};

function Avatar({ name }: { name: string }) {
  const words = name.trim().split(" ").filter(Boolean);
  const init =
    words.length >= 2
      ? words[0][0] + words[words.length - 1][0]
      : (words[0] || "?").slice(0, 2);
  return (
    <div className="w-11 h-11 rounded-full bg-brand-light text-brand-dark flex items-center justify-center font-bold text-sm flex-shrink-0 uppercase">
      {init}
    </div>
  );
}

export default function ClientesPage() {
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [spentByClient, setSpentByClient] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"todos" | "ativo" | "inativo">("todos");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("nome");
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [toast, setToast] = useState("");

  // Detail view
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [detailCharges, setDetailCharges] = useState<ChargeItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailStats, setDetailStats] = useState({ chargesPaid: 0, totalSpent: 0 });

  // Modal create/edit
  const [showModal, setShowModal] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [fName, setFName] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fBirthdate, setFBirthdate] = useState("");
  const [fCpf, setFCpf] = useState("");
  const [fAddress, setFAddress] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fSource, setFSource] = useState("link");
  const [fStatus, setFStatus] = useState("ativo");
  const [fTags, setFTags] = useState<string[]>([]);
  const [fTagInput, setFTagInput] = useState("");

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data }, { data: paid }] = await Promise.all([
      supabase.from("clients").select("*").eq("profile_id", user.id).order("name"),
      supabase.from("charges").select("client_id, amount_cents").eq("profile_id", user.id).eq("status", "pago").not("client_id", "is", null),
    ]);
    setClients((data as Client[]) || []);
    const spent: Record<string, number> = {};
    for (const c of paid || []) {
      const id = c.client_id as string;
      spent[id] = (spent[id] || 0) + (c.amount_cents || 0);
    }
    setSpentByClient(spent);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditClient(null);
    setFName(""); setFPhone(""); setFEmail(""); setFBirthdate("");
    setFCpf(""); setFAddress(""); setFNotes(""); setFSource("link"); setFStatus("ativo");
    setFTags([]); setFTagInput("");
    setShowModal(true);
  }

  function openEdit(c: Client) {
    setEditClient(c);
    setFName(c.name); setFPhone(c.phone || ""); setFEmail(c.email || "");
    setFBirthdate(c.birthdate || ""); setFCpf(c.cpf || ""); setFAddress(c.address || "");
    setFNotes(c.notes || ""); setFSource(c.source || "link"); setFStatus(c.status || "ativo");
    setFTags(c.tags || []); setFTagInput("");
    setShowModal(true);
  }

  function addTag() {
    const t = fTagInput.trim().toLowerCase();
    if (t && !fTags.includes(t)) setFTags([...fTags, t]);
    setFTagInput("");
  }

  async function openDetail(c: Client) {
    setDetailClient(c);
    setLoadingDetail(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: charges } = await supabase
      .from("charges")
      .select("id, description, amount_cents, status, due_date, paid_at")
      .eq("profile_id", user.id)
      .eq("client_id", c.id)
      .order("created_at", { ascending: false })
      .limit(30);

    const list = (charges as unknown as ChargeItem[]) || [];
    setDetailCharges(list);
    const paid = list.filter((c) => c.status === "pago");
    const totalSpent = paid.reduce((sum, c) => sum + c.amount_cents, 0);
    setDetailStats({ chargesPaid: paid.length, totalSpent });
    setLoadingDetail(false);
  }

  async function save() {
    if (!fName.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); showToast("Sessão expirada. Entre novamente."); return; }

    const payload = {
      name: fName.trim(),
      phone: fPhone || null,
      email: fEmail || null,
      birthdate: fBirthdate || null,
      cpf: fCpf || null,
      address: fAddress || null,
      notes: fNotes || null,
      source: fSource,
      status: fStatus,
      tags: fTags,
    };

    let dbErr = null;
    if (editClient) {
      const { error } = await supabase.from("clients").update(payload).eq("id", editClient.id);
      dbErr = error;
      if (!error && detailClient?.id === editClient.id) setDetailClient({ ...editClient, ...payload });
    } else {
      const { error } = await supabase.from("clients").insert({ ...payload, profile_id: user.id });
      dbErr = error;
    }

    setSaving(false);
    if (dbErr) { showToast("Erro ao salvar o cliente. Tente novamente."); return; }
    showToast(editClient ? "Cliente atualizado!" : "Cliente cadastrado!");
    setShowModal(false);
    load();
  }

  async function deleteClient(id: string) {
    setDeleting(true);
    const { error } = await supabase.from("clients").delete().eq("id", id);
    setDeleting(false);
    if (error) { showToast("Erro ao excluir o cliente. Tente novamente."); return; }
    setConfirmDelete(null);
    if (detailClient?.id === id) setDetailClient(null);
    load();
    showToast("Cliente excluído.");
  }

  // Todas as tags em uso (para os chips de filtro)
  const allTags = Array.from(new Set(clients.flatMap((c) => c.tags || []))).sort();

  // Telefones repetidos → candidatos a duplicado
  const phoneCount: Record<string, number> = {};
  for (const c of clients) {
    const p = normalizePhone(c.phone);
    if (p.length >= 10) phoneCount[p] = (phoneCount[p] || 0) + 1;
  }
  const dupCount = Object.values(phoneCount).filter((n) => n > 1).length;
  const isDuplicate = (c: Client) => {
    const p = normalizePhone(c.phone);
    return p.length >= 10 && phoneCount[p] > 1;
  };

  const filtered = clients
    .filter((c) => {
      const s = search.toLowerCase();
      const matchSearch = !s || c.name.toLowerCase().includes(s) || (c.phone || "").includes(s) || (c.email || "").toLowerCase().includes(s);
      const matchStatus = filterStatus === "todos" || c.status === filterStatus;
      const matchTag = !filterTag || (c.tags || []).includes(filterTag);
      const matchDup = !onlyDuplicates || isDuplicate(c);
      return matchStatus && matchSearch && matchTag && matchDup;
    })
    .sort((a, b) => {
      if (sortBy === "recente") return (b.created_at || "").localeCompare(a.created_at || "");
      if (sortBy === "gasto") return (spentByClient[b.id] || 0) - (spentByClient[a.id] || 0);
      return a.name.localeCompare(b.name, "pt-BR");
    });

  function exportCSV() {
    const header = ["Nome", "WhatsApp", "E-mail", "Nascimento", "CPF", "Endereço", "Origem", "Status", "Etiquetas", "Total gasto (R$)", "Observações"];
    const rows = filtered.map((c) => [
      c.name,
      c.phone || "",
      c.email || "",
      c.birthdate ? fmt(c.birthdate) : "",
      c.cpf || "",
      c.address || "",
      SOURCE_LABELS[c.source || ""] || c.source || "",
      c.status,
      (c.tags || []).join(", "),
      ((spentByClient[c.id] || 0) / 100).toFixed(2).replace(".", ","),
      (c.notes || "").replace(/\n/g, " "),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const fmt = (d: string | null) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const fmtBRL = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ─── MODAL create/edit ─────────────────────────────────────────────
  const modal = showModal && (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-lg">
            {editClient ? "Editar cliente" : "Novo cliente"}
          </h3>
          <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Nome completo *</label>
            <input className="input" value={fName} onChange={(e) => setFName(e.target.value)} placeholder="João da Silva" autoFocus />
          </div>
          <div className="col-span-2">
            <label className="label">WhatsApp</label>
            <input className="input" value={fPhone} onChange={(e) => setFPhone(e.target.value)} placeholder="(11) 99999-8888" inputMode="tel" />
            <p className="text-xs text-slate-400 mt-1">Internacional: use <span className="font-mono font-medium">+DDI número</span> (ex: <span className="font-mono">+1 212 5550100</span>)</p>
          </div>
          <div className="col-span-2">
            <label className="label">E-mail</label>
            <input className="input" type="email" value={fEmail} onChange={(e) => setFEmail(e.target.value)} placeholder="joao@email.com" />
          </div>
          <div>
            <label className="label">Data de nascimento</label>
            <input className="input" type="date" value={fBirthdate} onChange={(e) => setFBirthdate(e.target.value)} />
          </div>
          <div>
            <label className="label">CPF</label>
            <input className="input" value={fCpf} onChange={(e) => setFCpf(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" />
          </div>
          <div className="col-span-2">
            <label className="label">Endereço</label>
            <input className="input" value={fAddress} onChange={(e) => setFAddress(e.target.value)} placeholder="Rua, nº, bairro, cidade" />
          </div>
          <div className="col-span-2">
            <label className="label">Como nos encontrou</label>
            <select className="input" value={fSource} onChange={(e) => setFSource(e.target.value)}>
              {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Etiquetas</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {fTags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-xs font-medium bg-brand-light text-brand-dark px-2 py-1 rounded-full">
                  {t}
                  <button type="button" onClick={() => setFTags(fTags.filter((x) => x !== t))} className="text-brand-dark/60 hover:text-brand-dark">✕</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input text-sm flex-1"
                value={fTagInput}
                onChange={(e) => setFTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Ex: mensalista, trimestral, teste…"
              />
              <button type="button" className="btn border border-slate-200 text-sm px-3" onClick={addTag}>+ Add</button>
            </div>
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {allTags.filter((t) => !fTags.includes(t)).slice(0, 8).map((t) => (
                  <button key={t} type="button" onClick={() => setFTags([...fTags, t])} className="text-[11px] text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-full">+ {t}</button>
                ))}
              </div>
            )}
          </div>
          <div className="col-span-2">
            <label className="label">Observações internas</label>
            <textarea
              className="input resize-none text-sm"
              rows={3}
              value={fNotes}
              onChange={(e) => setFNotes(e.target.value)}
              placeholder="Preferências, alergias, informações importantes..."
            />
          </div>
          <div className="col-span-2">
            <label className="label">Status</label>
            <div className="flex gap-2">
              {(["ativo", "inativo"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFStatus(s)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    fStatus === s ? "bg-brand text-white border-brand" : "border-slate-200 text-slate-600"
                  }`}
                >
                  {s === "ativo" ? "✅ Ativo" : "⏸ Inativo"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          className="btn-primary w-full mt-2"
          disabled={!fName.trim() || saving}
          onClick={save}
        >
          {saving ? "Salvando..." : editClient ? "Salvar alterações" : "Cadastrar cliente"}
        </button>
      </div>
    </div>
    </ModalPortal>
  );

  // ─── CONFIRM DELETE ────────────────────────────────────────────────
  const confirmDeleteModal = confirmDelete && (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 text-center">
        <p className="text-2xl">🗑️</p>
        <h3 className="font-bold text-slate-900">Excluir cliente?</h3>
        <p className="text-sm text-slate-500">O histórico de agendamentos e cobranças não será apagado.</p>
        <div className="flex gap-3">
          <button className="flex-1 btn border border-slate-200" onClick={() => setConfirmDelete(null)}>Cancelar</button>
          <button
            className="flex-1 btn bg-red-500 text-white hover:bg-red-600"
            disabled={deleting}
            onClick={() => deleteClient(confirmDelete)}
          >
            {deleting ? "..." : "Excluir"}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );

  // ─── DETAIL VIEW ───────────────────────────────────────────────────
  if (detailClient) {
    return (
      <div className="space-y-4 pb-4">
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">{toast}</div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={() => setDetailClient(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">←</button>
          <h1 className="text-xl font-bold text-slate-900 flex-1 truncate">{detailClient.name}</h1>
          <button onClick={() => openEdit(detailClient)} className="text-xs text-brand underline font-medium">Editar</button>
        </div>

        {/* Info card */}
        <div className="card space-y-2 py-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <Avatar name={detailClient.name} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900">{detailClient.name}</p>
              {detailClient.phone && <p className="text-sm text-slate-500">{detailClient.phone}</p>}
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${detailClient.status === "ativo" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
              {detailClient.status === "ativo" ? "● Ativo" : "Inativo"}
            </span>
          </div>

          {[
            detailClient.email && ["E-mail", detailClient.email],
            detailClient.birthdate && ["Nascimento", fmt(detailClient.birthdate)],
            detailClient.cpf && ["CPF", detailClient.cpf],
            detailClient.address && ["Endereço", detailClient.address],
            detailClient.source && ["Origem", SOURCE_LABELS[detailClient.source] || detailClient.source],
          ].filter(Boolean).map((item, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <span className="text-slate-400 w-24 flex-shrink-0">{(item as string[])[0]}</span>
              <span className="text-slate-700">{(item as string[])[1]}</span>
            </div>
          ))}

          {(detailClient.tags || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(detailClient.tags || []).map((t) => (
                <span key={t} className="text-xs font-medium bg-brand-light text-brand-dark px-2 py-1 rounded-full">{t}</span>
              ))}
            </div>
          )}

          {detailClient.notes && (
            <div className="mt-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm">
              <p className="text-xs font-semibold text-amber-700 mb-1">Observações</p>
              <p className="text-slate-700 whitespace-pre-wrap">{detailClient.notes}</p>
            </div>
          )}
        </div>

        {/* Métricas LTV */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-brand">{detailStats.chargesPaid}</p>
            <p className="text-xs text-slate-500 mt-0.5">Cobranças pagas</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-lg font-bold text-slate-900">{fmtBRL(detailStats.totalSpent)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total gasto</p>
          </div>
        </div>

        {/* Ações WhatsApp */}
        {detailClient.phone && (
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://wa.me/${detailClient.phone.replace(/\D/g, "")}?text=${encodeURIComponent("Olá, " + detailClient.name.split(" ")[0] + "! 😊")}`}
              target="_blank" rel="noopener noreferrer"
              className="btn text-xs border border-slate-200 px-3 py-1.5 flex items-center gap-1.5 hover:border-[#25D366] hover:text-[#25D366]"
            >
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Chamar
            </a>
            {detailClient.birthdate && (() => {
              const today = new Date();
              const bm = detailClient.birthdate!.slice(5, 7);
              const bd = detailClient.birthdate!.slice(8, 10);
              const cm = String(today.getMonth() + 1).padStart(2, "0");
              const cd = String(today.getDate()).padStart(2, "0");
              const isToday = bm === cm && bd === cd;
              let isSoon = false;
              for (let i = 1; i <= 7; i++) {
                const d = new Date(today); d.setDate(d.getDate() + i);
                if (bm === String(d.getMonth() + 1).padStart(2, "0") && bd === String(d.getDate()).padStart(2, "0")) { isSoon = true; break; }
              }
              if (!isToday && !isSoon) return null;
              const msg = isToday
                ? "🎂 Feliz aniversário, " + detailClient.name.split(" ")[0] + "! Que seu dia seja incrível! 🎉✨"
                : "Oi " + detailClient.name.split(" ")[0] + "! Seu aniversário tá chegando! 🎂 Que tal comemorar com um cuidado especial?";
              return (
                <a
                  key="bday"
                  href={`https://wa.me/${detailClient.phone!.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="btn text-xs border border-pink-200 text-pink-600 hover:bg-pink-50 px-3 py-1.5"
                >
                  {isToday ? "🎂 Parabéns!" : "🎂 Aniversário em breve"}
                </a>
              );
            })()}
          </div>
        )}

        {loadingDetail ? (
          <p className="text-slate-400 text-sm text-center py-6">Carregando histórico...</p>
        ) : (
          <>
            {/* Cobranças */}
            <div>
              <h2 className="font-semibold text-slate-900 mb-2">
                Cobranças{detailCharges.length > 0 && ` (${detailCharges.length})`}
              </h2>
              {detailCharges.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6 card">Nenhuma cobrança vinculada.</p>
              ) : (
                <div className="space-y-2">
                  {detailCharges.map((c) => (
                    <div key={c.id} className="card py-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{c.description || "Serviço"}</p>
                        <p className="text-xs text-slate-500">
                          {c.due_date ? `Vence ${fmt(c.due_date)}` : ""}
                          {c.paid_at ? ` · Pago ${fmt(c.paid_at.slice(0, 10))}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-bold text-sm">{fmtBRL(c.amount_cents)}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CHARGE[c.status] || "bg-slate-100 text-slate-500"}`}>
                          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <button
          className="btn text-sm py-2 text-red-500 border border-red-200 hover:bg-red-50 w-full"
          onClick={() => setConfirmDelete(detailClient.id)}
        >
          🗑 Excluir cliente
        </button>

        {modal}
        {confirmDeleteModal}
      </div>
    );
  }

  // ─── LIST VIEW ─────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-4">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">{toast}</div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
        <div className="flex items-center gap-2">
          {clients.length > 0 && (
            <button className="btn border border-slate-200 text-sm px-3 py-2" onClick={exportCSV} title="Exportar a lista filtrada em CSV">
              ⬇ CSV
            </button>
          )}
          <button className="btn-primary text-sm px-4 py-2" onClick={openCreate}>
            + Novo
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          className="input text-sm flex-1"
          placeholder="Buscar por nome, telefone ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input text-sm w-auto"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          title="Ordenar"
        >
          <option value="nome">A–Z</option>
          <option value="recente">Mais recentes</option>
          <option value="gasto">Maior gasto</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          { key: "todos", label: "Todos" },
          { key: "ativo", label: "Ativos" },
          { key: "inativo", label: "Inativos" },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterStatus === f.key
                ? "bg-brand text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
        {dupCount > 0 && (
          <button
            onClick={() => setOnlyDuplicates((v) => !v)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              onlyDuplicates ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
            }`}
          >
            ⚠ Duplicados ({dupCount})
          </button>
        )}
        {clients.length > 0 && (
          <span className="ml-auto text-xs text-slate-400 self-center">{filtered.length}/{clients.length}</span>
        )}
      </div>

      {/* Filtro por etiqueta */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filterTag && (
            <button onClick={() => setFilterTag(null)} className="text-xs font-medium bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full hover:bg-slate-300">✕ limpar</button>
          )}
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setFilterTag(filterTag === t ? null : t)}
              className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                filterTag === t ? "bg-brand text-white" : "bg-brand-light text-brand-dark hover:bg-brand/20"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-slate-400 text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="card text-center text-slate-500 text-sm py-10">
          <p className="text-3xl mb-3">👥</p>
          <p>{search ? `Nenhum resultado para "${search}".` : "Nenhum cliente cadastrado ainda."}</p>
          {!search && <p className="text-xs mt-1">Cadastre um cliente no botão "+ Novo".</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => openDetail(c)}
              className="card w-full text-left py-3 flex items-center gap-3 hover:border-brand transition-colors"
            >
              <Avatar name={c.name} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{c.name}</p>
                <p className="text-sm text-slate-500 truncate">{c.phone || c.email || "Sem contato"}</p>
                {(c.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(c.tags || []).slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] font-medium bg-brand-light text-brand-dark px-1.5 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {isDuplicate(c) && (
                  <span className="text-[10px] font-medium text-amber-600" title="Telefone repetido em outro cliente">⚠ duplicado</span>
                )}
                {(spentByClient[c.id] || 0) > 0 && (
                  <span className="text-xs font-semibold text-brand">{fmtBRL(spentByClient[c.id])}</span>
                )}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.status === "ativo" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                  {c.status === "ativo" ? "Ativo" : "Inativo"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {modal}
      {confirmDeleteModal}
    </div>
  );
}
