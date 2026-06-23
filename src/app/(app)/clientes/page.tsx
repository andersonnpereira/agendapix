"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";

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
  created_at: string;
};

type BookingItem = {
  id: string;
  date: string;
  time: string;
  status: string;
  notes: string | null;
  services: { name: string; price_cents: number } | null;
};

type ChargeItem = {
  id: string;
  description: string | null;
  amount_cents: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
};

const SOURCE_LABELS: Record<string, string> = {
  link: "Link de agendamento",
  indicacao: "Indicação",
  presencial: "Presencial",
  instagram: "Instagram",
  outro: "Outro",
};

const STATUS_BOOKING: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-700",
  confirmado: "bg-blue-100 text-blue-700",
  concluido: "bg-brand-light text-brand-dark",
  cancelado: "bg-red-100 text-red-500",
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"todos" | "ativo" | "inativo">("todos");
  const [toast, setToast] = useState("");

  // Detail view
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [detailBookings, setDetailBookings] = useState<BookingItem[]>([]);
  const [detailCharges, setDetailCharges] = useState<ChargeItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

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
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("profile_id", user.id)
      .order("name");
    setClients((data as Client[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditClient(null);
    setFName(""); setFPhone(""); setFEmail(""); setFBirthdate("");
    setFCpf(""); setFAddress(""); setFNotes(""); setFSource("link"); setFStatus("ativo");
    setShowModal(true);
  }

  function openEdit(c: Client) {
    setEditClient(c);
    setFName(c.name); setFPhone(c.phone || ""); setFEmail(c.email || "");
    setFBirthdate(c.birthdate || ""); setFCpf(c.cpf || ""); setFAddress(c.address || "");
    setFNotes(c.notes || ""); setFSource(c.source || "link"); setFStatus(c.status || "ativo");
    setShowModal(true);
  }

  async function openDetail(c: Client) {
    setDetailClient(c);
    setLoadingDetail(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: bookings }, { data: charges }] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, date, time, status, notes, services(name, price_cents)")
        .eq("profile_id", user.id)
        .eq("client_id", c.id)
        .order("date", { ascending: false })
        .limit(30),
      supabase
        .from("charges")
        .select("id, description, amount_cents, status, due_date, paid_at")
        .eq("profile_id", user.id)
        .eq("client_id", c.id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    setDetailBookings((bookings as unknown as BookingItem[]) || []);
    setDetailCharges((charges as unknown as ChargeItem[]) || []);
    setLoadingDetail(false);
  }

  async function save() {
    if (!fName.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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
    };

    if (editClient) {
      await supabase.from("clients").update(payload).eq("id", editClient.id);
      if (detailClient?.id === editClient.id) setDetailClient({ ...editClient, ...payload });
      showToast("Cliente atualizado!");
    } else {
      await supabase.from("clients").insert({ ...payload, profile_id: user.id });
      showToast("Cliente cadastrado!");
    }

    setSaving(false);
    setShowModal(false);
    load();
  }

  async function deleteClient(id: string) {
    setDeleting(true);
    await supabase.from("clients").delete().eq("id", id);
    setDeleting(false);
    setConfirmDelete(null);
    if (detailClient?.id === id) setDetailClient(null);
    load();
    showToast("Cliente excluído.");
  }

  const filtered = clients.filter((c) => {
    const matchStatus = filterStatus === "todos" || c.status === filterStatus;
    const s = search.toLowerCase();
    const matchSearch =
      !s ||
      c.name.toLowerCase().includes(s) ||
      (c.phone || "").includes(s) ||
      (c.email || "").toLowerCase().includes(s);
    return matchStatus && matchSearch;
  });

  const fmt = (d: string | null) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const fmtBRL = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ─── MODAL create/edit ─────────────────────────────────────────────
  const modal = showModal && (
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
  );

  // ─── CONFIRM DELETE ────────────────────────────────────────────────
  const confirmDeleteModal = confirmDelete && (
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

          {detailClient.notes && (
            <div className="mt-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm">
              <p className="text-xs font-semibold text-amber-700 mb-1">Observações</p>
              <p className="text-slate-700 whitespace-pre-wrap">{detailClient.notes}</p>
            </div>
          )}
        </div>

        {loadingDetail ? (
          <p className="text-slate-400 text-sm text-center py-6">Carregando histórico...</p>
        ) : (
          <>
            {/* Agendamentos */}
            <div>
              <h2 className="font-semibold text-slate-900 mb-2">
                Agendamentos{detailBookings.length > 0 && ` (${detailBookings.length})`}
              </h2>
              {detailBookings.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6 card">Nenhum agendamento vinculado.</p>
              ) : (
                <div className="space-y-2">
                  {detailBookings.map((b) => (
                    <div key={b.id} className="card py-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {(b.services as { name: string } | null)?.name || "Serviço"}
                        </p>
                        <p className="text-xs text-slate-500">{fmt(b.date)} às {b.time?.slice(0, 5)}</p>
                        {b.notes && <p className="text-xs text-slate-400 italic mt-0.5">"{b.notes}"</p>}
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_BOOKING[b.status] || "bg-slate-100 text-slate-500"}`}>
                        {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

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

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
        <button className="btn-primary text-sm px-4 py-2" onClick={openCreate}>
          + Novo
        </button>
      </div>

      <input
        className="input text-sm"
        placeholder="Buscar por nome, telefone ou e-mail..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex gap-2">
        {(["todos", "ativo", "inativo"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
              filterStatus === s ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        {clients.length > 0 && (
          <span className="ml-auto text-xs text-slate-400 self-center">{clients.length} cliente{clients.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="card text-center text-slate-500 text-sm py-10">
          <p className="text-3xl mb-3">👥</p>
          <p>{search ? `Nenhum resultado para "${search}".` : "Nenhum cliente cadastrado ainda."}</p>
          {!search && <p className="text-xs mt-1">Clientes são criados automaticamente quando alguém agenda pelo seu link.</p>}
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
                {c.notes && (
                  <p className="text-xs text-slate-400 italic truncate mt-0.5">"{c.notes}"</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.status === "ativo" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                  {c.status === "ativo" ? "Ativo" : "Inativo"}
                </span>
                <span className="text-xs text-slate-300">›</span>
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
