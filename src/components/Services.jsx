import { ArrowRight, BookOpenText, BriefcaseBusiness, Globe2, Package, Palette, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'

const serviceItems = [
  {
    icon: Globe2,
    title: 'Website Design & Development',
    desc: 'Give your business a home online, with a website built around your goals.',
    includes: ['Business websites', 'Online stores', 'Landing pages', 'Custom web experiences'],
    cta: 'Explore Web Design',
    to: '/web-design',
  },
  {
    icon: Printer,
    title: 'Printing',
    desc: 'Professional print materials that help businesses communicate clearly and show up properly.',
    includes: ['Business cards', 'Flyers', 'Brochures', 'Posters', 'Invoices', 'Branded stationery'],
    cta: 'Explore Printing',
    to: '/services',
  },
  {
    icon: Palette,
    title: 'Event Branding',
    desc: 'Thoughtful, polished event branding designed to make your event look organized, premium, and unforgettable.',
    includes: ['Welcome boards', 'Banners', 'Table tags', 'Souvenirs', 'Stickers', 'Signage'],
    cta: 'Explore Event Branding',
    to: '/event-branding',
  },
  {
    icon: Package,
    title: 'Packaging & Labels',
    desc: 'Packaging materials that help your products look cleaner, more professional, and more ready for customers.',
    includes: ['Product labels', 'Stickers', 'Inserts', 'Thank-you cards', 'Tags', 'Packaging support prints'],
    cta: 'Explore Packaging',
    to: '/services',
  },
  {
    icon: BookOpenText,
    title: 'Books & Book Printing',
    desc: 'Reliable book production for authors, schools, training materials, workbooks, journals, manuals, and custom publications.',
    includes: ['Books', 'Booklets', 'Journals', 'Manuals', 'Workbooks', 'Educational materials'],
    cta: 'Explore Book Printing',
    to: '/book-printing',
  },
  {
    icon: BriefcaseBusiness,
    title: 'Design & Brand Support',
    desc: 'Support for customers who need help refining their print direction, visuals, or production choices.',
    includes: ['Print file setup', 'Design support', 'Brand material guidance', 'Website design', 'Visual refinement'],
    cta: 'Explore Support Services',
    to: '/services',
  },
]

function Services() {
  return (
    <section id="services" className="bg-[#F4F8FC] py-16 md:py-20">
      <div className="container-shell">
        <h2 className="max-w-3xl text-3xl font-extrabold sm:text-4xl">
          Everything your brand needs to show up better.
        </h2>
        <p className="mt-4 max-w-3xl text-[17px] text-slate-600">
          From everyday business essentials to premium event branding and book production, we help
          you print and package properly.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {serviceItems.map((service, index) => (
            <article
              key={service.title}
              className="home-grid-card group animate-fade-up border border-slate-200 bg-white p-6 shadow-md transition duration-300 hover:-translate-y-2 hover:border-yellow hover:shadow-xl"
              style={{ animationDelay: `${index * 110}ms` }}
            >
              <div className="mb-4 inline-flex bg-yellow/20 p-3 text-navy transition duration-300 group-hover:scale-110 group-hover:rotate-3">
                <service.icon size={20} />
              </div>
              <h3 className="text-xl font-bold">{service.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{service.desc}</p>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-500 marker:text-slate-400">
                {service.includes.map((item) => (
                  <li key={item} className="transition duration-300 group-hover:translate-x-1">{item}</li>
                ))}
              </ul>
              <Link
                to={service.to}
                className="mt-5 inline-flex items-center gap-2 border-l-4 border-transparent pl-3 text-sm font-semibold text-navy transition duration-300 group-hover:border-yellow group-hover:gap-3"
              >
                {service.cta} <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Services
