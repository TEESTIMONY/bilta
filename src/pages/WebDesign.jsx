import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Globe2,
  Menu,
  MessageCircle,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { buildWhatsAppUrl } from "../utils/whatsapp";
import {
  isWebOfferActive,
  WEB_DESIGN_HOST,
  webPackagePrice,
  webPackages,
  webProjects,
} from "../data/webDesign";
import "./WebDesign.css";

const currency = (value) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
const emptyBrief = {
  name: "",
  business: "",
  email: "",
  phone: "",
  package: "business",
  goal: "",
  features: [],
  timeline: "",
  reference: "",
  notes: "",
};
const featureOptions = [
  "Business pages",
  "Online store",
  "Online payments",
  "Bookings",
  "Blog / portfolio",
  "Member accounts",
  "Something else",
];
const faqs = [
  [
    "What does the special offer include?",
    "The Business package is ₦220,000 instead of ₦400,000 through 31 January 2027 (West Africa Time). It includes the same listed Business package features. We confirm your brief and scope before work begins.",
  ],
  [
    "Are domain and hosting included?",
    "Domain registration, hosting, paid plugins and third-party subscriptions are quoted separately. Payment processors charge their own transaction fees. We explain any additional costs before you commit.",
  ],
  [
    "How long will my website take?",
    "We agree a delivery timeline after reviewing your pages, features and content. Having your logo, photographs and written content ready helps the project move faster.",
  ],
  [
    "Can I request something outside a package?",
    "Yes. Choose Custom and tell us what you need. We review your brief and calculate a quote for your requirements. There is no automatic estimate for a custom build.",
  ],
  [
    "Can you maintain the website after launch?",
    "Ongoing maintenance, new content and future features can be arranged separately. We agree the support scope and cost with you.",
  ],
];

function ProjectImage({ project, ...props }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className="web-preview-fallback">
      <Globe2 size={38} />
      <span>{project.name}</span>
      <small>{new URL(project.url).hostname}</small>
    </div>
  ) : (
    <img
      src={project.image}
      alt={`${project.name} website homepage`}
      onError={() => setFailed(true)}
      {...props}
    />
  );
}

