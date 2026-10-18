import Link from 'next/link';

const challenges = [
  {
    icon: '⌘',
    category: 'PROGRAMMING',
    title: 'Coding Foundations',
    description: 'Build your programming logic one challenge at a time.',
    level: 'Beginner',
    xp: 100,
    color: 'from-violet-500/20 to-indigo-500/5',
  },
  {
    icon: '∑',
    category: 'MATHEMATICS',
    title: 'Maths Made Simple',
    description: 'Strengthen your concepts through quick practice.',
    level: 'Beginner',
    xp: 80,
    color: 'from-sky-500/20 to-cyan-500/5',
  },
  {
    icon: '⚗',
    category: 'CHEMISTRY',
    title: 'Chemistry Lab',
    description: 'Test your understanding of essential chemistry.',
    level: 'Beginner',
    xp: 80,
    color: 'from-emerald-500/20 to-teal-500/5',
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#090b10] text-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400 font-black text-xl text-black">
            L
          </span>
          <span className="text-xl font-bold tracking-tight">
            Learn<span className="text-emerald-400">Quest</span>
          </span>
        </Link>

        <div className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
          <Link href="/challenges" className="transition hover:text-white">
            Challenges
          </Link>
          <Link href="/leaderboard" className="transition hover:text-white">
            Leaderboard
          </Link>
          <Link href="/dashboard" className="transition hover:text-white">
            Dashboard
          </Link>
        </div>

        <Link
          href="/auth"
          className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-300"
        >
          Get started →
        </Link>
      </nav>

      <section className="relative overflow-hidden border-y border-zinc-800/70">
        <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-400/10 blur-[120px]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-xs font-medium text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              YOUR LEARNING JOURNEY STARTS HERE
            </div>

            <h1 className="max-w-2xl text-5xl font-bold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
              Learn smarter.
              <br />
              Play harder.
              <br />
              <span className="text-emerald-400">Level up.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
              Turn everyday learning into a challenge worth completing.
              Practice coding, mathematics, and chemistry, earn XP, and
              track your progress as you grow.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/challenges"
                className="rounded-xl bg-emerald-400 px-6 py-3.5 font-semibold text-black transition hover:-translate-y-0.5 hover:bg-emerald-300"
              >
                Explore challenges ↗
              </Link>
              <Link
                href="/dashboard"
                className="rounded-xl border border-zinc-700 px-6 py-3.5 font-semibold text-white transition hover:bg-zinc-900"
              >
                My dashboard
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-zinc-500">
              <span>✓ Learn at your pace</span>
              <span>✓ Earn experience points</span>
              <span>✓ Track your growth</span>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="rounded-3xl border border-zinc-800 bg-[#10141c] p-6 shadow-2xl shadow-black/30 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">YOUR LEARNING SPACE</p>
                  <h2 className="mt-1 text-xl font-semibold">Progress overview</h2>
                </div>
                <span className="rounded-xl bg-emerald-400/10 p-3 text-xl text-emerald-300">
                  ✦
                </span>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <p className="text-sm text-zinc-400">Experience</p>
                  <p className="mt-2 text-3xl font-bold">XP</p>
                  <p className="mt-1 text-xs text-zinc-500">Earn as you learn</p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <p className="text-sm text-zinc-400">Daily streak</p>
                  <p className="mt-2 text-3xl font-bold">🔥</p>
                  <p className="mt-1 text-xs text-zinc-500">Build a habit</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-zinc-800 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Your next achievement</p>
                  <span className="text-xl">🏆</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Complete your first challenge and start building your
                  learning streak.
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full w-1/4 rounded-full bg-emerald-400" />
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Every challenge is a step forward.
                </p>
              </div>

              <Link
                href="/challenges"
                className="mt-5 flex w-full items-center justify-center rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold transition hover:bg-zinc-700"
              >
                Find your next challenge →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-emerald-400">
              LEARN BY DOING
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Choose your challenge.
            </h2>
            <p className="mt-3 max-w-xl text-zinc-400">
              Small steps. Real practice. Better understanding.
            </p>
          </div>
          <Link
            href="/challenges"
            className="w-fit text-sm font-semibold text-emerald-300 hover:text-emerald-200"
          >
            View all challenges →
          </Link>
        </div>

        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {challenges.map((challenge) => (
            <article
              key={challenge.title}
              className="group overflow-hidden rounded-2xl border border-zinc-800 bg-[#10141c] transition duration-300 hover:-translate-y-1 hover:border-zinc-600"
            >
              <div className={`bg-gradient-to-br ${challenge.color} p-6`}>
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-2xl">
                    {challenge.icon}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-300">
                    {challenge.level}
                  </span>
                </div>
                <p className="mt-7 text-xs font-semibold tracking-[0.18em] text-zinc-400">
                  {challenge.category}
                </p>
                <h3 className="mt-2 text-xl font-semibold">
                  {challenge.title}
                </h3>
                <p className="mt-3 min-h-12 text-sm leading-6 text-zinc-400">
                  {challenge.description}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
                <span className="text-sm font-medium text-emerald-300">
                  +{challenge.xp} XP potential
                </span>
                <Link
                  href="/challenges"
                  className="text-sm font-semibold text-white transition group-hover:text-emerald-300"
                >
                  Explore →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              number: '01',
              title: 'Practice consistently',
              text: 'Build knowledge through short, focused learning sessions.',
            },
            {
              number: '02',
              title: 'Earn experience',
              text: 'Complete challenges and work toward your next level.',
            },
            {
              number: '03',
              title: 'Track your progress',
              text: 'Review your achievements and keep improving.',
            },
          ].map((item) => (
            <div
              key={item.number}
              className="rounded-2xl border border-zinc-800 p-6"
            >
              <p className="font-mono text-sm text-emerald-400">
                / {item.number}
              </p>
              <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            <span className="font-semibold text-white">LearnQuest</span>
            {' '}· Learning that moves you forward.
          </p>
          <div className="flex gap-5">
            <Link href="/challenges" className="hover:text-white">Challenges</Link>
            <Link href="/leaderboard" className="hover:text-white">Leaderboard</Link>
            <Link href="/auth" className="hover:text-white">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
