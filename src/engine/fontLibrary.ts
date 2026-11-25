/** Fonts you can pick in the Style panel in addition to the ones the templates use. Each needs `@fontsource/<slug>` installed; `npm run copy:fonts` copies the files to public/fonts. */
export type FontGroup = "Display" | "Script" | "Handwritten" | "Sans" | "Serif" | "Mono";

const list = (group: FontGroup, names: string[]): [string, FontGroup][] => names.map((n) => [n, group]);

export const EXTRA_FONT_GROUPS: Record<string, FontGroup> = Object.fromEntries([
  ...list("Display", ["Bungee", "Bungee Inline", "Bowlby One", "Titan One", "Paytone One", "Passion One", "Sigmar One", "Knewave", "Slackey", "Rammetto One", "Concert One", "Modak", "Fredericka the Great", "Black Ops One", "Russo One", "Staatliches", "Abril Fatface", "Rubik Mono One", "Ultra", "Fugaz One", "Londrina Solid", "Cherry Bomb One", "Dela Gothic One", "Rye", "Creepster", "Special Elite", "Chango", "Coiny", "Galindo", "Gorditas", "Jua", "Kavoon", "Mochiy Pop One", "Patua One", "Spicy Rice", "Sniglet", "Boogaloo", "Carter One", "Changa One", "Bevan", "Shrikhand"]),
  ...list("Script", ["Lobster", "Lobster Two", "Pacifico", "Dancing Script", "Satisfy", "Yellowtail", "Sacramento"]),
  ...list("Handwritten", ["Caveat", "Patrick Hand", "Shadows Into Light", "Amatic SC", "Gochi Hand", "Indie Flower", "Architects Daughter", "Covered By Your Grace", "Rock Salt", "Reenie Beanie"]),
  ...list("Sans", ["Oswald", "Roboto", "Open Sans", "Rubik", "Work Sans", "Barlow", "Barlow Condensed", "Mulish", "Kanit", "Teko", "Saira", "Noto Sans", "Ubuntu", "Josefin Sans", "Dosis", "Cabin", "Titillium Web"]),
  ...list("Serif", ["Bree Serif", "Merriweather", "Lora", "PT Serif", "Crimson Text", "Libre Baskerville", "Cormorant Garamond", "DM Serif Display", "Bitter", "Roboto Slab", "Zilla Slab"]),
  ...list("Mono", ["Space Mono", "IBM Plex Mono", "Roboto Mono", "Fira Code", "Source Code Pro"]),
]);
export const EXTRA_FONTS: string[] = Object.keys(EXTRA_FONT_GROUPS);
