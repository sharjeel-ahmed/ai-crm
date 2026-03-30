import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Building2,
  CheckCircle2,
  ChevronRight,
  Inbox,
  LineChart,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

const pillars = [
  {
    icon: Inbox,
    title: 'Email In. CRM Out.',
    copy: 'Sync Gmail, extract deals and contacts, and keep the pipeline current without manual data entry.',
  },
  {
    icon: BrainCircuit,
    title: 'AI That Works the Queue',
    copy: 'Approve, auto-approve, and route suggestions from real conversations instead of filling forms after the fact.',
  },
  {
    icon: LineChart,
    title: 'Pipeline With Signal',
    copy: 'Ownership, stage movement, and sentiment reflect what customers are actually saying in email.',
  },
];

const workflow = [
  'Connect team inboxes and personal sales accounts.',
  'Let AI read only CRM-relevant threads and ignore noise.',
  'Create deals, contacts, activities, and stage moves from live email context.',
  'Give leadership a real-time pipeline without spreadsheet cleanup.',
];

const highlights = [
  'AI-powered email extraction',
  'Deal ownership from actual rep-customer interaction',
  'Sentiment from conversation context',
  'Role-based CRM for admin, manager, and sales rep teams',
];

const metrics = [
  { value: '5 min', label: 'to first synced inbox' },
  { value: '0 copy/paste', label: 'from email into CRM' },
  { value: '1 view', label: 'for pipeline, contacts, and activity' },
];

