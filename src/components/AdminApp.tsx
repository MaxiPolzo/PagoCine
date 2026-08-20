"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Eye, LogOut, Plus, RefreshCw, Search, ShieldCheck, UserCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { courses } from "@/config/payment";
import type { Registration } from "@/lib/registrations";
import { formatMoney, statusLabels, type PaymentStatus } from "@/lib/status";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { StatusBadge } from "@/components/StatusBadge";

type AdminView = "dashboard" | "records" | "courses" | "control" | "entryList" | "settings";
type Stats = { total: number; approved: number; pending: number; rejected: number; revenue: number };

const nav = [
  { href: "/paneladmin/dashboard", label: "Dashboard" },
  { href: "/paneladmin/registros", label: "Registros" },
  { href: "/paneladmin/cursos", label: "Cursos" },
  { href: "/paneladmin/control", label: "Control de Entrada" },
  { href: "/paneladmin/ingreso", label: "Lista de Ingreso" },
  { href: "/paneladmin/configuracion", label: "Configuración" }
];

export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError("No se pudo iniciar sesión. Revisá email y contraseña.");
      return;
    }
    router.push("/paneladmin/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form onSubmit={submit} className="section-card w-full max-w-md p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-meadow" />
          <div>
            <h1 className="text-2xl font-black">Panel de Administración</h1>
            <p className="text-sm text-slate-600">Feria Escolar</p>
          </div>
        </div>
        <label className="mt-6 block text-sm font-semibold">
          Email
          <input className="input mt-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="mt-4 block text-sm font-semibold">
          Contraseña
          <input className="input mt-1" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error ? <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        <button className="btn btn-primary mt-5 w-full" disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </main>
  );
}

