import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, FileCheck2, NotebookText, ArrowRight, Sparkles, X, Mail, ShieldCheck, FileText, Send } from 'lucide-react';
import LandingHero3D from './LandingHero3D';
import TermsOfService from './TermsOfService';
import PrivacyPolicy from './PrivacyPolicy';

// Static waveform bars — deliberately irregular heights so it reads as
// "a voice speaking" rather than a generic equalizer decoration.
const WAVE_HEIGHTS = [18, 34, 22, 46, 28, 58, 32, 44, 20, 38, 24, 50, 30, 20, 40];

function Waveform() {
  return (
    <div className="flex items-end justify-center gap-[3px] h-[60px]" aria-hidden="true">
      {WAVE_HEIGHTS.map((h, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-gradient-to-t from-orange-500 to-amber-300"
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
  const [activeModal, setActiveModal] = useState<'terms' | 'privacy' | 'contact' | null>(null);

  return (
    <div className="min-h-dvh bg-[#060919] text-white overflow-x-hidden relative selection:bg-orange-500 selection:text-white pb-10">
      {/* 3D Fixed Background Scene (Desktop: Three.js Canvas | Mobile: Ambient Gradient artwork) */}
      <LandingHero3D />

      {/* Ultra-transparent Readability Vignette Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[1] bg-gradient-to-b from-black/25 via-transparent to-black/35" />

      {/* Hero Content Section */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-[max(env(safe-area-inset-top,0px),24px)] pb-14">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative mt-8 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 backdrop-blur-md shadow-lg shadow-orange-500/10"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-300">
            NeetMaster AI
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative mt-5 text-[2.25rem] sm:text-5xl leading-[1.12] font-extrabold tracking-tight max-w-lg drop-shadow-[0_4px_20px_rgba(249,115,22,0.4)]"
        >
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500">
            AI Voice Tutor for NEET Aspirants
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative mt-4 text-sm sm:text-base text-orange-200/90 font-medium max-w-sm leading-relaxed drop-shadow-[0_2px_12px_rgba(249,115,22,0.6)]"
        >
          Talk through Physics, Chemistry and Biology doubts out loud, then
          drill them with NCERT-aligned tests — all in one app.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative mt-8 w-full max-w-[220px]"
        >
          <Waveform />
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.09, y: -5 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 450, damping: 20 }}
          onClick={onGetStarted}
          className="relative mt-9 inline-flex items-center gap-2.5 rounded-full bg-white/5 hover:bg-white/12 border border-white/40 hover:border-orange-400 text-white font-extrabold text-sm sm:text-base px-8 py-3.5 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_50px_rgba(249,115,22,0.45)] cursor-pointer transition-all duration-300 group overflow-hidden"
        >
          {/* Glass Specular Reflection Highlight Sheen */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent opacity-70 pointer-events-none" />

          <span className="relative z-10 bg-clip-text text-transparent bg-gradient-to-r from-white via-orange-100 to-amber-200 group-hover:from-orange-300 group-hover:to-amber-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            Get Started Free
          </span>
          <ArrowRight className="relative z-10 h-4.5 w-4.5 text-orange-400 group-hover:translate-x-1.5 transition-transform duration-300 drop-shadow" strokeWidth={2.5} />
        </motion.button>
      </section>

      {/* Ultra-Glassy Translucent Features Section */}
      <section className="relative z-10 px-5 pb-8 space-y-4 max-w-xl mx-auto">
        <div className="rounded-2xl border border-white/20 bg-white/[0.05] hover:bg-white/[0.08] backdrop-blur-md p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:border-blue-400/40 transition-all duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-blue-500/25 flex items-center justify-center shrink-0 border border-blue-400/40 backdrop-blur-sm">
              <Mic className="h-4.5 w-4.5 text-blue-300" />
            </div>
            <h2 className="font-bold text-[15px] sm:text-base text-white drop-shadow">AI Voice Tutor</h2>
          </div>
          <p className="text-sm text-gray-200 leading-relaxed drop-shadow-sm">
            Ask a doubt out loud and get a spoken explanation back — no typing,
            no waiting in a queue. It's built for the moment you're stuck
            mid-revision.
          </p>
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/[0.05] hover:bg-white/[0.08] backdrop-blur-md p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:border-cyan-400/40 transition-all duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-cyan-500/25 flex items-center justify-center shrink-0 border border-cyan-400/40 backdrop-blur-sm">
              <FileCheck2 className="h-4.5 w-4.5 text-cyan-300" />
            </div>
            <h2 className="font-bold text-[15px] sm:text-base text-white drop-shadow">NCERT-Aligned Practice Tests</h2>
          </div>
          <p className="text-sm text-gray-200 leading-relaxed drop-shadow-sm">
            Chapter-wise and full-length mock tests mapped to the actual NEET
            syllabus, with instant scoring so you know exactly where you stand.
          </p>
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/[0.05] hover:bg-white/[0.08] backdrop-blur-md p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:border-indigo-400/40 transition-all duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/25 flex items-center justify-center shrink-0 border border-indigo-400/40 backdrop-blur-sm">
              <NotebookText className="h-4.5 w-4.5 text-indigo-300" />
            </div>
            <h2 className="font-bold text-[15px] sm:text-base text-white drop-shadow">Organized Notes</h2>
          </div>
          <p className="text-sm text-gray-200 leading-relaxed drop-shadow-sm">
            Every topic's notes in one place, structured by subject and
            chapter, so revision doesn't mean digging through five different
            apps.
          </p>
        </div>
      </section>

      {/* Closing CTA Section */}
      <section className="relative z-10 px-6 pb-6 pt-4 text-center">
        <p className="text-sm text-gray-300 mb-5 drop-shadow-sm">
          Free to start. No credit card needed.
        </p>
        <button
          onClick={onGetStarted}
          className="w-full max-w-sm mx-auto inline-flex items-center justify-center gap-2 rounded-full bg-white/10 hover:bg-white/18 border border-white/25 backdrop-blur-md text-white font-semibold text-sm px-7 py-3.5 active:scale-[0.97] transition-all cursor-pointer shadow-lg"
        >
          Start Preparing Now
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </section>

      {/* Glassy Orange - Pink - Blue Footer Section (Right below Start Preparing) */}
      <footer className="relative z-10 px-6 max-w-lg mx-auto text-center mt-2">
        <div className="rounded-2xl border border-white/20 bg-gradient-to-r from-orange-500/15 via-pink-500/15 to-blue-500/15 backdrop-blur-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] space-y-4">
          
          {/* Glassy Orange, Pink, and Blue Interactive Pill Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-xs sm:text-sm font-bold">
            {/* Orange Glass Badge - Terms & Service */}
            <button
              onClick={() => setActiveModal('terms')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-orange-500/15 hover:bg-orange-500/30 border border-orange-400/40 text-orange-200 hover:text-white backdrop-blur-md transition-all active:scale-95 cursor-pointer shadow-md shadow-orange-500/10"
            >
              <FileText className="h-3.5 w-3.5 text-orange-400" />
              Terms & Service
            </button>

            {/* Pink Glass Badge - Privacy Policy */}
            <button
              onClick={() => setActiveModal('privacy')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-pink-500/15 hover:bg-pink-500/30 border border-pink-400/40 text-pink-200 hover:text-white backdrop-blur-md transition-all active:scale-95 cursor-pointer shadow-md shadow-pink-500/10"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-pink-400" />
              Privacy Policy
            </button>

            {/* Blue Glass Badge - Contact Us */}
            <button
              onClick={() => setActiveModal('contact')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-500/15 hover:bg-blue-500/30 border border-blue-400/40 text-blue-200 hover:text-white backdrop-blur-md transition-all active:scale-95 cursor-pointer shadow-md shadow-blue-500/10"
            >
              <Mail className="h-3.5 w-3.5 text-blue-400" />
              Contact Us
            </button>
          </div>

          <div className="text-[11px] text-gray-300 font-medium tracking-wide">
            © {new Date().getFullYear()}{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-pink-400 to-blue-400 font-extrabold">
              NeetMaster AI
            </span>{' '}
            • Created by <span className="text-white font-semibold">Mr.dk</span>
          </div>
        </div>
      </footer>

      {/* Glassy Pop-up Modals for Terms, Privacy, and Contact */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-lg rounded-3xl border backdrop-blur-2xl p-6 shadow-2xl text-left max-h-[82vh] flex flex-col ${
                activeModal === 'terms'
                  ? 'border-orange-500/40 bg-gradient-to-b from-[#1a0e08]/95 via-[#0d0d1a]/95 to-[#060919]/95 shadow-orange-500/20'
                  : activeModal === 'privacy'
                  ? 'border-pink-500/40 bg-gradient-to-b from-[#1a0a14]/95 via-[#0d0d1a]/95 to-[#060919]/95 shadow-pink-500/20'
                  : 'border-blue-500/40 bg-gradient-to-b from-[#0a1220]/95 via-[#0d0d1a]/95 to-[#060919]/95 shadow-blue-500/20'
              }`}
            >
              {/* Modal Close Button */}
              <button
                onClick={() => setActiveModal(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all cursor-pointer z-20"
              >
                <X className="h-5 w-5" />
              </button>

              {activeModal === 'terms' && (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex items-center gap-2 mb-4 shrink-0 border-b border-orange-500/20 pb-3">
                    <FileText className="h-5 w-5 text-orange-400" />
                    <h3 className="text-xl font-bold text-orange-300">Terms of Service</h3>
                  </div>
                  <div className="space-y-4 text-xs sm:text-sm text-gray-200 overflow-y-auto pr-2 leading-relaxed custom-scrollbar">
                    <section>
                      <h4 className="font-semibold text-white text-sm mb-1">1. Introduction & Acceptance</h4>
                      <p className="text-gray-300">Welcome to NeetMaster AI. By accessing our platform, AI voice tutor, practice tests, or notes, you agree to be bound by these Terms of Service.</p>
                    </section>
                    <section>
                      <h4 className="font-semibold text-white text-sm mb-1">2. Account & Authentication</h4>
                      <p className="text-gray-300">We utilize Firebase Auth (Google Sign-In & Phone OTP). You are responsible for account security. Guest mode data is stored locally and cleared upon app reset.</p>
                    </section>
                    <section>
                      <h4 className="font-semibold text-white text-sm mb-1">3. App Permissions & Usage</h4>
                      <ul className="list-disc pl-4 space-y-1 text-gray-300">
                        <li><strong>Camera</strong> — to capture photos of textbook doubts for instant Neural AI OCR solving.</li>
                        <li><strong>Microphone</strong> — used solely during Live AI Voice Tutor sessions for real-time voice doubt-solving.</li>
                        <li><strong>Notifications</strong> — study schedule reminders, revision prompts, and performance updates.</li>
                        <li><strong>Storage/Files</strong> — to download and view NCERT notes, PDFs, and study materials.</li>
                      </ul>
                    </section>
                    <section>
                      <h4 className="font-semibold text-white text-sm mb-1">4. AI Tutor & NCERT Accuracy</h4>
                      <p className="text-gray-300">NeetMaster AI uses advanced AI models (including Google Gemini). Solutions are generated for study assistance and should be cross-verified with official NCERT textbooks.</p>
                    </section>
                    <section>
                      <h4 className="font-semibold text-white text-sm mb-1">5. NTA Disclaimer & PYQ Fair Use</h4>
                      <p className="text-gray-300">NeetMaster AI is an independent platform built by <strong>Mr.dk</strong> and is <strong>NOT affiliated with or endorsed by the National Testing Agency (NTA)</strong>. PYQ test items are used strictly for educational revision.</p>
                    </section>
                    <section>
                      <h4 className="font-semibold text-white text-sm mb-1">6. Battle Room & Peer Conduct</h4>
                      <p className="text-gray-300">Cheating, offensive speech, harassment, or abusive usernames in Battle Room multiplayer quizzes will lead to immediate account suspension.</p>
                    </section>
                    <section>
                      <h4 className="font-semibold text-white text-sm mb-1">7. Payments & Subscriptions</h4>
                      <p className="text-gray-300">Certain premium features require payment. Payments for digital access/AI quota are non-refundable once access is granted.</p>
                    </section>
                    <section>
                      <h4 className="font-semibold text-white text-sm mb-1">8. Content & Data Rights</h4>
                      <p className="text-gray-300">You retain full rights to request account, test score, or voice transcript deletion via the Profile tab or by emailing support.</p>
                    </section>
                    <section className="pt-2 border-t border-white/10">
                      <h4 className="font-semibold text-white text-sm mb-1">9. Official Contact Details</h4>
                      <p className="text-gray-300">Email: <a href="mailto:neetmaster.online@gmail.com" className="text-orange-400 font-mono hover:underline">neetmaster.online@gmail.com</a></p>
                      <p className="text-gray-300 mt-1">Instagram Developer DM: <a href="https://instagram.com/mr.divakar00" target="_blank" rel="noreferrer" className="text-pink-300 font-medium hover:underline">@mr.divakar00</a></p>
                      <p className="text-gray-300 mt-1">Creator & Developer: <strong>Mr.dk</strong></p>
                    </section>
                  </div>
                </div>
              )}

              {activeModal === 'privacy' && (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex items-center gap-2 mb-4 shrink-0 border-b border-pink-500/20 pb-3">
                    <ShieldCheck className="h-5 w-5 text-pink-400" />
                    <h3 className="text-xl font-bold text-pink-300">Privacy Policy</h3>
                  </div>
                  <div className="space-y-4 text-xs sm:text-sm text-gray-200 overflow-y-auto pr-2 leading-relaxed custom-scrollbar">
                    <section>
                      <h4 className="font-semibold text-white text-sm mb-1">Information We Collect</h4>
                      <ul className="list-disc pl-4 space-y-1 text-gray-300">
                        <li>Name, email, and Google Sign-In profile info.</li>
                        <li>Study progress analytics (test scores, weak areas).</li>
                        <li>Camera images uploaded for doubt-solving.</li>
                        <li>Voice audio while actively using Live AI Voice Interface.</li>
                      </ul>
                    </section>
                    <section>
                      <h4 className="font-semibold text-white text-sm mb-1">How We Use Your Data</h4>
                      <p className="text-gray-300">To personalize study plans, power AI voice tutoring, track progress analysis, and send revision reminders.</p>
                    </section>
                    <section>
                      <h4 className="font-semibold text-white text-sm mb-1">Third-Party Services</h4>
                      <p className="text-gray-300">Firebase Auth & Firestore, Google Gemini AI services are used with strict data protection measures.</p>
                    </section>
                    <section>
                      <h4 className="font-semibold text-white text-sm mb-1">Data Security</h4>
                      <p className="text-gray-300">Industry-standard encryption measures are enforced to protect your data from unauthorized access.</p>
                    </section>
                  </div>
                </div>
              )}

              {activeModal === 'contact' && (
                <div>
                  <div className="flex items-center gap-2 mb-3 border-b border-blue-500/20 pb-3">
                    <Mail className="h-5 w-5 text-blue-400" />
                    <h3 className="text-lg font-bold text-blue-300">Contact Us & Support</h3>
                  </div>
                  <div className="space-y-3 text-xs sm:text-sm text-gray-200 leading-relaxed">
                    <p className="text-gray-300">Have feedback or need assistance? Reach out to us directly:</p>
                    <div className="space-y-2 mt-3">
                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                        <Mail className="h-4 w-4 text-blue-400 shrink-0" />
                        <div>
                          <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Email Support</p>
                          <a href="mailto:neetmaster.online@gmail.com" className="text-white hover:text-blue-300 font-medium font-mono text-xs">
                            neetmaster.online@gmail.com
                          </a>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                        <Send className="h-4 w-4 text-pink-400 shrink-0" />
                        <div>
                          <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Instagram Developer DM</p>
                          <a href="https://instagram.com/mr.divakar00" target="_blank" rel="noreferrer" className="text-pink-300 hover:text-pink-200 font-medium text-xs">
                            @mr.divakar00
                          </a>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                        <Sparkles className="h-4 w-4 text-orange-400 shrink-0" />
                        <div>
                          <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Developer & Creator</p>
                          <p className="text-orange-200 font-bold text-xs">Mr.dk</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
