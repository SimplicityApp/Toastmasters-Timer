// JSON-LD builders. Each returns a plain object; layout.mjs serializes them.

export function organization(config) {
  return {
    '@type': 'Organization',
    '@id': `${config.rootOrigin}/#organization`,
    name: 'Toastmusters',
    url: config.rootOrigin,
  };
}

export function webSite(config) {
  return {
    '@type': 'WebSite',
    '@id': `${config.siteOrigin}/#website`,
    url: `${config.siteOrigin}/`,
    name: 'Table Topics Generator',
    publisher: { '@id': `${config.rootOrigin}/#organization` },
    inLanguage: 'en',
  };
}

export function webApp(config, { questionCount, categoryCount }) {
  return {
    '@type': 'WebApplication',
    '@id': `${config.siteOrigin}/#webapp`,
    name: 'Table Topics Generator',
    url: `${config.siteOrigin}/`,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript for the random draw; every question is also listed as plain text.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: `Free random Table Topics question generator for Toastmasters meetings: ${questionCount} impromptu speaking prompts in ${categoryCount} categories, with a one-click 1–2 minute timer.`,
    audience: { '@type': 'Audience', audienceType: 'Toastmasters Table Topics Masters and club members' },
    disambiguatingDescription: 'An independent tool. Not affiliated with or endorsed by Toastmasters International.',
    publisher: { '@id': `${config.rootOrigin}/#organization` },
  };
}

export function breadcrumb(config, items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${config.siteOrigin}${it.path}`,
    })),
  };
}

export function faq(entries) {
  return {
    '@type': 'FAQPage',
    mainEntity: entries.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

export function article(config, { headline, description, path, datePublished, dateModified }) {
  return {
    '@type': 'Article',
    headline,
    description,
    url: `${config.siteOrigin}${path}`,
    datePublished,
    dateModified,
    inLanguage: 'en',
    author: { '@id': `${config.rootOrigin}/#organization` },
    publisher: { '@id': `${config.rootOrigin}/#organization` },
    isPartOf: { '@id': `${config.siteOrigin}/#website` },
  };
}

export function itemList(config, path, questions) {
  return {
    '@type': 'ItemList',
    numberOfItems: questions.length,
    itemListOrder: 'https://schema.org/ItemListUnordered',
    itemListElement: questions.map((q, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: q.text,
      url: `${config.siteOrigin}${path}#${q.id}`,
    })),
  };
}

export function collectionPage(config, { name, description, path }) {
  return {
    '@type': 'CollectionPage',
    name,
    description,
    url: `${config.siteOrigin}${path}`,
    isPartOf: { '@id': `${config.siteOrigin}/#website` },
  };
}

export function webPage(config, { name, description, path, dateModified }) {
  return {
    '@type': 'WebPage',
    name,
    description,
    url: `${config.siteOrigin}${path}`,
    dateModified,
    isPartOf: { '@id': `${config.siteOrigin}/#website` },
  };
}
