import { PaymentInfo, RegistrationForm } from "@/components/RegistrationForm";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f6b84b55,transparent_28%),linear-gradient(135deg,#f7f3ea_0%,#eaf6f1_52%,#f9ece8_100%)] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-meadow">Feria Escolar</p>
          <h1 className="mt-2 text-3xl font-black sm:text-5xl">Registro de Entrada</h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-700">
            Completá tus datos y cargá el comprobante de pago para registrar tu entrada.
          </p>
        </header>
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <PaymentInfo />
          <RegistrationForm />
        </div>
      </div>
    </main>
  );
}
