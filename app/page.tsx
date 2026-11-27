import Navbar from "@/app/components/Landing/Navbar";
import Hero from "@/app/components/Landing/Hero";
import Work from "@/app/components/Landing/Work";
import Long from "@/app/components/Landing/Long";
import Feature from "@/app/components/Landing/Feature";
import TemplateShowcase from "@/app/components/Landing/TemplateShowcase";
import Pricing from "@/app/components/Landing/Pricing";
import FAQ from "@/app/components/Landing/FAQ";
import Footer from "@/app/components/Landing/Footer";
import LandingBackground from "@/app/components/Landing/LandingBackground";

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-clip text-white">
      <LandingBackground />
      <Navbar />
      <main>
        <Hero />
        <section id="works" className="scroll-mt-20 px-4 py-20 sm:px-6">
          <Work />
        </section>
        <section className="px-4 py-20 sm:px-6">
          <Long />
        </section>
        <section id="features" className="scroll-mt-20 px-4 py-20 sm:px-6">
          <Feature />
        </section>
        <section id="templates" className="scroll-mt-20 px-4 py-20 sm:px-6">
          <TemplateShowcase />
        </section>
        <section id="pricing" className="scroll-mt-20 px-4 py-20 sm:px-6">
          <Pricing />
        </section>
        <section id="faq" className="scroll-mt-20 px-4 py-20 sm:px-6">
          <FAQ />
        </section>
      </main>
      <Footer />
    </div>
  );
}
