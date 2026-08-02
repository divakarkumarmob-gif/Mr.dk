import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Mail, Instagram, Globe } from 'lucide-react';

export default function TermsOfService({ onBack }: { onBack: () => void }) {
  return (
    <div className="fixed inset-0 bg-[#0a0e1a] z-[100] p-6 overflow-y-auto text-white">
      <Helmet>
        <title>Terms of Service | Neet Master</title>
        <meta name="description" content="Terms of Service for using the Neet Master platform." />
      </Helmet>
      <button onClick={onBack} className="mb-6"><ArrowLeft /></button>
      
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold mb-6 text-[#3B82F6]">Terms of Service</h1>
        
        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">1. Introduction</h2>
          <p>Welcome to Neet Master. By accessing or using our application, you agree to comply with and be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">2. Use of Service</h2>
          <p>Neet Master is intended for personal, educational study purposes for students preparing for the NEET examination. You agree not to use the app for any illegal or unauthorized purpose. You are responsible for maintaining the confidentiality of your account credentials (including Google Sign-In access) and for all activity that occurs under your account.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">3. App Features & Permissions</h2>
          <p>To provide our services, the app may request access to the following device features. Each is used only for its stated purpose:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Camera</strong> — to let you capture and upload photos (e.g. for doubt-solving or profile pictures).</li>
            <li><strong>Microphone</strong> — used only during the Live AI Voice Interface, to stream your voice to the AI in real time for interactive doubt-solving. Audio is not recorded or stored beyond what is needed to generate a response and, where applicable, save your session transcript.</li>
            <li><strong>Push & Local Notifications</strong> — to send you study reminders, updates, and alerts. You can disable these anytime in your device settings.</li>
            <li><strong>Storage/Files</strong> — to let you view, download, or save notes, PDFs, and study material.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">4. AI-Generated Content</h2>
          <p>Neet Master uses third-party AI models (including Google Gemini) to power features such as the AI Search, doubt-solving, study plans, and the Live AI Voice Interface. AI-generated answers, explanations, and study plans are provided for educational assistance only, may occasionally be inaccurate or incomplete, and should not be treated as a substitute for verified textbooks, teachers, or official NEET/NCERT sources.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">5. Payments & Subscriptions</h2>
          <p>Certain features of Neet Master (such as premium content, tests, or study material) may require payment. All payments are processed securely using encrypted channels. We do not store your card, UPI, or bank details on our servers. Please contact us before making a payment if you have any doubts, as payments for digital content are generally non-refundable once access has been granted, except where required by law.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">6. Intellectual Property</h2>
          <p>All content, features, and functionality on Neet Master (including AI-driven study plans, practice tests, notes, and interface design) are the exclusive property of Neet Master and are protected by applicable intellectual property laws. Third-party study material, PYQs, or NCERT-based content is used for educational reference purposes only.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">7. Limitation of Liability</h2>
          <p>Neet Master is provided on an "as-is" basis. We do not guarantee that the service, AI features, or payment gateway will be error-free or uninterrupted. We are not liable for any damages resulting from your use of this application, including reliance on AI-generated content or third-party service outages.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">8. Termination</h2>
          <p>We reserve the right to terminate or suspend your account at our sole discretion, without notice, for any violation of these Terms of Service.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">9. Changes to Terms</h2>
          <p>We may update these terms from time to time to reflect new features, permissions, or legal requirements. Your continued use of the app constitutes acceptance of the new terms.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">10. Contact Information</h2>
          <p>If you have any questions, please contact us:</p>
          <div className="space-y-3 mt-3">
            <div className="flex items-center gap-3">
              <Mail className="text-[#3B82F6] h-5 w-5 flex-shrink-0" />
              <a href="mailto:neetmaster.online@gmail.com" className="text-[#3B82F6] hover:underline">neetmaster.online@gmail.com</a>
            </div>
            <div className="flex items-center gap-3">
              <Instagram className="text-[#3B82F6] h-5 w-5 flex-shrink-0" />
              <a href="https://instagram.com/neetmaster.online" target="_blank" rel="noopener noreferrer" className="text-[#3B82F6] hover:underline">@neetmaster.online</a>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="text-[#3B82F6] h-5 w-5 flex-shrink-0" />
              <a href="https://neetmaster.online" target="_blank" rel="noopener noreferrer" className="text-[#3B82F6] hover:underline">https://neetmaster.online</a>
            </div>
          </div>
        </section>

        <section className="text-sm text-gray-500 italic">
          <p>Last updated: July 2026</p>
        </section>
      </div>
    </div>
  );
}
