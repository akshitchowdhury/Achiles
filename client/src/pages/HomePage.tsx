import { useState } from 'react'

function HomePage() {
  const [count, setCount] = useState(0)

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <h1 className="text-4xl font-semibold tracking-tight">Achiles</h1>
      <p className="text-slate-500 dark:text-slate-400">
        Vite + React + TypeScript + Tailwind
      </p>
      <button
        type="button"
        onClick={() => setCount((c) => c + 1)}
        className="rounded-md bg-purple-600 px-4 py-2 font-medium text-white transition hover:bg-purple-700"
      >
        Count is {count}
      </button>
    </div>
  )
}

export default HomePage
