import { useEffect } from 'react'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Intro from '../components/Intro'
import Services from '../components/Services'
import PopularProducts from '../components/PopularProducts'
import WhyBilta from '../components/WhyBilta'
import Solutions from '../components/Solutions'
import HowItWorks from '../components/HowItWorks'
import Mission from '../components/Mission'
import FinalCTA from '../components/FinalCTA'
import Footer from '../components/Footer'

function Home() {
  useEffect(() => {
    const nodes = document.querySelectorAll('[data-home-reveal]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.16, rootMargin: '0px 0px -48px 0px' }
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <div className="home-section-shell" data-home-reveal style={{ transitionDelay: '80ms' }}>
          <Intro />
        </div>
        <div className="home-section-shell" data-home-reveal style={{ transitionDelay: '120ms' }}>
          <Services />
        </div>
        <div className="home-section-shell" data-home-reveal style={{ transitionDelay: '130ms' }}>
          <PopularProducts />
        </div>
        <div className="home-section-shell" data-home-reveal style={{ transitionDelay: '140ms' }}>
          <WhyBilta />
        </div>
        <div className="home-section-shell" data-home-reveal style={{ transitionDelay: '160ms' }}>
          <Solutions />
        </div>
        <div className="home-section-shell" data-home-reveal style={{ transitionDelay: '180ms' }}>
          <HowItWorks />
        </div>
        <div className="home-section-shell" data-home-reveal style={{ transitionDelay: '200ms' }}>
          <Mission />
        </div>
        <div className="home-section-shell" data-home-reveal style={{ transitionDelay: '220ms' }}>
          <FinalCTA />
        </div>
      </main>
      <Footer />
    </>
  )
}

export default Home
