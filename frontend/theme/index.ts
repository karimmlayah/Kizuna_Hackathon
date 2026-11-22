export const theme = {
  colors: {
    // Palette Solaire Principale
    gold: "#FFB800",
    sunset: "#FF8A00",
    amberLight: "#FFE29A",
    warmWhite: "#FFF9ED",
    white: "#FFFFFF",
    midnight: "#17212E",
    secondaryText: "#64748B",

    // Surfaces et Fonds Architecturaux
    bg: "#FAF9F5",         // Fond chaud, épuré, style Apple / Tesla Energy
    bgAlt: "#FFFDF9",
    surface: "#FFFFFF",
    surfaceWarm: "#FFFDF8",
    ink: "#17212E",        // Texte sombre noble Midnight
    muted: "#64748B",      // Texte secondaire ardoise élégante
    line: "#F1ECE1",       // Ligne douce chaude
    lineGold: "#FFE5A3",   // Ligne accentuée or solaire

    // Accents & États
    primary: "#FFB800",
    primaryDark: "#E09E00",
    solarGlow: "rgba(255, 184, 0, 0.16)",
    amberGlow: "rgba(255, 184, 0, 0.25)",
    cardHighlight: "#FEF9EE",

    // États fonctionnels stricts (succès = vert, erreur = rouge)
    green: "#10B981",
    greenLight: "#D1FAE5",
    greenDark: "#065F46",
    red: "#EF4444",
    redLight: "#FEE2E2",
    blue: "#38BDF8",

    // Remplacement direct de l'ancien vert forêt par le Midnight Sky premium
    forest: "#17212E",
    sun: "#FFB800",
  },
  gradients: {
    solar: ["#FFB800", "#FF8A00"] as const,
    solarSoft: ["#FFF9ED", "#FFECC7"] as const,
    solarGlow: ["#FFE29A", "#FFB800"] as const,
    cardWarm: ["#FFFFFF", "#FFFDF9"] as const,
    skyDay: ["#FFF6E5", "#FFEECB", "#FAF9F5"] as const,
    skyNight: ["#17212E", "#0F172A", "#131C28"] as const,
    badgeAmber: ["#FFF7ED", "#FEF3C7"] as const,
  },
  spacing: { xs: 6, sm: 12, md: 20, lg: 32, xl: 48 },
  radius: { sm: 12, md: 20, lg: 28, full: 9999 },
  shadow: {
    shadowColor: "#D97706",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  shadowSubtle: {
    shadowColor: "#17212E",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  motion: { fast: 180, normal: 380 },
};
