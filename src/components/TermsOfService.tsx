import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Mail, Instagram, Globe, Sparkles } from 'lucide-react';

export default function TermsOfService({ onBack }: { onBack: () => void }) {
  return (
    <div className="fixed inset-0 bg-[#060919] z-[100] p-6 overflow-y-auto text-white selection:bg-orange-500 selection:text-white">
      <Helmet>
        <title>Terms of Service | NeetMaster AI</title>
        <meta name="description" content="Terms of Service for using the NeetMaster AI platform and study tools." />
      </Helmet>

      <button
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-sm transition-all cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to App
      </button>

      <div className="max-w-2xl mx-auto space-y-8 pb-12">
        <div className="border-b border-orange-500/30 pb-4">
          <h1 className="text-3xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500">
            Terms of Service
          </h1>
          <p className="text-xs text-gray-400">Effective Date: August 2026 • Platform: NeetMaster AI</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-orange-300">1. Acceptance of Terms</h2>
          <p className="text-sm text-gray-200 leading-relaxed">
            Welcome to <strong>NeetMaster AI</strong>. By accessing or using our application, AI voice tutor, practice tests, or study materials, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the app.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-orange-300">2. Account Responsibility & Authentication</h2>
          <p className="text-sm text-gray-200 leading-relaxed">
            NeetMaster AI uses Firebase Authentication (including Google Sign-In and Phone OTP). You are responsible for maintaining the confidentiality of your account credentials. Activities performed in Guest Mode are saved locally and may be cleared upon clearing browser/app storage.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-orange-300">3. Device Permissions & Usage</h2>
          <p className="text-sm text-gray-200 leading-relaxed">
            To provide interactive study tools, NeetMaster AI requests specific device permissions:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-gray-300">
            <li><strong>Camera Access</strong> — used to capture photos of textbook questions and doubts for instant OCR and Neural AI solving.</li>
            <li><strong>Microphone Access</strong> — used during the Live AI Voice Interface for real-time audio streaming and spoken doubt-solving. Audio is processed solely for generating spoken responses and saving transcript memory.</li>
            <li><strong>Notifications</strong> — used to send revision reminders, test analysis alerts, and study schedule prompts.</li>
            <li><strong>Storage & Files</strong> — used to cache PDFs, NCERT notes, and save study materials for offline access.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-orange-300">4. AI Tutor & Deep Accuracy Disclaimer</h2>
          <p className="text-sm text-gray-200 leading-relaxed">
            NeetMaster AI utilizes state-of-the-art AI models (including Google Gemini). While engineered for high precision on NCERT Physics, Chemistry, and Biology syllabi, AI explanations and generated solutions are intended for study assistance. Students should cross-verify key numericals and factual statements with official NCERT textbooks.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-orange-300">5. NTA Disclaimer & Educational PYQs</h2>
          <p className="text-sm text-gray-200 leading-relaxed">
            NeetMaster AI is an independent educational platform created by <strong>Mr.dk</strong>. NeetMaster AI is <strong>NOT affiliated with, endorsed by, or connected to the National Testing Agency (NTA)</strong> or any government examination authority. NTA previous year question papers (PYQs) and NCERT reference materials are utilized strictly for fair-use educational revision.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-orange-300">6. Battle Room & Peer Conduct</h2>
          <p className="text-sm text-gray-200 leading-relaxed">
            When participating in Battle Room quiz competitions or peer study features, users must maintain academic integrity. Harassment, offensive language, abusive usernames, or cheating during live tests will result in immediate account suspension.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-orange-300">7. Payments & Digital Subscriptions</h2>
          <p className="text-sm text-gray-200 leading-relaxed">
            Certain premium features or test series access may require payment. All transactions are securely encrypted. Payments for digital access are non-refundable once content or AI quota access has been granted, except as required by law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-orange-300">8. Intellectual Property & Content Protection</h2>
          <p className="text-sm text-gray-200 leading-relaxed">
            All proprietary interface designs, AI prompts, curated NCERT notes, and application logic are protected under copyright laws. Unauthorized automated scraping, decompiling, or commercial redistribution of NeetMaster AI content is strictly prohibited.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-orange-300">9. Account Deletion & Data Rights</h2>
          <p className="text-sm text-gray-200 leading-relaxed">
            Users have full rights to request deletion of their account profile, test score history, and voice transcripts. You can clear local guest data inside the Profile tab or contact us for permanent cloud account deletion.
          </p>
        </section>

        <section className="space-y-3 pt-2 border-t border-white/10">
          <h2 className="text-lg font-bold text-orange-300">10. Contact Information</h2>
          <p className="text-xs sm:text-sm text-gray-300">For inquiries, support, or privacy requests, please reach out to us:</p>
          <div className="space-y-2.5 text-xs sm:text-sm">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <Mail className="text-orange-400 h-4 w-4 shrink-0" />
              <a href="mailto:neetmaster.online@gmail.com" className="text-white hover:text-orange-300 font-mono">
                neetmaster.online@gmail.com
              </a>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <Instagram className="text-pink-400 h-4 w-4 shrink-0" />
              <a href="https://instagram.com/mr.divakar00" target="_blank" rel="noopener noreferrer" className="text-pink-300 hover:text-pink-200 font-medium">
                @mr.divakar00 (Developer DM)
              </a>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <Sparkles className="text-amber-400 h-4 w-4 shrink-0" />
              <span className="text-gray-300 font-medium">Developer & Creator: <strong>Mr.dk</strong></span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <Globe className="text-blue-400 h-4 w-4 shrink-0" />
              <a href="https://neetmaster.online" target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline">
                https://neetmaster.online
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
