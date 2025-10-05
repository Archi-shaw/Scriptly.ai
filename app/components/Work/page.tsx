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
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-black font-semibold text-sm uppercase tracking-wide mb-4">
            START WRITING IN 3 EASY STEPS
          </p>
          <h2 className="text-4xl md:text-5xl font-bold  bg-gradient-to-r from-white via-purple-200 to-purple-300 bg-clip-text text-transparent">
            How does it work?
          </h2>
        </div>

        {/* Steps */}
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

        {/* Main Content Section */}
        <div className="grid lg:grid-cols-2 gap-12 mt-16 items-center">
          {/* Left Side - Content Generator Preview */}
          <div className="bg-white rounded-2xl p-4 shadow-lg">
            <div className="bg-gray-100 rounded-xl p-6 mb-6">
              <h4 className="font-bold text-gray-900 mb-4">
                What content generators are
              </h4>
              <p className="text-gray-700 text-sm leading-relaxed mb-4">
                Content generators are a highly powerful and inexpensive resource. If you want to seriously 
                increase your sales, you'll need to consider this technology as part of your marketing plan. The 
                goal of AI content is to automate the creation of content - actions that are based on certain 
                criteria in your database without human intervention.
              </p>
              
              <h4 className="font-bold text-gray-900 mb-4">
                How the AI can help us write better and faster
              </h4>
              <p className="text-gray-700 text-sm leading-relaxed mb-4">
                AI is an incredibly powerful and free resource. If you want to seriously increase your sales and 
                profitability, you will have to consider this technology as part of your marketing plan. The AI-
                generated content's goal is to automate the content creation process entirely - perform certain 
                actions based on certain criteria in your database without human interaction.
              </p>

              <h4 className="font-bold text-gray-900 mb-4">
                The benefits of using AI in our marketing
              </h4>
              <p className="text-gray-700 text-sm leading-relaxed">
                This is a powerful, cheap, and available resource. If you want to seriously increase your sales and 
                profitability, you should consider this technology as part of your global marketing strategy. The 
                goal of AI-written content is to completely automate the content creation process—to take certain 
                actions based on certain criteria in your database without human intervention.
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              <button 
              onClick={() => setShowLoginModal(true)}
             className="bg-[#4D2C7D] text-white px-6 py-3 rounded-lg font-semibold cursor-pointer transition-colors">
                Generate
              </button>
              <button 
              onClick={() => setShowLoginModal(true)}
              className="border border-gray-300 text-gray-700 px-6 py-3 cursor-pointer  rounded-lg font-semibold hover:bg-gray-50 transition-colors">
                Write more
              </button>
            </div>
          </div>

          {/* Right Side - Long-Form Content Writer */}
          <div className='flex justify-center items-center md:items-left flex-col mt-9 md:mt-0'>
            <h2 className="text-4xl md:text-5xl  font-bold bg-gradient-to-r from-white via-purple-200 to-purple-300 bg-clip-text text-transparent mb-6">
              Long-Form AI Content Writer
            </h2>
            <p className="text-white text-lg mb-6 text-center leading-relaxed">
              Turn a short description into a 1,000+ word article with our AI-powered content writer.
              Generate any article element such as titles, intros, outlines, content, 
              or conclusions. Write unlimited SEO-optimized and plagiarism-free 
              content for your blog.
            </p>
            <button           onClick={() => setShowLoginModal(true)}
            className="bg-white text-black px-8 py-4 rounded-lg font-semibold text-lg cursor-pointer transition-colors shadow-lg">
              Get Started For Free
            </button>
          </div>
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