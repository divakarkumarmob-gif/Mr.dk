import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Mail, Instagram, MapPin, Globe } from 'lucide-react';

export default function ContactPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="fixed inset-0 bg-[#0a0e1a] z-[100] p-6 overflow-y-auto text-white">
      <Helmet>
        <title>Contact Us | Neet Master Support & Information</title>
        <meta name="description" content="Get in touch with Neet Master for support, inquiries, or feedback. We are here to help you on your NEET preparation journey." />
      </Helmet>
      
      <button onClick={onBack} className="mb-6"><ArrowLeft /></button>
      
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold mb-6 text-[#3B82F6]">Contact Us</h1>
        
        <p className="text-gray-300">
          Have questions, suggestions, or need support? We'd love to hear from you. Reach out to the Neet Master team through any of the channels below.
        </p>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Mail className="text-[#3B82F6] h-6 w-6" />
            <div>
              <h3 className="font-semibold text-white">Email</h3>
              <a href="mailto:shashikumarmob@gmail.com" className="text-gray-400 hover:text-[#3B82F6]">shashikumarmob@gmail.com</a>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Instagram className="text-[#3B82F6] h-6 w-6" />
            <div>
              <h3 className="font-semibold text-white">Instagram</h3>
              <a href="https://instagram.com/mr.divakar00" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#3B82F6]">@mr.divakar00</a>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <MapPin className="text-[#3B82F6] h-6 w-6" />
            <div>
              <h3 className="font-semibold text-white">Address</h3>
              <address className="text-gray-400 not-italic">
                Jamui, Bihar - 811315, India
              </address>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Globe className="text-[#3B82F6] h-6 w-6" />
            <div>
              <h3 className="font-semibold text-white">Website</h3>
              <a href="https://neetmaster.online" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#3B82F6]">https://neetmaster.online</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
