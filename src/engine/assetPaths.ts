export const flagPath = (iso2: string): string => `/flags/${iso2.toLowerCase()}.svg`;

export const landmarkPath = (id: string): string => `/landmarks/${id}.jpg`;
/** Photos: landmark ids start with "lm", what-is-it ids with "wi". */
export const photoPath = (id: string): string => (id.startsWith("wi") ? `/what-is-it/${id}.jpg` : landmarkPath(id));

export const fontSlug = (family: string): string =>
  family.toLowerCase().replace(/\s+/g, "-");

export const fontFile = (family: string): string => `/fonts/${fontSlug(family)}-400.woff2`;
export const fontFileBold = (family: string): string => `/fonts/${fontSlug(family)}-700.woff2`;

export function fontFamilies(themes: { fonts: Record<string, string> }[]): string[] {
  return [...new Set(themes.flatMap((t) => Object.values(t.fonts)))].sort();
}
