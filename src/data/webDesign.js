export const WEB_DESIGN_HOST = "web.bilta.com.ng";
export const WEB_DESIGN_PATH = "/web-design";

// End is exclusive: the offer includes all of 31 January in Africa/Lagos.
export const WEB_DESIGN_OFFER = {
  startsAt: "2026-11-05T00:00:00+01:00",
  endsAt: "2027-02-01T00:00:00+01:00",
  price: 220000,
};

export function isWebOfferActive(now = new Date()) {
  const time = new Date(now).getTime();
  return (
    time >= Date.parse(WEB_DESIGN_OFFER.startsAt) &&
    time < Date.parse(WEB_DESIGN_OFFER.endsAt)
  );
}

export const webPackages = [
  {
    id: "starter",
    name: "Starter",
    price: 200000,
    subtitle: "A clear introduction to your business.",
    features: [
      "Up to 3 pages",
      "Design for mobile, tablet & desktop",
      "Contact form & WhatsApp link",
      "Basic search engine setup",
      "1 round of design revisions",
      "Website handover",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: 400000,
    subtitle: "More room to tell your story and win enquiries.",
    features: [
      "Up to 5 pages",
      "Everything in Starter",
      "Editable portfolio or blog",
      "Enquiry form tailored to your business",
      "Analytics setup",
      "2 rounds of design revisions",
    ],
  },
  {
    id: "commerce",
    name: "Commerce",
    price: 600000,
    subtitle: "Turn your products into an online store.",
    features: [
      "Up to 10 pages",
      "Everything in Business",
      "Online store with up to 20 initial products",
      "Payment gateway integration",
      "Product management walkthrough",
      "3 rounds of design revisions",
    ],
  },
];

export function webPackagePrice(id, now = new Date()) {
  const pack = webPackages.find((item) => item.id === id);
  if (!pack) return null;
  return id === "business" && isWebOfferActive(now)
    ? WEB_DESIGN_OFFER.price
    : pack.price;
}

export const webProjects = [
  {
    id: "ahju",
    name: "AHJU",
    category: "Digital identity",
    url: "https://myahju.com/",
    image: "/web-design/ahju.jpg",
    description:
      "A digital business card experience that helps professionals share their identity and connect.",
  },
  {
    id: "danajet",
    name: "Danajet",
    category: "Publishing & creative services",
    url: "https://danajet.com/",
    image: "/web-design/danajet.jpg",
    description:
      "A home for book design, formatting and publishing services, with a portfolio, shop and project enquiries.",
  },
  {
    id: "hoodmap",
    name: "HoodMap",
    category: "Web application",
    url: "https://the-hood-map.vercel.app/",
    image: "/web-design/hoodmap.jpg",
    description:
      "A blockchain analytics experience for exploring token activity, wallet history and on-chain intelligence.",
  },
];
