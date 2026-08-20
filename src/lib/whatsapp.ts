import type { Registration } from "@/lib/registrations";

function normalizeArgentinaPhone(phone: string) {
  let digits = phone.replace(/\D/g, "");
  digits = digits.replace(/^0+/, "");

  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) return digits;
  if (digits.length === 10 && digits.startsWith("11")) return `549${digits}`;

  return digits;
}

export function makeWhatsappLink(registration: Partial<Registration>) {
  const phone = registration.whatsapp_phone ? normalizeArgentinaPhone(registration.whatsapp_phone) : "";
  const text = `Hola ${registration.first_name || ""}, tu entrada para la Feria Escolar fue confirmada. Código: ${registration.registration_code || ""}. Guardá este código para el ingreso.`;

  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null;
}
