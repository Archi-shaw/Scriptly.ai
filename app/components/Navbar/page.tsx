// // components/Navbar.tsx
// "use client";

// import React, { useState } from "react";
// import Link from "next/link";
// import LoginModal from "../Login/page"; // adjust path if needed

// interface NavItem {
//   label: string;
//   href: string;
// }

// const Navbar: React.FC = () => {
//   const [isMenuOpen, setIsMenuOpen] = useState(false);
//   const [showLoginModal, setShowLoginModal] = useState(false);

//   const navItems: NavItem[] = [
//     { label: "How it works", href: "/" },
//     { label: "Use Cases", href: "/usecases" },
//     { label: "Features", href: "/features" },
//     { label: "Pricing", href: "/pricing" },
//   ];

//   const toggleMenu = () => {
//     setIsMenuOpen(!isMenuOpen);
//   };

//   return (
//     <div className="flex justify-center pt-6 px-4">
//       {/* ========== NAV BAR ========== */}
//       <nav className="relative z-10 backdrop-blur-md  shadow-2xl w-full">
//         <div className="flex items-center justify-between">
//           {/* Logo */}
//          <Link
//             href="/"
//             className="flex items-center space-x-2 text-2xl font-bold tracking-tight text-white hover:scale-105 transition-transform"
//           >
//             Scripty<span className="text-violet-300">.ai</span>
//           </Link>

//           {/* Desktop Navigation Links (hidden on small) */}
//           <div className="hidden lg:flex items-center space-x-8">
//             {navItems.map((item) => (
//               <Link
//                 key={item.label}
//                 href={item.href}
//                 className="text-white/80 hover:text-white px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:text-lg"
//               >
//                 {item.label}
//               </Link>
//             ))}
//           </div>

//           {/* Right‐side: Log in (always visible) + Hamburger (only on mobile) */}
//           <div className="flex items-center space-x-4">
//             {/* “Log in” button (always shown) */}
//             <button
//               onClick={() => setShowLoginModal(true)}
//               className="text-white/80 hover:text-white px-4 py-2 rounded-full text-sm font-medium transition-all duration-300"
//             >
//               Log in
//             </button>

//             {/* Mobile Menu Toggle (only on small) */}
//             <div className="lg:hidden">
//               <button
//                 onClick={toggleMenu}
//                 className="inline-flex items-center justify-center p-2 rounded-full text-white/80 hover:text-white hover:bg-purple/10 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all duration-200"
//                 aria-expanded={isMenuOpen}
//               >
//                 <span className="sr-only">Open main menu</span>
//                 {!isMenuOpen ? (
//                   <svg
//                     className="block h-6 w-6"
//                     xmlns="http://www.w3.org/2000/svg"
//                     fill="none"
//                     viewBox="0 0 24 24"
//                     stroke="currentColor"
//                     aria-hidden="true"
//                   >
//                     <path
//                       strokeLinecap="round"
//                       strokeLinejoin="round"
//                       strokeWidth="2"
//                       d="M4 6h16M4 12h16M4 18h16"
//                     />
//                   </svg>
//                 ) : (
//                   <svg
//                     className="block h-6 w-6"
//                     xmlns="http://www.w3.org/2000/svg"
//                     fill="none"
//                     viewBox="0 0 24 24"
//                     stroke="currentColor"
//                     aria-hidden="true"
//                   >
//                     <path
//                       strokeLinecap="round"
//                       strokeLinejoin="round"
//                       strokeWidth="2"
//                       d="M6 18L18 6M6 6l12 12"
//                     />
//                   </svg>
//                 )}
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* ========== MOBILE MENU (shown when hamburger is open) ========== */}
//         {isMenuOpen && (
//           <div className="lg:hidden absolute top-full left-0 right-0 mt-2">
//             <div className="bg-white/20 backdrop-blur-md border border-[#603699] rounded-2xl px-6 py-4 space-y-3 shadow-xl mx-4">
//               {navItems.map((item) => (
//                 <Link
//                   key={item.label}
//                   href={item.href}
//                   className="text-white/80 hover:text-white block px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 hover:bg-white/10"
//                   onClick={() => setIsMenuOpen(false)}
//                 >
//                   {item.label}
//                 </Link>
//               ))}

//               {/* If you still want “Log in” inside the mobile menu, it can go here */}
//               {/* 
//               <button
//                 onClick={() => {
//                   setShowLoginModal(true);
//                   setIsMenuOpen(false);
//                 }}
//                 className="text-white/80 hover:text-white block w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 hover:bg-white/10"
//               >
//                 Log in
//               </button>
//               */}
//             </div>
//           </div>
//         )}
//       </nav>

//       {/* ========== LOGIN MODAL (CENTERED) ========== */}
//       <LoginModal
//         isOpen={showLoginModal}
//         onClose={() => setShowLoginModal(false)}
//       />
//     </div>
//   );
// };

// export default Navbar;
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
    { label: "How it works", href: "/" },
    { label: "Use Cases", href: "/usecases" },
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
  ];

  return (
    <header className="w-full fixed top-0 left-0 z-50 backdrop-blur-md ">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center space-x-2 text-2xl font-bold tracking-tight text-white hover:scale-105 transition-transform"
        >
          Scripty<span className="text-violet-300">.ai</span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center space-x-8">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-white/80 hover:text-white px-3 py-2 text-sm font-medium transition"
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={() => setShowLoginModal(true)}
            className="text-white bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-full text-sm font-semibold transition"
          >
            Log in
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="lg:hidden text-white focus:outline-none"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden bg-black/60 backdrop-blur-md border-t border-white/10">
          <div className="flex flex-col items-center space-y-3 py-4">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-white/80 hover:text-white px-4 py-2 text-base"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => {
                setShowLoginModal(true);
                setIsMenuOpen(false);
              }}
              className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-full text-white font-medium"
            >
              Log in
            </button>
          </div>
        </div>
      )}

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </header>
  );
};

export default Navbar;
