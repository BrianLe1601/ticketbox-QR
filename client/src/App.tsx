
function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-lg">
        <span className="text-sm font-semibold uppercase tracking-wider text-blue-600">
          TicketBox QR
        </span>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
          Hệ thống quản lý vé và check-in sự kiện
        </h1>

        <p className="mt-4 leading-7 text-slate-600">
          React, TypeScript, Vite và Tailwind CSS đã được cài đặt thành công.
        </p>

        <button
          type="button"
          className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          Bắt đầu dự án
        </button>
      </section>
    </main>
  );
}

export default App