export function AdminShell({ view }: { view: AdminView }) {
  const pathname = usePathname();
  const router = useRouter();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [query, setQuery] = useState("");
  const [course, setCourse] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (course) params.set("course", course);
      if (status) params.set("status", status);
      const [recordsResponse, statsResponse] = await Promise.all([
        fetch(`/api/admin/registrations?${params}`),
        fetch("/api/admin/stats")
      ]);
      if (!recordsResponse.ok) throw new Error("No se pudieron cargar los registros.");
      const recordsPayload = await recordsResponse.json();
      const statsPayload = await statsResponse.json();
      setRegistrations(recordsPayload.registrations);
      setStats(statsPayload.stats);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error al cargar el panel.");
    } finally {
      setLoading(false);
    }
  }, [course, query, status]);

  useEffect(() => {
    // The dashboard intentionally refetches when filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    router.push("/paneladmin");
    router.refresh();
  }

  async function updateStatus(id: string, paymentStatus: PaymentStatus, notes: string) {
    setNotice("");
    const response = await fetch(`/api/admin/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: paymentStatus, notes })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "No se pudo actualizar el registro.");
      return;
    }
    setNotice("Pago actualizado.");
    await loadData();
    setSelected(null);
  }

  async function createManualRegistration(input: {
    firstName: string;
    lastName: string;
    whatsappPhone: string;
    course: string;
  }) {
    setNotice("");
    setError("");
    const response = await fetch("/api/admin/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "No se pudo cargar el ingreso manual.");
      return false;
    }
    setNotice(`Ingreso manual cargado: ${payload.registration.registration_code}`);
    await loadData();
    return true;
  }

  async function openReceipt(path: string) {
    const response = await fetch("/api/receipt-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path })
    });
    const payload = await response.json();
    if (payload.url) window.open(payload.url, "_blank", "noopener,noreferrer");
  }

  async function checkIn(id: string) {
    const response = await fetch(`/api/admin/checkin/${id}`, { method: "PATCH" });
    if (response.ok) await loadData();
  }

  const grouped = useMemo(() => {
    return courses.map((courseName) => ({
      course: courseName,
      rows: registrations.filter((row) => row.course === courseName).sort((a, b) => a.last_name.localeCompare(b.last_name))
    }));
  }, [registrations]);

  const filteredForControl = registrations.filter((row) => {
    if (!query) return true;
    const needle = query.toLowerCase();
    return [row.first_name, row.last_name, row.course, row.registration_code].some((value) => value.toLowerCase().includes(needle));
  });

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black">Panel de Administración — Feria Escolar</h1>
            <p className="text-sm text-slate-600">Gestión de pagos, comprobantes y control de ingreso.</p>
          </div>
          <button className="btn btn-secondary" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              className={`rounded-md px-3 py-2 text-sm font-semibold ${pathname === item.href ? "bg-ink text-white" : "text-slate-700 hover:bg-slate-100"}`}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6">
        {view !== "settings" ? (
          <Filters query={query} setQuery={setQuery} course={course} setCourse={setCourse} status={status} setStatus={setStatus} />
        ) : null}
        {notice ? <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-800">{notice}</p> : null}
        {error ? <p className="mt-4 rounded-md bg-rose-50 p-3 text-rose-700">{error}</p> : null}
        {loading ? <Skeleton /> : null}
        {!loading && view === "dashboard" && <Dashboard stats={stats} registrations={registrations} onManualCreate={createManualRegistration} />}
        {!loading && view === "records" && <RecordsTable registrations={registrations} onSelect={setSelected} />}
        {!loading && view === "courses" && <CourseGroups groups={grouped} onSelect={setSelected} />}
        {!loading && view === "control" && <ControlList registrations={filteredForControl} onCheckIn={checkIn} />}
        {!loading && view === "entryList" && <EntryList registrations={filteredForControl} onCheckIn={checkIn} />}
        {!loading && view === "settings" && <Settings />}
      </section>

      {selected ? (
        <DetailModal
          registration={selected}
          onClose={() => setSelected(null)}
          onOpenReceipt={openReceipt}
          onUpdateStatus={updateStatus}
        />
      ) : null}
    </main>
  );
}

function Filters(props: {
  query: string;
  setQuery: (value: string) => void;
  course: string;
  setCourse: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
}) {
  return (
    <div className="section-card grid gap-3 p-4 lg:grid-cols-[1fr_220px_220px]">
      <label className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <input className="input pl-9" placeholder="Buscar por nombre, código o ID de operación" value={props.query} onChange={(event) => props.setQuery(event.target.value)} />
      </label>
      <select className="input" value={props.course} onChange={(event) => props.setCourse(event.target.value)}>
        <option value="">Todos los cursos</option>
        {courses.map((course) => (
          <option key={course}>{course}</option>
        ))}
      </select>
      <select className="input" value={props.status} onChange={(event) => props.setStatus(event.target.value)}>
        <option value="">Todos los estados</option>
        {Object.entries(statusLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Dashboard({
  stats,
  registrations,
  onManualCreate
}: {
  stats: Stats | null;
  registrations: Registration[];
  onManualCreate: (input: { firstName: string; lastName: string; whatsappPhone: string; course: string }) => Promise<boolean>;
}) {
  const cards = [
    ["Total registrados", stats?.total ?? 0],
    ["Pagos confirmados", stats?.approved ?? 0],
    ["Pendientes", stats?.pending ?? 0],
    ["Rechazados", stats?.rejected ?? 0],
    ["Recaudación confirmada", formatMoney(stats?.revenue ?? 0)]
  ];
  return (
    <div className="mt-5 grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([label, value]) => (
          <div key={label} className="section-card p-4">
            <p className="text-sm text-slate-600">{label}</p>
            <p className="mt-2 text-2xl font-black">{value}</p>
          </div>
        ))}
      </div>
      <ManualRegistrationCard onManualCreate={onManualCreate} />
      <RecordsTable registrations={registrations.slice(0, 12)} onSelect={() => {}} />
    </div>
  );
}

function ManualRegistrationCard({
  onManualCreate
}: {
  onManualCreate: (input: { firstName: string; lastName: string; whatsappPhone: string; course: string }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setLoading(true);
    const ok = await onManualCreate({
      firstName: String(formData.get("firstName") || ""),
      lastName: String(formData.get("lastName") || ""),
      whatsappPhone: String(formData.get("whatsappPhone") || ""),
      course: String(formData.get("course") || "")
    });
    setLoading(false);
    if (ok) {
      form.reset();
      setOpen(false);
    }
  }

  return (
    <div className="section-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black">Ingresos manuales</h2>
          <p className="text-sm text-slate-600">Para pagos en puerta. Se cargan como confirmados y suman a la recaudación.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen((value) => !value)}>
          <Plus className="h-4 w-4" /> Agregar ingreso
        </button>
      </div>
      {open ? (
        <form onSubmit={submit} className="mt-4 grid gap-3 lg:grid-cols-5">
          <input className="input" name="firstName" placeholder="Nombre" required />
          <input className="input" name="lastName" placeholder="Apellido" required />
          <input className="input" name="whatsappPhone" placeholder="WhatsApp" required />
          <select className="input" name="course" required defaultValue="">
            <option value="" disabled>Curso</option>
            {courses.map((course) => (
              <option key={course}>{course}</option>
            ))}
          </select>
          <button className="btn btn-primary" disabled={loading}>{loading ? "Guardando..." : "Guardar"}</button>
        </form>
      ) : null}
    </div>
  );
}

function RecordsTable({ registrations, onSelect }: { registrations: Registration[]; onSelect: (row: Registration) => void }) {
  return (
    <div className="section-card mt-5 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Nombre", "Apellido", "WhatsApp", "Curso", "Importe", "Estado", "Fecha", "Código", "Acción"].map((head) => (
                <th key={head} className="px-4 py-3">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {registrations.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold">{row.first_name}</td>
                <td className="px-4 py-3">{row.last_name}</td>
                <td className="px-4 py-3">{row.whatsapp_phone || "-"}</td>
                <td className="px-4 py-3">{row.course}</td>
                <td className="px-4 py-3">{formatMoney(Number(row.amount || 0))}</td>
                <td className="px-4 py-3"><StatusBadge status={row.payment_status} /></td>
                <td className="px-4 py-3">{new Date(row.created_at).toLocaleDateString("es-AR")}</td>
                <td className="px-4 py-3 font-mono">{row.registration_code}</td>
                <td className="px-4 py-3">
                  <button className="btn btn-secondary py-1.5" onClick={() => onSelect(row)}>
                    <Eye className="h-4 w-4" /> Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CourseGroups({ groups, onSelect }: { groups: { course: string; rows: Registration[] }[]; onSelect: (row: Registration) => void }) {
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      {groups.map((group) => (
        <div key={group.course} className="section-card p-4">
          <h2 className="font-black">{group.course} — {group.rows.length} registrados</h2>
          <div className="mt-3 divide-y">
            {group.rows.map((row) => (
              <button key={row.id} className="flex w-full items-center justify-between gap-3 py-2 text-left hover:text-meadow" onClick={() => onSelect(row)}>
                <span>{row.last_name}, {row.first_name}</span>
                <StatusBadge status={row.payment_status} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ControlList({ registrations, onCheckIn }: { registrations: Registration[]; onCheckIn: (id: string) => void }) {
  return (
    <div className="mt-5 grid gap-3">
      {registrations.map((row) => {
        const confirmed = row.payment_status === "approved";
        return (
          <div key={row.id} className="section-card flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-black">{row.full_name}</p>
              <p className="text-sm text-slate-600">{row.course} · {row.registration_code}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md px-3 py-2 text-sm font-black ${confirmed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                {confirmed ? "ENTRADA CONFIRMADA" : "NO CONFIRMADA"}
              </span>
              {row.checked_in ? (
                <span className="rounded-md bg-slate-900 px-3 py-2 text-sm font-black text-white">✓ YA INGRESÓ</span>
              ) : (
                <button className="btn btn-primary" disabled={!confirmed} onClick={() => onCheckIn(row.id)}>
                  <UserCheck className="h-4 w-4" /> Marcar como ingresado
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EntryList({ registrations, onCheckIn }: { registrations: Registration[]; onCheckIn: (id: string) => void }) {
  const approved = registrations
    .filter((row) => row.payment_status === "approved")
    .sort((a, b) => a.last_name.localeCompare(b.last_name));

  return (
    <div className="mt-5 grid gap-3">
      {approved.map((row) => (
        <div
          key={row.id}
          className={`section-card flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between ${row.checked_in ? "opacity-60" : ""}`}
        >
          <div className={row.checked_in ? "line-through" : ""}>
            <p className="font-black">{row.last_name}, {row.first_name}</p>
            <p className="text-sm text-slate-600">{row.course} · {row.registration_code} · {row.whatsapp_phone || "Sin WhatsApp"}</p>
          </div>
          {row.checked_in ? (
            <span className="rounded-md bg-slate-900 px-3 py-2 text-sm font-black text-white">YA PASÓ</span>
          ) : (
            <button className="btn btn-primary" onClick={() => onCheckIn(row.id)}>
              <UserCheck className="h-4 w-4" /> Marcar pasó
            </button>
          )}
        </div>
      ))}
      {approved.length === 0 ? (
        <div className="section-card p-5 text-sm text-slate-600">Todavía no hay entradas confirmadas.</div>
      ) : null}
    </div>
  );
}

function DetailModal(props: {
  registration: Registration;
  onClose: () => void;
  onOpenReceipt: (path: string) => void;
  onUpdateStatus: (id: string, status: PaymentStatus, notes: string) => void;
}) {
  const [notes, setNotes] = useState(props.registration.verification_notes || "");
  const whatsappDigits = props.registration.whatsapp_phone?.replace(/\D/g, "").replace(/^0+/, "") || "";
  const whatsappTo = whatsappDigits.startsWith("54")
    ? whatsappDigits
    : whatsappDigits.length === 10 && whatsappDigits.startsWith("11")
      ? `549${whatsappDigits}`
      : whatsappDigits;
  const whatsappMessage = `Hola ${props.registration.first_name}, tu entrada para la Feria Escolar fue confirmada. Código: ${props.registration.registration_code}. Guardá este código para el ingreso.`;
  const whatsappHref = whatsappTo ? `https://wa.me/${whatsappTo}?text=${encodeURIComponent(whatsappMessage)}` : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4">
      <div className="mx-auto max-h-[92vh] max-w-3xl overflow-auto rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">{props.registration.full_name}</h2>
            <p className="text-sm text-slate-600">{props.registration.course} · {props.registration.registration_code}</p>
          </div>
          <button className="btn btn-secondary" onClick={props.onClose}>Cerrar</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Info label="Importe" value={formatMoney(Number(props.registration.amount || 0))} />
          <Info label="WhatsApp" value={props.registration.whatsapp_phone || "No guardado"} />
          <Info label="Estado" value={statusLabels[props.registration.payment_status]} />
          <Info label="ID de operación" value={props.registration.payment_operation_id || "No detectado"} />
          <Info label="Método" value={props.registration.verification_method || "Sin datos"} />
          <Info label="Alias extraído" value={props.registration.payment_alias || "No detectado"} />
          <Info label="CVU extraído" value={props.registration.payment_cvu || "No detectado"} />
        </div>
        <label className="mt-4 block text-sm font-semibold">
          Notas de revisión
          <textarea className="input mt-1 min-h-28" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <details className="mt-4 rounded-md bg-slate-50 p-3">
          <summary className="cursor-pointer font-semibold">Texto visible extraído del comprobante</summary>
          <pre className="mt-3 whitespace-pre-wrap text-xs text-slate-700">{props.registration.ocr_text || "Sin OCR disponible"}</pre>
        </details>
        <div className="mt-5 flex flex-wrap gap-2">
          {props.registration.verification_method !== "manual_door_payment" ? (
            <button className="btn btn-secondary" onClick={() => props.onOpenReceipt(props.registration.receipt_storage_path)}>Ver comprobante</button>
          ) : null}
          <button className="btn btn-primary" onClick={() => props.onUpdateStatus(props.registration.id, "approved", notes)}>Confirmar pago</button>
          <button className="btn bg-rose-600 text-white hover:bg-rose-700" onClick={() => props.onUpdateStatus(props.registration.id, "rejected", notes)}>Rechazar pago</button>
          <button className="btn bg-sky-600 text-white hover:bg-sky-700" onClick={() => props.onUpdateStatus(props.registration.id, "manual_review", notes)}>Revisión manual</button>
          {whatsappHref ? (
            <a className="btn btn-secondary" href={whatsappHref} target="_blank" rel="noreferrer">
              Enviar WhatsApp
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-100 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function Settings() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function syncSheet() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/sheets-sync", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo sincronizar la planilla.");
      setMessage(`Planilla sincronizada: ${payload.count} registros enviados.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo sincronizar la planilla.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="section-card p-5">
      <h2 className="text-xl font-black">Configuración administrativa</h2>
      <p className="mt-2 text-slate-600">
        Los datos de pago y cursos se modifican desde <code>src/config/payment.ts</code>. La planilla online se configura con <code>GOOGLE_SHEETS_WEBHOOK_URL</code>.
      </p>
      <button className="btn btn-primary mt-5" onClick={syncSheet} disabled={loading}>
        <RefreshCw className="h-4 w-4" /> {loading ? "Sincronizando..." : "Sincronizar planilla"}
      </button>
      {message ? <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm font-medium">{message}</p> : null}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mt-5 grid gap-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-lg bg-white" />
      ))}
    </div>
  );
}
