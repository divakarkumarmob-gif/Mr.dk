import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Mail, Instagram, Globe } from 'lucide-react';

export default function PrivacyPolicy({ onBack }: { onBack: () => void }) {
  return (
    <div className="fixed inset-0 bg-[#0a0e1a] z-[100] p-6 overflow-y-auto text-white">
      <Helmet>
        <title>Privacy Policy | Neet Master</title>
        <meta name="description" content="Privacy Policy for Neet Master." />
      </Helmet>
      <button onClick={onBack} className="mb-6"><ArrowLeft /></button>
      
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold mb-6 text-[#3B82F6]">Privacy Policy</h1>
        
        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">Introduction</h2>
          <p>Neet Master is a comprehensive platform dedicated to helping students prepare for the NEET examination. We are committed to protecting your privacy and ensuring your personal information is handled with care and transparency.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Name and email address</li>
            <li>Google Sign-In information</li>
            <li>App usage data (test scores, progress, study analytics)</li>
            <li>Device information (device model, OS, push notification token)</li>
            <li>Photos or images you choose to capture/upload via the camera (e.g. for doubt-solving)</li>
            <li>Voice audio, only while you are actively using the Live AI Voice Interface</li>
            <li>Chat messages and transcripts from AI/doubt-solving conversations</li>
            <li>Payment confirmation details (order ID, payment status) when you make a purchase — full card/bank details are handled directly by Razorpay and are never stored on our servers</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To facilitate user login and authentication.</li>
            <li>To save and track your study progress and performance analysis.</li>
            <li>To power AI features such as doubt-solving, AI search, study plans, and the Live AI Voice Interface.</li>
            <li>To send push/local notifications such as study reminders and updates (you can turn these off in device settings).</li>
            <li>To process payments for premium features, and verify successful transactions.</li>
            <li>To improve the functionality and user experience of our app.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">Third-Party Services</h2>
          <p>We use trusted third-party services to power our application, including:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Firebase Authentication (for secure login)</li>
            <li>Firebase Firestore (for data storage)</li>
            <li>Firebase Cloud Messaging (for push notifications)</li>
            <li>Google Sign-In</li>
            <li>Google Gemini AI (for AI search, doubt-solving, and the Live AI Voice Interface)</li>
            <li>Razorpay (for secure payment processing)</li>
          </ul>
          <p className="mt-2">Each of these providers has its own privacy practices governing the data they process on our behalf.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">Data Security</h2>
          <p>Your data is securely stored and protected using industry-standard security measures to prevent unauthorized access, disclosure, or alteration.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">Children's Privacy</h2>
          <p>This app is designed for students, some of whom may be minors. We are committed to protecting children's privacy and do not knowingly collect more information than is necessary to provide the app's educational features. Parents or guardians may contact us directly if they have any concerns regarding their child's data.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">Your Rights</h2>
          <p>You have the right to access, update, or delete your account and associated data. If you wish to request data deletion, please contact us.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-white">Contact</h2>
          <p>If you have any questions or concerns, please contact us at:</p>
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
