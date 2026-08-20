"use client";

import { CheckCircle2, Clipboard, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import { courses, paymentConfig } from "@/config/payment";
import { formatMoney, statusLabels, type PaymentStatus } from "@/lib/status";
import { MAX_RECEIPT_BYTES } from "@/lib/validation";

type Result = {
  registration_code: string;
  payment_status: PaymentStatus;
  verification_notes: string | null;
};

export function RegistrationForm() {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const amount = useMemo(() => formatMoney(paymentConfig.amount), []);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview(null);
    setFileName(file?.name || "");
    if (file?.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(file));
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    const form = event.currentTarget;
    const file = (form.elements.namedItem("receipt") as HTMLInputElement).files?.[0];

    if (!file) {
      setError("Subí tu comprobante de pago.");
      return;
    }

    if (file.size > MAX_RECEIPT_BYTES) {
      setError("El archivo no puede superar 8 MB.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        body: new FormData(form)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo enviar el registro.");
      setResult(payload.registration);
      form.reset();
      setPreview(null);
      setFileName("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Ocurrió un error.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    const confirmed = result.payment_status === "approved";
    return (
      <div className="section-card p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <CheckCircle2 className={confirmed ? "text-emerald-600" : "text-amber-600"} />
          <div>
            <h2 className="text-2xl font-bold">{confirmed ? "¡Pago confirmado!" : "Registro recibido."}</h2>
            <p className="mt-2 text-slate-600">
              {confirmed
                ? "Tu entrada fue registrada correctamente."
                : "Estamos verificando tu comprobante. Tu entrada queda pendiente de confirmación."}
            </p>
          </div>
        </div>
        <div className="mt-6 rounded-lg bg-slate-100 p-4">
          <p className="text-sm text-slate-600">Código de registro</p>
          <p className="mt-1 text-2xl font-black tracking-wide">{result.registration_code}</p>
          <p className="mt-2 text-sm text-slate-600">Estado: {statusLabels[result.payment_status]}</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(result.registration_code)}>
            <Clipboard className="h-4 w-4" /> Copiar código
          </button>
          <a
            className="btn btn-secondary"
            href={`https://wa.me/5491151184609?text=${encodeURIComponent(`Hola, tengo una consulta sobre mi registro ${result.registration_code}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            Consultar por WhatsApp
          </a>
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-700">
          Guardá este código. Es tu comprobante para el control de entrada. Si hay algún problema, comunicate al 011 5118-4609.
        </p>
        <button className="btn btn-primary mt-6 w-full" onClick={() => setResult(null)}>
          Registrar otra entrada
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="section-card p-5 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Nombre
          <input name="firstName" className="input mt-1" minLength={2} required autoComplete="given-name" />
        </label>
        <label className="text-sm font-semibold">
          Apellido
          <input name="lastName" className="input mt-1" minLength={2} required autoComplete="family-name" />
        </label>
      </div>

      <label className="mt-4 block text-sm font-semibold">
        WhatsApp
        <input
          name="whatsappPhone"
          className="input mt-1"
          type="tel"
          placeholder="Ej: 11 5118-4609"
          required
          autoComplete="tel"
        />
      </label>

      <label className="mt-4 block text-sm font-semibold">
        Curso
        <select name="course" className="input mt-1" required defaultValue="">
          <option value="" disabled>
            Seleccioná el curso
          </option>
          {courses.map((course) => (
            <option key={course}>{course}</option>
          ))}
        </select>
      </label>

      <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
          <UploadCloud className="h-8 w-8 text-meadow" />
          <span className="font-semibold">Subí tu comprobante de pago</span>
          <span className="text-sm text-slate-600">PDF hasta 8 MB</span>
          <input name="receipt" type="file" accept=".pdf,application/pdf" onChange={onFileChange} className="sr-only" required />
        </label>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <img src={preview} alt="Previsualización del comprobante" className="mt-4 max-h-64 w-full rounded-md object-contain" /> : null}
        {!preview && fileName ? <p className="mt-4 rounded-md bg-white p-3 text-sm">{fileName}</p> : null}
      </div>

      <p className="mt-4 text-sm text-slate-600">
        El comprobante debe ser PDF y corresponder a una transferencia de {amount} realizada a los datos indicados arriba.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Usaremos estos datos exclusivamente para gestionar el acceso a la feria. No se publican listados ni comprobantes.
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-700">
        Si hay algún problema, comunicate al 011 5118-4609.
      </p>

      {error ? <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p> : null}

      <button className="btn btn-primary mt-5 w-full" disabled={loading}>
        {loading ? "Procesando comprobante..." : "Registrar entrada"}
      </button>
    </form>
  );
}

export function PaymentInfo() {
  return (
    <div className="section-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-meadow">Valor de la entrada</p>
          <p className="mt-1 text-4xl font-black">{formatMoney(paymentConfig.amount)}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 text-sm">
        <div className="rounded-md bg-slate-100 p-3">
          <span className="font-semibold">Alias:</span> {paymentConfig.alias}
        </div>
        <div className="rounded-md bg-slate-100 p-3">
          <span className="font-semibold">CVU:</span> {paymentConfig.cvu}
        </div>
        <div className="rounded-md bg-slate-100 p-3">
          <span className="font-semibold">Titular:</span> {paymentConfig.holder}
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(paymentConfig.alias)}>
          <Clipboard className="h-4 w-4" /> Copiar Alias
        </button>
        <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(paymentConfig.cvu)}>
          <Clipboard className="h-4 w-4" /> Copiar CVU
        </button>
      </div>
      <p className="mt-4 text-sm text-slate-600">
        Después de realizar la transferencia, guardá el comprobante y subilo en el formulario.
      </p>
    </div>
  );
}
