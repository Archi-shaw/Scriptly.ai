import React from 'react'
import LoginModal from "../Login/page"; // adjust path if needed
import { useState } from 'react';
const page = () => {
    const [showLoginModal, setShowLoginModal] = useState(false);
  
  return (
    <div>
        <div className="relative z-10 flex flex-col items-center mt-36 min-h-screen px-6  text-center">
        <h1 className="text-5xl md:text-6xl z-10 font-bold text-white mb-8 leading-tight">
          <span className="bg-gradient-to-r  from-white via-purple-200 to-purple-300 bg-clip-text text-transparent">
            Generate Content,
          </span>
          <br />
          <span className="bg-gradient-to-r from-white via-purple-200 to-purple-300 bg-clip-text text-transparent">
          Copy & Images with AI
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-gray-300 max-w-5xl leading-relaxed mb-12 font-light">
        Use AI to boost your traffic and save hours of work. 
        Automatically write unique, engaging and high-quality copy or content: from long-form blog posts 
        or landing pages to digital ads in seconds.
        </p>

        <div className="flex flex-col sm:flex-row gap-6">
          <button 
          onClick={() => setShowLoginModal(true)}
          className="group relative px-8 py-4 bg-white text-black font-semibold rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl">
            <div className="flex ">
              <span> Start writing for free </span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
          </button>

          <button className="group relative px-8 py-4 bg-black text-white font-semibold rounded-xl border border-gray-700 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:border-purple-500">
            <div className="flex">
              <span>No credit card required</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
          </button>
        </div>
        <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
      </div>
    </div>
  )
}

export default page
