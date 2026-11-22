
#include <LiquidCrystal.h>

// Configuration LCD
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

// Broches Arduino
const int solarPin = A0;
const int irradiancePin = A1;
const int ledVerte = 8;
const int ledRouge = 9;

// Configuration du panneau
const float Rcharge = 100.0;
const float puissanceMax = 0.220;

// Seuil de performance : 80%
const float seuilPerformance = 80.0;

// Energie cumulee en Wh
float energieReelle = 0.0;
float energieAttendue = 0.0;

// Detection des anomalies
int compteurAnomalies = 0;
unsigned long dernierTemps = 0;

void setup() {
  Serial.begin(9600);

  pinMode(ledVerte, OUTPUT);
  pinMode(ledRouge, OUTPUT);

  lcd.begin(16, 2);

  lcd.print("SMART SOLAR IoT");
  lcd.setCursor(0, 1);
  lcd.print("Initialisation");

  delay(2000);
  lcd.clear();

  dernierTemps = millis();
}

void loop() {

  // 1. Mesure de tension
  float tension = analogRead(solarPin)
                  * 10.0 / 1023.0;

  // 2. Calcul du courant
  float courant = tension / Rcharge;

  // 3. Puissance reelle
  float productionReelle = tension * courant;

  // 4. Irradiance de reference simulee
  float irradiance = analogRead(irradiancePin)
                     / 1023.0;

  // 5. Production attendue
  float productionAttendue =
        puissanceMax * irradiance;

  // 6. Calcul de performance
  bool evaluationPossible = irradiance >= 0.2;

  float performance = 0;

  if (evaluationPossible) {
    performance = (productionReelle /
                   productionAttendue) * 100.0;
  }

  // 7. Calcul du manque de production
  float perte = productionAttendue
                - productionReelle;

  if (perte < 0) {
    perte = 0;
  }

  // 8. Accumulation de l'energie
  unsigned long maintenant = millis();

  float heures = (maintenant - dernierTemps)
                 / 3600000.0;

  dernierTemps = maintenant;

  energieReelle += productionReelle * heures;
  energieAttendue += productionAttendue * heures;

  // 9. Detection de sous-performance
  if (evaluationPossible &&
      performance < seuilPerformance) {

    if (compteurAnomalies < 5) {
      compteurAnomalies++;
    }

  } else {
    compteurAnomalies = 0;
  }

  bool alerte = compteurAnomalies >= 5;

  // 10. Gestion des LED
  digitalWrite(ledRouge, alerte ? HIGH : LOW);

  digitalWrite(ledVerte,
    evaluationPossible &&
    performance >= seuilPerformance ? HIGH : LOW);

  // 11. Affichage LCD
  lcd.setCursor(0, 0);

  lcd.print("R:");
  lcd.print(productionReelle, 3);

  lcd.print(" E:");
  lcd.print(productionAttendue, 3);
  lcd.print(" ");

  lcd.setCursor(0, 1);
  lcd.print("                ");
  lcd.setCursor(0, 1);

  if (!evaluationPossible) {

    lcd.print("LUMIERE FAIBLE");

  } else if (alerte) {

    lcd.print("ALERTE ");
    lcd.print(performance, 1);
    lcd.print("%");

  } else {

    lcd.print("PERF: ");
    lcd.print(performance, 1);
    lcd.print("%");
  }

  // 12. Moniteur serie
  Serial.println("===== SMART SOLAR IoT =====");

  Serial.print("Tension : ");
  Serial.print(tension, 2);
  Serial.println(" V");

  Serial.print("Courant : ");
  Serial.print(courant * 1000, 2);
  Serial.println(" mA");

  Serial.print("Production reelle : ");
  Serial.print(productionReelle, 3);
  Serial.println(" W");

  Serial.print("Production attendue : ");
  Serial.print(productionAttendue, 3);
  Serial.println(" W");

  Serial.print("Irradiance simulee : ");
  Serial.print(irradiance * 100, 1);
  Serial.println(" %");

  Serial.print("Performance : ");

  if (evaluationPossible) {
    Serial.print(performance, 1);
    Serial.println(" %");
  } else {
    Serial.println("Non evaluable");
  }

  Serial.print("Perte de puissance : ");
  Serial.print(perte, 3);
  Serial.println(" W");

  Serial.print("Energie reelle cumulee : ");
  Serial.print(energieReelle, 6);
  Serial.println(" Wh");

  Serial.print("Energie attendue cumulee : ");
  Serial.print(energieAttendue, 6);
  Serial.println(" Wh");

  if (!evaluationPossible) {

    Serial.println("STATUT : Lumiere faible");

  } else if (alerte) {

    Serial.println("ALERTE : Sous-performance !");
    Serial.println("Verification recommandee");

  } else if (performance < seuilPerformance) {

    Serial.println("STATUT : Anomalie en verification");

  } else {

    Serial.println("STATUT : Production normale");
  }

  Serial.println("============================");
  Serial.println();

  delay(1000);
}