export default function WebDesign() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [brief, setBrief] = useState(emptyBrief);
  const [ready, setReady] = useState(false);
  const [briefError, setBriefError] = useState("");
  const offerActive = isWebOfferActive(now);
  const selectedPrice = webPackagePrice(brief.package, now);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Website Design & Development | Bilta Web";
    const existingDescription = document.querySelector('meta[name="description"]');
    const description = existingDescription || document.createElement("meta");
    const previousDescription = description.getAttribute("content");
    description.setAttribute("name", "description");
    description.setAttribute("content", "Business websites, online stores and custom web experiences by Bilta. Explore our work, compare website packages and share your project brief.");
    if (!existingDescription) document.head.appendChild(description);
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => {
      document.title = previousTitle;
      if (existingDescription) {
        if (previousDescription == null) description.removeAttribute("content");
        else description.setAttribute("content", previousDescription);
      } else description.remove();
      window.clearInterval(timer);
    };
  }, []);

  function update(key, value) {
    setReady(false);
    setBriefError("");
    setBrief((current) => ({ ...current, [key]: value }));
  }

  function choosePackage(id) {
    update("package", id);
    document
      .getElementById("web-brief")
      ?.scrollIntoView({ behavior: "smooth" });
    window.setTimeout(
      () => document.getElementById("web-name")?.focus({ preventScroll: true }),
      350,
    );
  }

  const message = [
    "Hello Bilta Web, I would like to discuss a website project.",
    "",
    `Name: ${brief.name.trim()}`,
    `Business: ${brief.business.trim() || "-"}`,
    `Email: ${brief.email.trim() || "-"}`,
    `Phone: ${brief.phone.trim()}`,
    `Package: ${webPackages.find((pack) => pack.id === brief.package)?.name || "Custom"}`,
    `Package price: ${selectedPrice == null ? "Quote after brief review" : currency(selectedPrice)}`,
    ...(brief.package === "business" && offerActive
      ? ["Offer: ₦220,000 instead of ₦400,000, through 31 January 2027 WAT"]
      : []),
    `Project goal: ${brief.goal.trim()}`,
    `Features: ${brief.features.join(", ") || "To be discussed"}`,
    `Timeline: ${brief.timeline || "To be discussed"}`,
    `Reference websites: ${brief.reference.trim() || "-"}`,
    `Additional details: ${brief.notes.trim() || "-"}`,
    "",
    "Please review my brief and confirm the scope, additional costs and timeline.",
  ].join("\n");

  return (
    <div className="web-studio">
      {offerActive ? (
        <div className="web-offer-strip">
          <span>A better website. A better start.</span>
          <a href="#web-packages">
            ₦400k Business package for <strong>₦220k</strong>{" "}
            <ArrowRight size={15} />
          </a>
          <span>Ends 31 Jan 2027</span>
        </div>
      ) : null}
      <header className="web-header">
        <div className="web-shell web-header-inner">
          <a
            href="#web-top"
            className="web-wordmark"
            aria-label="Bilta Web home"
          >
            <img src="/Logo_image.png" alt="Bilta" />
            <span>
              web<span className="web-brand-dot">.</span>
            </span>
          </a>
          <nav
            aria-label="Website design navigation"
            className="web-desktop-nav"
          >
            <a href="#web-work">Our work</a>
            <a href="#web-packages">Packages</a>
            <a href="#web-process">The process</a>
            <a href="#web-faq">FAQs</a>
          </nav>
          <a
            className="web-button web-button-dark web-nav-cta"
            href="#web-brief"
          >
            Let’s build yours <ArrowUpRight size={17} />
          </a>
          <button
            type="button"
            className="web-menu-toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="web-mobile-nav"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
        {menuOpen ? (
          <nav
            id="web-mobile-nav"
            className="web-mobile-nav"
            aria-label="Mobile website design navigation"
          >
            {[
              ["Our work", "#web-work"],
              ["Packages", "#web-packages"],
              ["The process", "#web-process"],
              ["Start a project", "#web-brief"],
            ].map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)}>
                {label}
                <ArrowUpRight size={17} />
              </a>
            ))}
          </nav>
        ) : null}
      </header>

      <main id="web-top">
        <section className="web-hero web-shell">
          <div className="web-hero-copy">
            <p className="web-eyebrow">
              <span /> Websites that mean business
            </p>
            <h1>
              Your next
              <br />
              customer is
              <br />
              <span>already online.</span>
            </h1>
            <p className="web-hero-description">
              Let’s give them a reason to choose you. Thoughtful websites,
              online stores and custom web experiences, made for your business.
            </p>
            <div className="web-hero-actions">
              <a href="#web-packages" className="web-button web-button-yellow">
                Find your package <ArrowUpRight size={19} />
              </a>
              <a href="#web-work" className="web-text-link">
                See our work <ArrowDown size={17} />
              </a>
            </div>
            <div className="web-hero-note">
              <Globe2 size={18} />
              <span>Designed with purpose. Built to work on every screen.</span>
            </div>
          </div>
          <div
            className="web-hero-visual"
            aria-label="Selected website projects"
          >
            <div className="web-visual-grid" />
            <div className="web-browser web-browser-primary">
              <div className="web-browser-bar">
                <span className="web-window-dots">● ● ●</span>
                <span>myahju.com</span>
                <ArrowUpRight size={13} />
              </div>
              <ProjectImage project={webProjects[0]} fetchPriority="high" />
            </div>
            <div className="web-browser web-browser-secondary">
              <div className="web-browser-bar">
                <span className="web-window-dots">● ● ●</span>
                <span>the-hood-map.vercel.app</span>
              </div>
              <ProjectImage project={webProjects[2]} />
            </div>
            <div className="web-visual-sticker">
              <span>
                Made for your
                <br />
                next chapter.
              </span>
              <ArrowUpRight size={30} />
            </div>
            <span className="web-visual-caption">
              A few things we’ve put on the internet ↗
            </span>
          </div>
        </section>

        <div className="web-capabilities">
          <div className="web-shell">
            <span>Business websites</span>
            <span>✳</span>
            <span>E-commerce</span>
            <span>✳</span>
            <span>Landing pages</span>
            <span>✳</span>
            <span>Custom experiences</span>
          </div>
        </div>

        <section id="web-work" className="web-section web-shell">
          <div className="web-section-heading">
            <div>
              <p className="web-eyebrow">Selected work / 01</p>
              <h2>
                Good ideas.
                <br />
                Live on the internet.
              </h2>
            </div>
            <p>
              A look at websites we’ve worked on.
              <br />
              Different businesses. Different possibilities.
            </p>
          </div>
          <div className="web-project-grid">
            {webProjects.map((project, index) => (
              <a
                className="web-project"
                key={project.id}
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className={`web-project-image web-project-image-${index}`}>
                  <ProjectImage project={project} loading="lazy" />
                  <span className="web-project-visit">
                    Visit website <ArrowUpRight size={17} />
                  </span>
                </div>
                <div className="web-project-meta">
                  <h3>{project.name}</h3>
                  <span>{project.category}</span>
                </div>
                <p>{project.description}</p>
              </a>
            ))}
          </div>
        </section>

        <section id="web-packages" className="web-section web-packages-section">
          <div className="web-shell">
            <div className="web-section-heading">
              <div>
                <p className="web-eyebrow">Your starting point / 02</p>
                <h2>
                  Big plans.
                  <br />
                  Clear packages.
                </h2>
              </div>
              <p>
                Choose a starting point that suits your business.
                <br />
                We’ll confirm the details together before we build.
              </p>
            </div>
            {offerActive ? (
              <div className="web-promo-callout">
                <span className="web-promo-tag">Special offer</span>
                <p>
                  The <strong>₦400,000 Business package</strong>, yours for{" "}
                  <strong>₦220,000.</strong>
                </p>
                <span>Until 31 January 2027 · WAT</span>
              </div>
            ) : null}
            <div className="web-package-grid">
              {webPackages.map((pack, index) => (
                <article
                  key={pack.id}
                  className={`web-package ${pack.id === "business" ? "web-package-featured" : ""}`}
                >
                  <div className="web-package-top">
                    <span>
                      0{index + 1} / {pack.name}
                    </span>
                    {pack.id === "business" ? (
                      <span className="web-package-badge">
                        {offerActive ? "Limited offer" : "Business favourite"}
                      </span>
                    ) : null}
                  </div>
                  <h3>{pack.name}</h3>
                  <p className="web-package-subtitle">{pack.subtitle}</p>
                  <div className="web-price">
                    {pack.id === "business" && offerActive ? (
                      <del>{currency(pack.price)}</del>
                    ) : null}
                    <strong>{currency(webPackagePrice(pack.id, now))}</strong>
                    <span>Project price</span>
                  </div>
                  <button
                    className={`web-button ${pack.id === "business" ? "web-button-yellow" : "web-button-outline"}`}
                    onClick={() => choosePackage(pack.id)}
                  >
                    Choose {pack.name} <ArrowUpRight size={18} />
                  </button>
                  <ul>
                    {pack.features.map((feature) => (
                      <li key={feature}>
                        <Check size={16} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <div className="web-custom-package">
              <div>
                <p className="web-eyebrow">Made around your brief</p>
                <h3>Something a little more you?</h3>
                <p>
                  Custom features, a bigger vision, or a completely different
                  idea. Tell us what you have in mind. We’ll review your brief
                  and calculate your quote.
                </p>
              </div>
              <button
                onClick={() => choosePackage("custom")}
                className="web-button web-button-dark"
              >
                Build a custom brief <ArrowUpRight size={18} />
              </button>
            </div>
            <p className="web-cost-note">
              Domain, hosting, paid tools and ongoing maintenance are quoted
              separately. Payment gateway fees apply where relevant. Final scope
              and delivery dates are agreed after your brief review.
            </p>
          </div>
        </section>

        <section id="web-process" className="web-section web-shell">
          <div className="web-section-heading">
            <div>
              <p className="web-eyebrow">From hello to live / 03</p>
              <h2>
                A good website starts
                <br />
                with a conversation.
              </h2>
            </div>
            <p>
              You know your business.
              <br />
              We help turn that into a website that fits.
            </p>
          </div>
          <div className="web-process-grid">
            {[
              [
                "Tell us the idea",
                "Share your business, your audience and what you want your website to do.",
              ],
              [
                "Shape the plan",
                "We agree your pages, features, costs and timeline. Then we design and build.",
              ],
              [
                "Make it live",
                "We review the website together, make the agreed refinements and get you ready to launch.",
              ],
            ].map(([title, text], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="web-brief" className="web-section web-brief-section">
          <div className="web-shell web-brief-grid">
            <div className="web-brief-copy">
              <p className="web-eyebrow">Your next chapter / 04</p>
              <h2>
                Tell us what
                <br />
                you’re building.
              </h2>
              <p>
                Have a clear plan? Still figuring it out? Start here. Your brief
                helps us recommend the right direction.
              </p>
              <div className="web-brief-summary">
                <span>Your starting point</span>
                <strong>
                  {brief.package === "custom"
                    ? "A custom build"
                    : `${webPackages.find((pack) => pack.id === brief.package)?.name} website`}
                </strong>
                <p>
                  {selectedPrice == null
                    ? "Quote calculated after we review your brief."
                    : `${currency(selectedPrice)} · scope confirmed after brief review`}
                </p>
              </div>
              <p className="web-whatsapp-note">
                <MessageCircle size={19} /> Your brief opens in WhatsApp for you
                to review and send. No payment is taken here.
              </p>
            </div>
            <form
              className="web-brief-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!brief.name.trim() || !brief.phone.trim() || !brief.goal.trim()) {
                  setReady(false);
                  setBriefError("Please enter your name, phone number and website goal.");
                  return;
                }
                setBriefError("");
                setReady(true);
              }}
            >
              <div className="web-form-grid">
                <label htmlFor="web-name">
                  Your name *
                  <input
                    id="web-name"
                    required
                    maxLength={100}
                    autoComplete="name"
                    value={brief.name}
                    onChange={(e) => update("name", e.target.value)}
                  />
                </label>
                <label>
                  Business name
                  <input
                    maxLength={150}
                    autoComplete="organization"
                    value={brief.business}
                    onChange={(e) => update("business", e.target.value)}
                  />
                </label>
                <label>
                  Phone / WhatsApp *
                  <input
                    required
                    type="tel"
                    maxLength={30}
                    autoComplete="tel"
                    value={brief.phone}
                    onChange={(e) => update("phone", e.target.value)}
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    maxLength={160}
                    autoComplete="email"
                    value={brief.email}
                    onChange={(e) => update("email", e.target.value)}
                  />
                </label>
              </div>
              <label>
                Your package
                <select
                  aria-label="Your package"
                  value={brief.package}
                  onChange={(e) => update("package", e.target.value)}
                >
                  {webPackages.map((pack) => (
                    <option value={pack.id} key={pack.id}>
                      {pack.name} — {currency(webPackagePrice(pack.id, now))}
                    </option>
                  ))}
                  <option value="custom">
                    Custom — quote after brief review
                  </option>
                </select>
              </label>
              <label>
                What should your website do? *
                <textarea
                  required
                  rows={3}
                  maxLength={2000}
                  placeholder="Tell us about your business, your audience and your main goal."
                  value={brief.goal}
                  onChange={(e) => update("goal", e.target.value)}
                />
              </label>
              <fieldset>
                <legend>What do you have in mind?</legend>
                <div className="web-feature-options">
                  {featureOptions.map((feature) => (
                    <label key={feature}>
                      <input
                        type="checkbox"
                        checked={brief.features.includes(feature)}
                        onChange={(e) =>
                          update(
                            "features",
                            e.target.checked
                              ? [...brief.features, feature]
                              : brief.features.filter(
                                  (item) => item !== feature,
                                ),
                          )
                        }
                      />
                      <span>{feature}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="web-form-grid">
                <label>
                  Preferred timeline
                  <select
                    aria-label="Preferred timeline"
                    value={brief.timeline}
                    onChange={(e) => update("timeline", e.target.value)}
                  >
                    <option value="">Let’s discuss</option>
                    <option>Within 1 month</option>
                    <option>Within 2–3 months</option>
                    <option>I’m planning ahead</option>
                  </select>
                </label>
                <label>
                  Websites you like
                  <input
                    maxLength={500}
                    placeholder="Links for inspiration"
                    value={brief.reference}
                    onChange={(e) => update("reference", e.target.value)}
                  />
                </label>
              </div>
              <label>
                Anything else?
                <textarea
                  rows={2}
                  maxLength={1500}
                  placeholder="Content, integrations, questions or other details."
                  value={brief.notes}
                  onChange={(e) => update("notes", e.target.value)}
                />
              </label>
              <button type="submit" className="web-button web-button-yellow">
                Prepare my brief <ArrowRight size={18} />
              </button>
              {briefError ? <p role="alert">{briefError}</p> : null}
              {ready ? (
                <div role="status" className="web-brief-ready">
                  <strong>Your brief is ready.</strong>
                  <p>
                    Continue to WhatsApp, review the message and press Send to
                    share it with Bilta.
                  </p>
                  <a
                    className="web-button web-button-dark"
                    href={buildWhatsAppUrl(message)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Continue to WhatsApp <MessageCircle size={18} />
                  </a>
                </div>
              ) : null}
            </form>
          </div>
        </section>

        <section id="web-faq" className="web-section web-shell web-faq-grid">
          <div>
            <p className="web-eyebrow">A little clarity</p>
            <h2>
              Before you
              <br />
              say hello.
            </h2>
          </div>
          <div>
            {faqs
              .filter((_, index) => index !== 0 || offerActive)
              .map(([question, answer]) => (
                <details key={question}>
                  <summary>
                    {question}
                    <span>+</span>
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
          </div>
        </section>
      </main>
      <footer className="web-footer">
        <div className="web-shell">
          <div>
            <a href="#web-top" className="web-footer-logo">
              bilta web<span>.</span>
            </a>
            <p>Good websites. Real possibilities.</p>
          </div>
          <div className="web-footer-links">
            <a href="#web-work">Our work</a>
            <a href="#web-packages">Packages</a>
            <Link to="https://bilta.com.ng">
              Visit Bilta print shop <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="web-footer-bottom">
            <span>© {now.getFullYear()} Bilta. All rights reserved.</span>
            <span>{WEB_DESIGN_HOST}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
