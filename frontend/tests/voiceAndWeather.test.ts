import test from "node:test";
import assert from "node:assert/strict";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Arabizi Numeral to Phonetic Arabic Converter Logic
// ─────────────────────────────────────────────────────────────────────────────
function convertArabiziToPhoneticArabic(text: string): string {
  let spoken = text;
  const keywords: [RegExp, string][] = [
    [/\b3lech\b/gi, "علاش"],
    [/\bkadeh\b/gi, "قداش"],
    [/\bchnowa\b/gi, "شنوة"],
    [/\bfamma\b/gi, "فمة"],
    [/\bsta7\b/gi, "سطح"],
    [/\bdari\b/gi, "داري"],
    [/\bchams\b/gi, "شمس"],
    [/\bdhaw\b/gi, "ضو"],
    [/\bfatora\b/gi, "فاتورة"],
    [/\bchahrin\b/gi, "شهرين"],
    [/\bchhar\b/gi, "شهر"],
    [/\bmte3ek\b/gi, "متاعك"],
    [/\bmte3i\b/gi, "متاعي"],
    [/\bn7eb\b/gi, "نحب"],
    [/\bwa9tech\b/gi, "وقتيش"],
  ];
  for (const [regex, rep] of keywords) {
    spoken = spoken.replace(regex, rep);
  }
  // Convert inside words: 3 -> ع, 7 -> ح, 9 -> ق
  spoken = spoken.replace(/([a-zA-Z])3/g, "$1ع").replace(/3([a-zA-Z])/g, "ع$1");
  spoken = spoken.replace(/([a-zA-Z])7/g, "$1ح").replace(/7([a-zA-Z])/g, "ح$1");
  spoken = spoken.replace(/([a-zA-Z])9/g, "$1ق").replace(/9([a-zA-Z])/g, "ق$1");
  return spoken;
}

function cleanTextForSpeech(text: string): string {
  let cleaned = text.replace(/<!--\s*SOLAR_CARD:\s*\{.*?\}\s*-->/gs, "");
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
  cleaned = cleaned.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1");
  cleaned = cleaned.replace(/^#{1,6}\s*/gm, "");
  cleaned = cleaned.replace(/\b(\d+(?:[.,]\d+)?)\s*kWh\b/gi, "$1 kilowattheures");
  cleaned = cleaned.replace(/\b(\d+(?:[.,]\d+)?)\s*kWc\b/gi, "$1 kilowatt-crête");
  cleaned = cleaned.replace(/\b(\d+(?:[.,]\d+)?)\s*(?:DT|TND)\b/gi, "$1 dinars");
  return cleaned.replace(/\s+/g, " ").trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Solar Score Calculation Logic
// ─────────────────────────────────────────────────────────────────────────────
function calculateSolarScore(todayRadMj: number, cloudCoverPct: number) {
  const radRatio = Math.min(1.0, Math.max(0.1, todayRadMj / 22.0));
  const cloudPenalty = (100.0 - cloudCoverPct) / 100.0;
  const score = Math.max(5, Math.min(100, Math.round((radRatio * 0.65 + cloudPenalty * 0.35) * 100)));
  const category = score >= 80 ? "excellent" : score >= 50 ? "moderate" : "low";
  return { score, category };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
test("Arabizi to Phonetic Arabic converter replaces digits and keywords correctly", () => {
  const input = "Aslema, kadeh el production mte3ek wa9tech famma chams fou9 sta7 dari ?";
  const result = convertArabiziToPhoneticArabic(input);

  assert.ok(!result.includes("kadeh"), "kadeh should be replaced");
  assert.ok(result.includes("قداش"), "Should contain قداش");
  assert.ok(result.includes("متاعك"), "Should contain متاعك");
  assert.ok(result.includes("شمس"), "Should contain شمس");
  assert.ok(result.includes("سطح"), "Should contain سطح");
  assert.ok(result.includes("داري"), "Should contain داري");
});

test("Clean text for speech strips Markdown, URLs and expands units", () => {
  const markdownText = "Consommation estimée : **200 kWh** pour **92 DT**. <!-- SOLAR_CARD: {} -->";
  const cleaned = cleanTextForSpeech(markdownText);

  assert.equal(cleaned, "Consommation estimée : 200 kilowattheures pour 92 dinars.");
  assert.ok(!cleaned.includes("**"), "Should not have asterisks");
  assert.ok(!cleaned.includes("<!--"), "Should not have comments");
});

test("Solar Score correctly assigns excellent, moderate, and low categories", () => {
  // Sunny day: 24 MJ/m², 5% clouds -> Excellent
  const sunny = calculateSolarScore(24.0, 5);
  assert.ok(sunny.score >= 80);
  assert.equal(sunny.category, "excellent");

  // Moderate day: 16 MJ/m², 40% clouds -> Moderate
  const moderate = calculateSolarScore(16.0, 40);
  assert.ok(moderate.score >= 50 && moderate.score < 80);
  assert.equal(moderate.category, "moderate");

  // Heavy overcast: 8 MJ/m², 90% clouds -> Low
  const overcast = calculateSolarScore(8.0, 90);
  assert.ok(overcast.score < 50);
  assert.equal(overcast.category, "low");
});
