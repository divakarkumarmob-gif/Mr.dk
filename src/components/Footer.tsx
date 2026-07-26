export default function Footer({ onNavigate }: { onNavigate: (view: any) => void }) {
  return (
    <footer className="mt-8 p-6 text-center text-gray-500 text-xs">
      <div className="flex justify-center gap-4 mb-2">
        <button onClick={() => onNavigate('privacy-policy')} className="hover:text-white">Privacy Policy</button>
        <button onClick={() => onNavigate('terms-of-service')} className="hover:text-white">Terms of Service</button>
        <button onClick={() => onNavigate('contact')} className="hover:text-white">Contact</button>
      </div>
      <p>&copy; {new Date().getFullYear()} Neet Master. All rights reserved.</p>
    </footer>
  );
}
