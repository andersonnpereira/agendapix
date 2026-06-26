"use client";

// MIGRATION: run once on your Supabase SQL editor:
// ALTER TABLE public.services ADD COLUMN IF NOT EXISTS description text;
// ALTER TABLE public.services ADD COLUMN IF NOT EXISTS image_url text;
// ALTER TABLE public.services ADD COLUMN IF NOT EXISTS extra_questions jsonb DEFAULT '[]'::jsonb;

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase-browser";
import { formatBRL, parseToCents } from "@/lib/format";

type ExtraQuestion = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  options: string[];
  required: boolean;
};

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  active: boolean;
  image_url: string | null;
  extra_questions: ExtraQuestion[];
};

type FormState = { name: string; description: string; price: string; duration: string };
const EMPTY_FORM: FormState = { name: "", description: "", price: "", duration: "60" };

function formFromService(s: Service): FormState {
  return {
    name: s.name,
    description: s.description ?? "",
    price: s.price_cents > 0 ? (s.price_cents / 100).toFixed(2).replace(".", ",") : "",
    duration: String(s.duration_minutes),
  };
}

function validate(form: FormState): string | null {
  if (!form.name.trim()) return "O nome do serviço é obrigatório.";
  if (parseToCents(form.price) < 0) return "O preço não pode ser negativo.";
  const dur = parseInt(form.duration);
  if (isNaN(dur) || dur < 5) return "A duração mínima é de 5 minutos.";
  return null;
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Modal de perguntas ────────────────────────────────────────────────────────
function QuestionsModal({
  service,
  onClose,
  onSaved,
}: {
  service: Service;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [questions, setQuestions] = useState<ExtraQuestion[]>(service.extra_questions || []);
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<ExtraQuestion["type"]>("text");
  const [newRequired, setNewRequired] = useState(false);
  const [newOptions, setNewOptions] = useState(""); // comma-separated for select
  const [addError, setAddError] = useState("");

  function addQuestion() {
    if (!newLabel.trim()) { setAddError("Informe o texto da pergunta."); return; }
    if (newType === "select" && !newOptions.trim()) { setAddError("Informe as opções separadas por vírgula."); return; }
    setAddError("");
    const q: ExtraQuestion = {
      id: genId(),
      label: newLabel.trim(),
      type: newType,
      options: newType === "select" ? newOptions.split(",").map((o) => o.trim()).filter(Boolean) : [],
      required: newRequired,
    };
    setQuestions((prev) => [...prev, q]);
    setNewLabel("");
    setNewOptions("");
    setNewRequired(false);
    setNewType("text");
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  async function save() {
    setSaving(true);
    await supabase.from("services").update({ extra_questions: questions }).eq("id", service.id);
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Perguntas — {service.name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {/* Lista de perguntas */}
        {questions.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-2">Nenhuma pergunta ainda.</p>
        ) : (
          <div className="space-y-2">
            {questions.map((q, i) => (
              <div key={q.id} className="flex items-start justify-between gap-2 bg-slate-50 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{i + 1}. {q.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {q.type === "text" ? "Texto curto" : q.type === "textarea" ? "Texto longo" : `Seleção: ${q.options.join(", ")}`}
                    {q.required && " · Obrigatória"}
                  </p>
                </div>
                <button onClick={() => removeQuestion(q.id)} className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0">×</button>
              </div>
            ))}
          </div>
        )}

        {/* Adicionar nova pergunta */}
        <div className="border border-dashed border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nova pergunta</p>
          <input
            className="input text-sm"
            placeholder="Ex: Tem alergia a algum produto?"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <div className="flex gap-2">
            <select
              className="input text-sm flex-1"
              value={newType}
              onChange={(e) => setNewType(e.target.value as ExtraQuestion["type"])}
            >
              <option value="text">Texto curto</option>
              <option value="textarea">Texto longo</option>
              <option value="select">Múltipla escolha</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
                className="rounded"
              />
              Obrigatória
            </label>
          </div>
          {newType === "select" && (
            <input
              className="input text-sm"
              placeholder="Opções separadas por vírgula: Sim, Não, Talvez"
              value={newOptions}
              onChange={(e) => setNewOptions(e.target.value)}
            />
          )}
          {addError && <p className="text-xs text-red-500">{addError}</p>}
          <button
            onClick={addQuestion}
            className="w-full py-2 rounded-xl border border-brand text-brand text-sm font-medium hover:bg-brand-light transition-colors"
          >
            + Adicionar pergunta
          </button>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar perguntas"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ServicosPage() {
  const supabase = createClient();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [questionsService, setQuestionsService] = useState<Service | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false });
    setServices(
      (data || []).map((s) => ({
        ...s,
        extra_questions: Array.isArray(s.extra_questions) ? s.extra_questions : [],
      })) as Service[]
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setEditingService(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(s: Service) {
    setEditingService(s);
    setForm(formFromService(s));
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingService(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveService() {
    const err = validate(form);
    if (err) { setFormError(err); return; }
    setFormError(null);
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_cents: parseToCents(form.price),
      duration_minutes: parseInt(form.duration) || 60,
    };

    if (editingService) {
      await supabase.from("services").update(payload).eq("id", editingService.id);
    } else {
      await supabase.from("services").insert({ ...payload, profile_id: user.id });
    }

    setSaving(false);
    closeForm();
    showToast("Serviço salvo!");
    load();
  }

  async function toggleActive(s: Service) {
    await supabase.from("services").update({ active: !s.active }).eq("id", s.id);
    showToast(s.active ? "Serviço pausado." : "Serviço ativado.");
    load();
  }

  async function uploadImage(serviceId: string, file: File) {
    setUploadingImage(serviceId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${serviceId}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("service-images")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) {
        showToast("Erro ao enviar imagem. Verifique o bucket 'service-images' no Supabase.");
        return;
      }

      const { data: urlData } = supabase.storage.from("service-images").getPublicUrl(path);
      await supabase.from("services").update({ image_url: urlData.publicUrl }).eq("id", serviceId);
      showToast("Foto atualizada!");
      load();
    } finally {
      setUploadingImage(null);
    }
  }

  async function removeImage(serviceId: string) {
    await supabase.from("services").update({ image_url: null }).eq("id", serviceId);
    showToast("Foto removida.");
    load();
  }

  async function confirmAndDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    await supabase.from("services").delete().eq("id", confirmDelete.id);
    setDeleting(false);
    setConfirmDelete(null);
    showToast("Serviço excluído!");
    load();
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm px-5 py-2.5 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Serviços</h1>
        <button className="btn-primary px-4 py-2 text-sm" onClick={showForm ? closeForm : openNew}>
          {showForm ? "Fechar" : "+ Novo"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card space-y-3">
          <p className="font-semibold text-slate-700 text-sm">
            {editingService ? "Editar serviço" : "Novo serviço"}
          </p>
          <div>
            <label className="label">Nome do serviço *</label>
            <input className="input" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Ex: Corte feminino" />
          </div>
          <div>
            <label className="label">Descrição (opcional)</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Breve descrição exibida no link público" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Preço (R$)</label>
              <input className="input" value={form.price} onChange={(e) => setField("price", e.target.value)} placeholder="80,00" inputMode="decimal" />
            </div>
            <div>
              <label className="label">Duração (min) *</label>
              <input className="input" value={form.duration} onChange={(e) => setField("duration", e.target.value)} inputMode="numeric" />
            </div>
          </div>
          {formError && <p className="text-red-500 text-xs">{formError}</p>}
          <button className="btn-primary w-full disabled:opacity-50" onClick={saveService} disabled={saving}>
            {saving ? "Salvando..." : "Salvar serviço"}
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-slate-400 text-sm">Carregando...</p>
      ) : services.length === 0 ? (
        <div className="card text-center text-slate-500 text-sm py-8">Você ainda não cadastrou serviços.</div>
      ) : (
        <div className="space-y-2">
          {services.map((s) => (
            <div key={s.id} className="card py-3 space-y-2">
              {/* Header */}
              <div className="flex items-center gap-3">
                {s.image_url && (
                  <Image src={s.image_url} alt={s.name} width={56} height={56} className="rounded-xl object-cover w-14 h-14 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`font-medium truncate ${s.active ? "text-slate-900" : "text-slate-400 line-through"}`}>{s.name}</p>
                  {s.description && <p className="text-xs text-slate-400 truncate">{s.description}</p>}
                  <p className="text-sm text-slate-500">{formatBRL(s.price_cents)} · {s.duration_minutes} min</p>
                </div>
                <div className="flex flex-col gap-1 items-end shrink-0">
                  <button className="text-xs text-indigo-500 hover:text-indigo-700" onClick={() => openEdit(s)}>Editar</button>
                  <button className="text-xs text-slate-500 hover:text-slate-800" onClick={() => toggleActive(s)}>{s.active ? "Pausar" : "Ativar"}</button>
                  <button className="text-xs text-red-500 hover:text-red-700" onClick={() => setConfirmDelete(s)}>Excluir</button>
                </div>
              </div>

              {/* Tools row */}
              <div className="flex gap-2 pt-1 border-t border-slate-100 flex-wrap">
                <label className={`text-xs cursor-pointer px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:border-brand hover:text-brand transition-colors ${uploadingImage === s.id ? "opacity-50 pointer-events-none" : ""}`}>
                  {uploadingImage === s.id ? "Enviando..." : s.image_url ? "📷 Trocar foto" : "📷 Foto"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(s.id, f); }} />
                </label>
                {s.image_url && (
                  <button className="text-xs text-slate-400 hover:text-red-500 px-2.5 py-1 rounded-lg border border-slate-200" onClick={() => removeImage(s.id)}>
                    Remover foto
                  </button>
                )}
                <button
                  onClick={() => setQuestionsService(s)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                >
                  📝 Perguntas{s.extra_questions.length > 0 ? ` (${s.extra_questions.length})` : ""}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal perguntas */}
      {questionsService && (
        <QuestionsModal
          service={questionsService}
          onClose={() => setQuestionsService(null)}
          onSaved={() => { showToast("Perguntas salvas!"); load(); }}
        />
      )}

      {/* Delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <p className="font-semibold text-slate-800">Excluir serviço?</p>
            <p className="text-sm text-slate-500">
              O serviço <span className="font-medium text-slate-700">&quot;{confirmDelete.name}&quot;</span> será removido permanentemente.
            </p>
            <div className="flex gap-3">
              <button className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                Cancelar
              </button>
              <button className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm hover:bg-red-600 disabled:opacity-50" onClick={confirmAndDelete} disabled={deleting}>
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