export default function MarketingPage() {
  usePageTitle('Welcome');
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.18),_transparent_28%),radial-gradient(circle_at_75%_18%,_rgba(56,189,248,0.18),_transparent_24%),linear-gradient(135deg,_#0c0a09_0%,_#1c1917_45%,_#0f172a_100%)]" />
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-300/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/10 bg-stone-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-rose-400 text-stone-950 shadow-lg shadow-rose-500/20">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">Pazo CRM</div>
              <div className="text-xs uppercase tracking-[0.28em] text-stone-400">AI Email Revenue OS</div>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-stone-300 md:flex">
            <a href="#product" className="hover:text-white">Product</a>
            <a href="#workflow" className="hover:text-white">Workflow</a>
            <a href="#why" className="hover:text-white">Why Pazo</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-stone-200 transition hover:border-white/30 hover:bg-white/5">
              Log In
            </Link>
            <a href="#cta" className="rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-white">
              Book a Demo
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-14 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-24">
          <div className="relative">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-amber-200">
              <Bot size={14} />
              Built for B2B sales teams living in email
            </div>

            <h1 className="max-w-4xl font-serif text-5xl leading-none tracking-tight text-white sm:text-6xl lg:text-7xl">
              Turn inbox chaos into a live, <span className="text-amber-300">sellable pipeline</span>.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-300">
              Pazo CRM captures real customer conversations, creates pipeline movement from email activity,
              and gives teams a CRM that stays updated without admin drag.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a href="#cta" className="inline-flex items-center gap-2 rounded-full bg-amber-300 px-6 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-200">
                See the Product
                <ArrowRight size={16} />
              </a>
              <Link to="/login" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-stone-100 transition hover:border-white/30 hover:bg-white/5">
                Open CRM
                <ChevronRight size={16} />
              </Link>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                  <div className="text-3xl font-semibold text-white">{metric.value}</div>
                  <div className="mt-2 text-sm text-stone-400">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-sky-400/20 via-transparent to-rose-400/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/8 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-sm uppercase tracking-[0.24em] text-stone-400">Live pipeline intelligence</div>
                  <div className="mt-1 text-xl font-semibold text-white">Pazo &lt;&gt; Decorpot</div>
                </div>
                <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-300">
                  Positive sentiment
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-stone-950/55 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-white">Inbound reply detected</span>
                    <span className="text-stone-400">2 min ago</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-300">
                    “This looks good. Let&apos;s schedule the pilot rollout next week.”
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <Users size={16} className="text-sky-300" />
                      Auto-assigned owner
                    </div>
                    <div className="mt-3 text-2xl font-semibold text-stone-100">Aisha Khan</div>
                    <div className="text-sm text-stone-400">Matched from rep-customer thread</div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <Building2 size={16} className="text-amber-300" />
                      Stage progression
                    </div>
                    <div className="mt-3 text-2xl font-semibold text-stone-100">Proposal</div>
                    <div className="text-sm text-stone-400">Moved from Qualified by AI evidence</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-sky-400/10 to-rose-400/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Mail size={16} className="text-rose-300" />
                    AI extraction summary
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-stone-200">
                    <li className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 text-emerald-300" /> Contact created from signature and thread context</li>
                    <li className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 text-emerald-300" /> Deal value detected from proposal language</li>
                    <li className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 text-emerald-300" /> Activity logged from the actual email timeline</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          <div className="mb-8 max-w-2xl">
            <div className="text-sm uppercase tracking-[0.24em] text-rose-300">What makes it different</div>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
              A CRM designed around conversation flow, not manual admin.
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div key={pillar.title} className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900/70 text-amber-300">
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold text-white">{pillar.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-stone-300">{pillar.copy}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="workflow" className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
          <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/6 to-white/3 p-8">
            <div className="text-sm uppercase tracking-[0.24em] text-sky-300">Workflow</div>
            <h2 className="mt-3 text-3xl font-semibold text-white">From inbox to pipeline in four moves.</h2>
            <div className="mt-8 space-y-4">
              {workflow.map((step, index) => (
                <div key={step} className="flex gap-4 rounded-2xl border border-white/10 bg-stone-950/35 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-300 text-sm font-semibold text-stone-950">
                    {index + 1}
                  </div>
                  <p className="pt-1 text-sm leading-7 text-stone-200">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-[2rem] border border-white/10 bg-stone-900/60 p-6">
              <ShieldCheck className="text-emerald-300" size={24} />
              <h3 className="mt-4 text-xl font-semibold text-white">Noise stays out</h3>
              <p className="mt-2 text-sm leading-7 text-stone-300">
                Ignore list support, newsletter detection, and admin controls keep garbage out of the CRM and out of the AI budget.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-stone-900/60 p-6">
              <Users className="text-sky-300" size={24} />
              <h3 className="mt-4 text-xl font-semibold text-white">Ownership stays accurate</h3>
              <p className="mt-2 text-sm leading-7 text-stone-300">
                Deals can be assigned from who is actually interacting with the customer, not whoever cleaned up the data later.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-stone-900/60 p-6 sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {highlights.map((item) => (
                  <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-stone-200">
                    {item}
                  </span>
                ))}
              </div>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-stone-300">
                Built for teams that sell through Gmail, demos, proposals, pilots, and follow-ups, where the real CRM system of record is usually buried in inbox history.
              </p>
            </div>
          </div>
        </section>

        <section id="why" className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
          <div className="rounded-[2.25rem] border border-white/10 bg-[linear-gradient(140deg,rgba(251,191,36,0.14),rgba(244,114,182,0.14),rgba(56,189,248,0.12))] p-8 lg:p-10">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="text-sm uppercase tracking-[0.24em] text-stone-200/80">Why revenue teams switch</div>
                <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
                  Your CRM should reflect customer momentum, not rep memory.
                </h2>
              </div>

              <div className="space-y-4 text-sm leading-7 text-stone-100/90">
                <p>
                  Pazo CRM turns email into structured sales execution. Contacts, companies, deals,
                  activities, ownership, and sentiment all emerge from the same thread your team is already working.
                </p>
                <p>
                  That means fewer stale deals, fewer “I forgot to update the CRM” excuses, and a cleaner view of what is actually moving.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="cta" className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <div className="rounded-[2.5rem] border border-white/10 bg-stone-100 px-8 py-12 text-stone-950 shadow-2xl shadow-black/20 lg:px-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="text-sm uppercase tracking-[0.24em] text-stone-500">Ready to see it live?</div>
                <h2 className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-stone-950 sm:text-5xl">
                  Market faster, follow up smarter, and keep the pipeline honest.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-stone-700">
                  Give your sales team a CRM that listens to the inbox, structures the signal, and surfaces the next move.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link to="/login" className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-stone-800">
                  Launch CRM
                  <ArrowRight size={16} />
                </Link>
                <a href="mailto:hello@pazo.com" className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-white">
                  Request Demo
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
