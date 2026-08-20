# Pago Feria Escolar

Aplicación web completa para registrar entradas pagadas por transferencia, guardar comprobantes PDF privados, leerlos automáticamente, sincronizar una planilla de Google Sheets y controlar ingresos el día de la feria.

## Stack

- Next.js App Router, React, TypeScript estricto y Tailwind CSS.
- Supabase para PostgreSQL, Auth y Storage privado.
- API Routes server-side para operaciones sensibles.
- Lectura automática de texto desde PDF.
- Sincronización automática con Google Sheets mediante Apps Script.
- Lista para desplegar en Vercel.

## Instalación local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abrí `http://localhost:3000`.

## Supabase

1. Creá un proyecto en Supabase.
2. En Project Settings > API copiá:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Pegá esos valores en `.env.local` y luego en Vercel.
4. Ejecutá el SQL de `supabase/migrations/001_initial_schema.sql` desde SQL Editor.
5. Confirmá que exista el bucket privado `receipts`.
6. En Authentication > Users, creá el usuario administrador con email y contraseña.

La aplicación no usa contraseñas hardcodeadas. Cualquier usuario creado en Supabase Auth podrá entrar al panel, por eso conviene crear solo administradores autorizados.

## Variables de entorno

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_ACCOUNT_REPORT_ID=
MERCADOPAGO_WEBHOOK_SECRET=
GOOGLE_SHEETS_WEBHOOK_URL=
```

Las variables de Mercado Pago son opcionales y quedan reservadas para conciliación oficial autenticada de la cuenta. No deben exponerse al frontend.

`GOOGLE_SHEETS_WEBHOOK_URL` es opcional. Si se configura con una URL de Apps Script terminada en `/exec`, la app sincroniza cada registro, revisión y check-in con la planilla.

## Verificación de Mercado Pago

Una captura o PDF de comprobante no permite garantizar autenticidad bancaria total. Esta app lee texto de PDF para extraer importe, alias, CVU, titular e ID de operación, y después aplica reglas:

- Importe diferente de `$6.000`: `rejected`.
- Comprobante repetido por hash o ID de operación: `duplicate`.
- PDF con importe y destinatario coincidentes: `approved`.
- Lectura insuficiente: `pending`.

Para verificación bancaria real se debe conciliar contra información autenticada de la cuenta receptora. Las docs oficiales de Mercado Pago describen credenciales de producción/API y reportes de movimientos aprobados para conciliación. Si el colegio habilita una integración oficial para su cuenta, configurá `MERCADOPAGO_ACCESS_TOKEN` y agregá el job/webhook de conciliación sin mover credenciales al cliente.

Referencias oficiales:

- [API Reference de Mercado Pago](https://www.mercadopago.com.ar/developers/es/reference)
- [Credenciales de producción](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/credentials)
- [Reporte de todas las transacciones](https://www.mercadopago.com.ar/developers/es/docs/reports/account-money/introduction)

## Uso

- `/`: registro público. Solicita nombre, apellido, WhatsApp, curso y comprobante PDF.
- `/paneladmin`: login administrativo.
- `/paneladmin/dashboard`: estadísticas y últimos registros.
- `/paneladmin/registros`: búsqueda, filtros, detalle, comprobante firmado y revisión manual.
- `/paneladmin/cursos`: agrupación por curso.
- `/paneladmin/control`: control rápido de entrada y marca de ingreso.
- `/paneladmin/ingreso`: lista simple de entradas confirmadas; permite tachar quienes ya pasaron.
- `/paneladmin/configuracion`: guía de configuración editable.

## Configuración editable

Los datos de pago y cursos están centralizados en `src/config/payment.ts`:

```ts
amount: 6000
alias: "esquiucine"
cvu: "0003100012785016558"
holder: "María José Adamoli"
```

## Google Sheets

La app sincroniza registros con `GOOGLE_SHEETS_WEBHOOK_URL`. Usá una planilla de Google Sheets con una pestaña llamada `Registros` y este Apps Script publicado como aplicación web:

Encabezados recomendados:

```text
Fecha
Código
Nombre
Apellido
WhatsApp
Curso
Importe
Estado
ID de operación
Ingresó
Fecha de ingreso
Notas
```

```js
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Registros");
    const data = JSON.parse(e.postData.contents);
    const code = data.registration_code || "";

    const row = [
      new Date(),
      code,
      data.first_name || "",
      data.last_name || "",
      data.whatsapp_phone || "",
      data.course || "",
      data.amount || "",
      data.payment_status || "",
      data.payment_operation_id || "",
      data.checked_in ? "Sí" : "No",
      data.checked_in_at || "",
      data.verification_notes || ""
    ];

    const lastRow = sheet.getLastRow();
    const codes = lastRow > 1 ? sheet.getRange(2, 2, lastRow - 1, 1).getValues().flat() : [];
    const index = codes.findIndex(function(value) { return value === code; });

    if (index >= 0) {
      sheet.getRange(index + 2, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
```

El panel tiene un botón en `/paneladmin/configuracion` para reenviar todos los registros existentes a la planilla.

Si ya ejecutaste la migración antes de agregar WhatsApp, corré este SQL una vez en Supabase SQL Editor:

```sql
alter table public.registrations add column if not exists whatsapp_phone text;
```

## WhatsApp

La app solicita WhatsApp para contacto y muestra botones manuales para abrir un chat con el código de entrada. No envía mensajes automáticos.

## Ingresos manuales

Desde `/paneladmin/dashboard` se puede cargar un ingreso manual para pagos en puerta. Estos registros se crean como `approved`, suman a la recaudación confirmada y aparecen en la lista de ingreso.

## Despliegue en Vercel

1. Subí el repositorio a GitHub.
2. Importalo en Vercel.
3. Configurá las variables de entorno.
4. Ejecutá build con `npm run build`.
5. Apuntá el dominio desde Project Settings > Domains.

## Pruebas recomendadas

1. Registrar una entrada con comprobante PDF.
2. Revisar que el comprobante quede en Storage privado.
3. Entrar al panel con el usuario de Supabase Auth.
4. Abrir el detalle y generar URL firmada del comprobante.
5. Confirmar o rechazar manualmente.
6. Confirmar que se agregue/actualice una fila en Google Sheets.
7. Buscar en Control de Entrada y marcar como ingresado.
