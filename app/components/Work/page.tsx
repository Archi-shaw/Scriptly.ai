"use client"
import React from 'react';
import LoginModal from "../Login/page"; // adjust path if needed
import { useState } from 'react';

const HowItWorks = () => {
  const [showLoginModal, setShowLoginModal] = useState(false);

  const steps = [
    {
      number: "1",
      title: "Select a writing tool",
      description: "Choose from a wide array of AI tools to write social media ads, hero sections, blog posts..."
    },
    {
      number: "2", 
      title: "Fill in your product details",
      description: "Explain with as many details as possible to the AI what you would like to write about."
    },
    {
      number: "3",
      title: "Generate AI content", 
      description: "Our highly trained AI understands your details and generate unique and human-like content in seconds."
    }
  ];

  return (
    <div className="relative bottom-64 z-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-white font-semibold text-sm uppercase tracking-wide mb-4">
            START WRITING IN 3 EASY STEPS
          </p>
          <h2 className="text-4xl md:text-5xl font-bold  bg-gradient-to-r from-white via-purple-200 to-purple-300 bg-clip-text text-transparent">
            How does it work?
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-24">
          {steps.map((step, index) => (
            <div key={index} className="bg-white rounded-2xl p-8 shadow-sm relative">
              <div className="absolute -top-4 -right-4">
                <div className="w-16 h-16 bg-[#A380E0] rounded-full flex items-center justify-center">
                  <span className="text-3xl font-bold text-[#2C1254] ">
                    {step.number}
                  </span>
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                {step.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

     </div>
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
};

export default HowItWorks;