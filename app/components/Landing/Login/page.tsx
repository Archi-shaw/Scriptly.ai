"use client";
import React, { useEffect } from "react";
import { X } from "lucide-react";
import { signIn, useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  const handleSocialLogin = async () => {
    await signIn("google", { callbackUrl: "/" }); 
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden transform transition-all scale-100 animate-in zoom-in duration-300">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>
        <div className="p-8 text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome Back!!
              </h2>
              <p className="text-gray-500 text-sm mb-8">
                Sign in or create an account to continue
              </p>
              <button
                onClick={handleSocialLogin}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5.3c1.6 0 3 .5 4.1 1.5l3-3C17.4 1.6 14.9.6 12 .6 7.6.6 3.8 3.2 2 7l3.8 3C6.6 7.5 9 5.3 12 5.3z"
                  />
                  <path
                    fill="#34A853"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.6c-.3 1.5-1.1 2.7-2.4 3.6l3.7 2.8c2.1-1.9 3.4-4.8 3.4-8.7z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.8 14.4c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2L2 7c-.6 1.2-1 2.6-1 4.1s.4 2.9 1 4.1l3.8-2.8z"
                  />
                  <path
                    fill="#4285F4"
                    d="M12 23.4c2.9 0 5.3-.9 7.1-2.6l-3.7-2.8c-1 .7-2.3 1.1-3.7 1.1-3 0-5.4-2-6.3-4.7l-3.8 2.8C4 20.9 7.6 23.4 12 23.4z"
                  />
                </svg>
                <span className="font-medium text-gray-700">
                  Continue with Google
                </span>
              </button>

              <p className="text-center text-sm text-gray-500 mt-6">
                By continuing, you agree to our{" "}
                <a href="#" className="text-purple-600 hover:underline">
                  Terms
                </a>{" "}
                &{" "}
                <a href="#" className="text-purple-600 hover:underline">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
      </div>
    </div>
  );
};

export default LoginModal;
