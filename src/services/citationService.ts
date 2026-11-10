import { ScientificProduct } from '../types';

export type CitationStyle = 'APA 7' | 'IEEE' | 'Vancouver';

function cleanAuthor(name: string) {
  return name
    .replace(/^(?:Dr\.?|Dra\.?|MSc\.?|PhD\.?|Ing\.?|Mag\.?|Ph\.?D\.?)\s+/i, '')
    .replace(/\s+(?:Ph\.?D\.?|M\.?Sc\.?|B\.?Sc\.?)$/i, '')
    .trim();
}

function authorParts(name: string) {
  const tokens = cleanAuthor(name).split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return { surname: tokens[0] || '', given: [] as string[] };
  const surnameCount = tokens.length >= 3 ? 2 : 1;
  return {
    surname: tokens.slice(-surnameCount).join(' '),
    given: tokens.slice(0, -surnameCount),
  };
}

function initials(given: string[]) {
  return given.map((part) => `${part.charAt(0).toLocaleUpperCase('es')}.`).join(' ');
}

function apaAuthor(name: string) {
  const parts = authorParts(name);
  return parts.given.length ? `${parts.surname}, ${initials(parts.given)}` : parts.surname;
}

function ieeeAuthor(name: string) {
  const parts = authorParts(name);
  return `${initials(parts.given)}${parts.given.length ? ' ' : ''}${parts.surname}`;
}

function joinAuthors(authors: string[], style: CitationStyle) {
  const formatted = authors.map((author) => style === 'IEEE' ? ieeeAuthor(author) : apaAuthor(author));
  if (formatted.length < 2) return formatted[0] || 'Autor no indicado';
  if (style === 'Vancouver') return formatted.join(', ');
  if (formatted.length === 2) return `${formatted[0]} ${style === 'APA 7' ? '&' : 'and'} ${formatted[1]}`;
  const precedingAuthors = formatted.slice(0, -1).join(', ');
  return style === 'APA 7'
    ? `${precedingAuthors}, & ${formatted.at(-1)}`
    : `${precedingAuthors} and ${formatted.at(-1)}`;
}

export function formatProductCitation(product: ScientificProduct, style: CitationStyle): string {
  const authors = product.authors.length ? product.authors : product.projectParticipants || [];
  const venue = product.venue || product.fundingVenue;
  const doi = product.doi?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  const doiLink = doi ? `https://doi.org/${doi}` : '';
  const isProject = product.type === 'proyecto';

  if (style === 'APA 7') {
    const source = isProject
      ? `${product.title} [Proyecto de investigación].${venue ? ` ${venue}.` : ''}`
      : `${product.title}.${venue ? ` ${venue}${product.volumeIssue ? `, ${product.volumeIssue}` : ''}.` : ''}`;
    return `${joinAuthors(authors, style)} (${product.year}). ${source}${doiLink ? ` ${doiLink}` : ''}`.trim();
  }

  if (style === 'IEEE') {
    const source = isProject
      ? `“${product.title},” proyecto de investigación${venue ? `, ${venue}` : ''}`
      : `“${product.title},”${venue ? ` ${venue}${product.volumeIssue ? `, ${product.volumeIssue}` : ''}` : ''}`;
    return `${joinAuthors(authors, style)}, ${source}, ${product.year}${doiLink ? `, doi: ${doi}` : ''}.`;
  }

  const source = isProject
    ? `${product.title} [proyecto de investigación]${venue ? `. ${venue}` : ''}`
    : `${product.title}.${venue ? ` ${venue}${product.volumeIssue ? `; ${product.volumeIssue}` : ''}` : ''}`;
  return `${authors.map((author) => {
    const parts = authorParts(author);
    return `${parts.surname} ${parts.given.map((part) => part.charAt(0).toLocaleUpperCase('es')).join('')}`;
  }).join(', ') || 'Autor no indicado'}. ${source}. ${product.year}${doiLink ? `. doi: ${doi}` : ''}.`;
}
