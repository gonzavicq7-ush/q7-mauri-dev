import { NextResponse } from "next/server";

const requiredEnv = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"] as const;
const destination = process.env.MAIL_TO ?? "web@cuadrante7.com";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { ok: false, error: "Payload inválido." },
      { status: 400 },
    );
  }

  const { name, email, need, message } = body as Record<string, string>;

  if (!name || !email || !need || !message) {
    return NextResponse.json(
      { ok: false, error: "Faltan campos requeridos." },
      { status: 400 },
    );
  }

  const missing = requiredEnv.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    return NextResponse.json({
      ok: false,
      error:
        "El formulario está preparado, pero todavía faltan variables de entorno para el envío real.",
      destination,
      missing,
    });
  }

  return NextResponse.json({
    ok: true,
    mode: "placeholder",
    destination,
    message:
      "La integración SMTP quedó preparada a nivel de configuración. Falta conectar el proveedor real para habilitar el envío efectivo.",
  });
}
