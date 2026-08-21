import { ScanLine } from "lucide-react";

export function StaffHomePage() {
  return (
    <section className="rounded-2xl border border-cyan-400/15 bg-white/[0.03] p-8 text-center">
      <ScanLine className="mx-auto mb-4 text-cyan-300" size={42} />
      <h1 className="text-2xl font-bold">Staff Operations</h1>
      <p className="mt-2 text-slate-400">Event selection and QR scanning tools will be available here.</p>
    </section>
  );
}
