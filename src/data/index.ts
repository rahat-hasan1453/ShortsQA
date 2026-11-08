import countriesJson from "../../data/countries.json";
import themesJson from "../../data/themes.json";
import voiceJson from "../../data/voice_lines.json";
import titlesJson from "../../data/titles.json";
import type { Country, Theme, VoiceLines } from "../engine/types";
import type { TitleBank } from "../engine/metadata";

export const countries = countriesJson as unknown as Country[];
export const themes = themesJson as unknown as Theme[];
export const flagsVoice = (voiceJson as unknown as VoiceLines[]).find((v) => v.format === "flags")!;
export const flagsTitles = (titlesJson as unknown as TitleBank[]).find((t) => t.format === "flags")!;
