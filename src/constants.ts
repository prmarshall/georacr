export const TILESET: Record<string, string> = {
  dingoGap:
    "https://raw.githubusercontent.com/NASA-AMMOS/3DTilesSampleData/master/msl-dingo-gap/0528_0260184_to_s64o256_colorize/0528_0260184_to_s64o256_colorize/0528_0260184_to_s64o256_colorize_tileset.json",
} as const;

export interface SkyboxColors {
  horizon: string;
  zenith: string;
  ground: string;
}

export const SKYBOXES: Record<string, SkyboxColors> = {
  dingoGap: {
    horizon: "#c8b898",
    zenith: "#4a6d8c",
    ground: "#a89070",
  },
} as const;
