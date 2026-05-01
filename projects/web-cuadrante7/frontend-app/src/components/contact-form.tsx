"use client";

import { useId, useState } from "react";

const interestOptions = [
  "Modernizar aplicaciones",
  "Ordenar infraestructura",
  "Integrar o automatizar procesos",
  "Evaluar una solución nueva",
];

type FormState = {
  name: string;
  email: string;
  need: string;
  message: string;
};

const initialState: FormState = {
  name: "",
  email: "",
  need: "",
  message: "",
};

export function ContactForm() {
  const formId = useId();
  const statusId = useId();
  const [form, setForm] = useState<FormState>(initialState);
  const [status, setStatus] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(
      "Formulario listo. Cuando definamos SMTP real, esta v1 podrá enviar consultas efectivas."
    );
    setForm(initialState);
  }

  return (
    <form
      id={formId}
      className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 md:p-8"
      onSubmit={handleSubmit}
      aria-describedby={status ? statusId : undefined}
    >
      <label className="grid gap-2 text-sm font-medium text-slate-200">
        Nombre
        <input
          type="text"
          autoComplete="name"
          className="input-surface"
          placeholder="Tu nombre"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-200">
        Email
        <input
          type="email"
          autoComplete="email"
          className="input-surface"
          placeholder="tu@email.com"
          required
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-200">
        Necesidad principal
        <select
          className="input-surface"
          required
          value={form.need}
          onChange={(event) => setForm({ ...form, need: event.target.value })}
        >
          <option value="" disabled>
            Seleccionar
          </option>
          {interestOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-200">
        Mensaje
        <textarea
          rows={5}
          className="input-surface"
          placeholder="Contame brevemente qué necesitás resolver"
          required
          value={form.message}
          onChange={(event) => setForm({ ...form, message: event.target.value })}
        />
      </label>

      <button
        type="submit"
        className="mt-2 inline-flex items-center justify-center rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
      >
        Enviar
      </button>

      <p className="text-sm leading-7 text-slate-400">
        Por ahora el formulario queda preparado y simplificado. Cuando se defina
        el envío real, se conecta sin rehacer la interfaz.
      </p>

      {status ? (
        <p id={statusId} className="text-sm leading-7 text-cyan-200" aria-live="polite">
          {status}
        </p>
      ) : null}
    </form>
  );
}
