"use client";

import React, { useState } from "react";
import Link from "next/link";
import LoginModal from "../Login/page";

interface NavItem {
  label: string;
  href: string;
}

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const navItems: NavItem[] = [
    { label: "How it works", href: "#works" },
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className="flex justify-center pt-6 px-4">
      <nav className="relative z-10  w-full">
        <div className="flex items-center justify-between">
         <Link
            href="/"
            className="flex items-center space-x-2 text-2xl font-bold tracking-tight text-white hover:scale-110 transition-transform"
          >
            Scripty<span className="text-violet-300">.ai</span>
          </Link>

          <div className="hidden lg:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-white/80 hover:text-white px-4 py-2 rounded-full text-sm font-medium hover:scale-105 transition-transform"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowLoginModal(true)}
              className="text-white text-sm  duration-300 bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-full hover:scale-105 transition-transform ont-medium"
            >
              Log in
            </button>

            <div className="lg:hidden">
              <button
                onClick={toggleMenu}
                className="inline-flex items-center justify-center p-2 rounded-full text-white/80 hover:text-white hover:bg-purple/10 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all duration-200"
                aria-expanded={isMenuOpen}
              >
                <span className="sr-only">Open main menu</span>
                {!isMenuOpen ? (
                  <svg
                    className="block h-6 w-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                ) : (
                  <svg
                    className="block h-6 w-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className=" z-100 lg:hidden  top-full left-0 right-0 mt-2">
            <div className="bg-black border border-[#603699] rounded-2xl px-6 py-4 space-y-3 shadow-xl mx-4">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-white/80 hover:text-white block px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 hover:bg-white/10"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
};

export default Navbar;
