import React from 'react';
import { motion } from 'motion/react';
import { Mic, FileCheck2, NotebookText, ArrowRight } from 'lucide-react';

// Static waveform bars — deliberately irregular heights so it reads as
// "a voice speaking" rather than a generic equalizer decoration.
const WAVE_HEIGHTS = [18, 34, 22, 46, 28, 58, 32, 44, 20, 38, 24, 50, 30, 20, 40];

function Waveform() {
  return (
    <div className="flex items-end justify-center gap-[3px] h-[60px]" aria-hidden="true">
      {WAVE_HEIGHTS.map((h, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-gradient-to-t from-blue-500 to-cyan-300"
          initial={{ height: 6, opacity: 0.4 }}
          animate={{ height: [6, h, 6], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 1.6 + (i % 5) * 0.15,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.06,
          }}
        />
      ))}
    </div>
  );
}

export default function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="min-h-dvh bg-[#0a0f24] text-white overflow-x-hidden">
      {/* Hero */}
      <section className="relative flex flex-col items-center text-center px-6 pt-[max(env(safe-area-inset-top,0px),20px)] pb-14">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.16),_transparent_60%)] pointer-events-none" />

        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative mt-8 text-[11px] font-semibold uppercase tracking-[0.25em] text-blue-400/70"
        >
          NeetMaster
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative mt-4 text-[2.15rem] leading-[1.15] font-bold tracking-tight max-w-sm"
        >
          AI Voice Tutor for{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
            NEET Aspirants
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative mt-4 text-sm text-gray-400 max-w-xs leading-relaxed"
        >
          Talk through Physics, Chemistry and Biology doubts out loud, then
          drill them with NCERT-aligned tests — all in one app.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative mt-10 w-full max-w-[220px]"
        >
          <Waveform />
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          onClick={onGetStarted}
          className="relative mt-10 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 text-[#0a0f24] font-bold text-sm px-7 py-3.5 active:scale-[0.97] transition-transform"
        >
          Get Started
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </motion.button>
      </section>

      {/* Features */}
      <section className="px-5 pb-6 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
              <Mic className="h-4.5 w-4.5 text-blue-400" />
            </div>
            <h2 className="font-bold text-[15px]">AI Voice Tutor</h2>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            Ask a doubt out loud and get a spoken explanation back — no typing,
            no waiting in a queue. It's built for the moment you're stuck
            mid-revision.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-cyan-500/15 flex items-center justify-center shrink-0">
              <FileCheck2 className="h-4.5 w-4.5 text-cyan-300" />
            </div>
            <h2 className="font-bold text-[15px]">NCERT-Aligned Practice Tests</h2>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            Chapter-wise and full-length mock tests mapped to the actual NEET
            syllabus, with instant scoring so you know exactly where you stand.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
              <NotebookText className="h-4.5 w-4.5 text-indigo-300" />
            </div>
            <h2 className="font-bold text-[15px]">Organized Notes</h2>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            Every topic's notes in one place, structured by subject and
            chapter, so revision doesn't mean digging through five different
            apps.
          </p>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-6 pb-12 pt-4 text-center">
        <p className="text-sm text-gray-400 mb-5">
          Free to start. No credit card needed.
        </p>
        <button
          onClick={onGetStarted}
          className="w-full max-w-sm mx-auto inline-flex items-center justify-center gap-2 rounded-full bg-white/[0.06] border border-white/15 text-white font-semibold text-sm px-7 py-3.5 active:scale-[0.97] transition-transform"
        >
          Start Preparing Now
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </section>
    </div>
  );
}
