import { test } from "node:test";
import assert from "node:assert/strict";

function parseSolarCard(text: string) {
  let cardData: any = null;
  let cleanText = text;

  const cardMatch = text.match(/<!--\s*SOLAR_CARD:\s*(\{.*?\})\s*-->/s);
  if (cardMatch && cardMatch[1]) {
    try {
      cardData = JSON.parse(cardMatch[1]);
      cleanText = text.replace(cardMatch[0], "").trim();
    } catch {
      // ignore
    }
  }

  return { cardData, cleanText };
}

test("parseSolarCard correctly extracts sizing_proposal and cleans markdown", () => {
  const rawText = "Bonjour ! Voici votre devis.\n\n<!-- SOLAR_CARD: {\"type\": \"sizing_proposal\", \"panel_count\": 3, \"panel_wattage\": 450, \"installed_kwp\": 1.35, \"location\": \"Metlaoui\"} -->\n\nN'hésitez pas à poser des questions.";
  const { cardData, cleanText } = parseSolarCard(rawText);

  assert.ok(cardData);
  assert.equal(cardData.type, "sizing_proposal");
  assert.equal(cardData.panel_count, 3);
  assert.equal(cardData.installed_kwp, 1.35);
  assert.equal(cardData.location, "Metlaoui");
  assert.ok(!cleanText.includes("<!-- SOLAR_CARD:"));
  assert.ok(cleanText.includes("Bonjour ! Voici votre devis."));
});

test("parseSolarCard handles text without card gracefully", () => {
  const rawText = "Simple message without card.";
  const { cardData, cleanText } = parseSolarCard(rawText);

  assert.equal(cardData, null);
  assert.equal(cleanText, rawText);
});
