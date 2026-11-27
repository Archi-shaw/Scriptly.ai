"use client";
import React, { useState } from "react";
import LoginModal from "../Login/page"; 

const PricingSection = () => {
  const [isYearly, setIsYearly] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const plans = [
    {
      name: "Pro",
      price: isYearly ? 19 : 25,
      features: [
        "1 autopilot project",
        "Unlimited words",
        "Access to all tools",
        "Automatic keyword research",
        "Content scheduling",
        "Internal & external linking",
        "Rank tracking",
        "AI SEO Recommendations",
        "Automatic publishing",
        "AI & Stock images",
        "10% off backlinks",
      ],
      highlighted: false,
    },
    {
      name: "Team",
      price: isYearly ? 32 : 42,
      features: [
        "3 autopilot projects",
        "Unlimited words",
        "Access to all tools",
        "Automatic keyword research",
        "Content scheduling",
        "Internal & external linking",
        "Rank tracking",
        "AI SEO Recommendations",
        "Automatic publishing",
        "AI & Stock images",
        "15% off backlinks",
      ],
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: isYearly ? 66 : 86,
      features: [
        "10 autopilot projects",
        "Unlimited words",
        "Access to all tools",
        "Automatic keyword research",
        "Content scheduling",
        "Internal & external linking",
        "Rank tracking",
        "AI SEO Recommendations",
        "Automatic publishing",
        "AI & Stock images",
        "20% off backlinks",
      ],
      highlighted: false,
    },
  ];

  return (
    <div className="relative px-4 sm:px-6 lg:px-8  py-12 md:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center">
          <p className="text-black font-semibold text-2xl  uppercase tracking-wide mb-3">
            PRICING
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-purple-200 to-purple-300 bg-clip-text text-transparent">
            Start writing 10x faster with AI
          </h2>
          <p className="text-white text-sm sm:text-base md:text-lg max-w-2xl mx-auto mb-10">
            Our plans are simple and transparent — based on generated words on a
            rolling monthly basis.
          </p>

          <div className="flex items-center justify-center mb-12 text-sm sm:text-base">
            <span
              className={`mr-3 ${
                !isYearly ? "text-gray-900 font-semibold" : "text-gray-500"
              }`}
            >
              Monthly
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                isYearly ? "bg-[#603699]" : "bg-gray-300"
              }`}
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transform transition-transform ${
                  isYearly ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
            <span
              className={`ml-3 ${
                isYearly ? "text-gray-900 font-semibold" : "text-gray-500"
              }`}
            >
              Yearly
            </span>
            {isYearly && (
              <div className="ml-3">
                <div className="bg-blue-100 text-[#603699] px-3 py-1 rounded-full text-xs sm:text-sm font-semibold inline-block">
                  4 months free
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`bg-white rounded-2xl p-6 sm:p-8 ${
                plan.highlighted
                  ? "border-2 border-blue-600 shadow-xl scale-[1.03]"
                  : "border border-gray-200 shadow-md"
              } transition-transform`}
            >
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-bold text-gray-900">
                    ${plan.price}
                  </span>
                  <span className="text-gray-500 ml-1 text-sm">/mo</span>
                </div>
                <p className="text-gray-500 text-xs sm:text-sm mt-1">
                  billed {isYearly ? "yearly" : "monthly"}
                </p>
              </div>

              <button
                onClick={() => setShowLoginModal(true)}
                className={`w-full py-3 px-4 rounded-lg font-semibold mb-8 transition-colors ${
                  plan.highlighted
                    ? "bg-[#603699] text-white hover:bg-[#4D2C7D]"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Start free trial →
              </button>

              <ul className="space-y-3 text-left">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <svg
                      className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-gray-700 text-sm sm:text-base">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
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

export default PricingSection;
