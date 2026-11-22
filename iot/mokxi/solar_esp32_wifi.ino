/*
 * =====================================================================
 * SMART SOLAR IoT — Firmware ESP32 pour Mokxi Lab & Démonstration Live
 * =====================================================================
 * Simulation du panneau solaire 6V 1W + Diviseur de tension (R1=10k, R2=20k)
 * Envoi des mesures en direct via Wi-Fi vers le Gateway Smart Solar
 */

#include <WiFi.h>
#include <HTTPClient.h>

// Broche analogique ADC (entrée diviseur de tension du panneau)
const int solarPin = 34;

// Paramètres Wi-Fi Mokxi-Lab
const char* ssid = "Mokxi-Lab";
const char* password = "breadboard";

// Endpoint IoT :
// 1. En local (si exécuté sur la même machine) : "http://10.0.2.2:8002/api/iot/measurements"
// 2. Via Cloudflare Tunnel (accès universel sans configuration NAT) :
//    Copiez l'URL depuis le Smart Solar Control Center !
const char* serverUrl = "http://127.0.0.1:8002/api/iot/measurements";

// Clé API sécurisée Smart Solar (générée par le Gateway ou Control Center)
// Remplacez par votre clé locale ou celle affichée dans le Smart Solar Control Center
const char* apiKey = "YOUR_SMART_SOLAR_IOT_API_KEY";

void setup() {
    Serial.begin(115200);
    analogReadResolution(12);
    analogSetPinAttenuation(solarPin, ADC_11db);

    Serial.println("\n==========================================");
    Serial.println("  SMART SOLAR IoT — ESP32 ACQUISITION    ");
    Serial.println("==========================================");

    WiFi.begin(ssid, password);
    Serial.print("Connexion au Wi-Fi");
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 20) {
        delay(500);
        Serial.print(".");
        retries++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[Wi-Fi Connecté] IP: " + WiFi.localIP().toString());
    } else {
        Serial.println("\n[Avertissement] Wi-Fi en attente...");
    }
}

void loop() {
    int raw = analogRead(solarPin);
    float adc_v = analogReadMilliVolts(solarPin) / 1000.0;
    
    // Rapport du pont diviseur (R1=10k, R2=20k -> Facteur x3.0)
    float tension_v = adc_v * 3.0;

    // Calcul du courant (charge de test RL = 36 ohms)
    float courant_a = tension_v / 36.0;
    float puissance_w = tension_v * courant_a;

    Serial.println("------------------------------------------");
    Serial.printf("Tension solaire : %.3f V\n", tension_v);
    Serial.printf("Courant estimé  : %.1f mA\n", courant_a * 1000.0);
    Serial.printf("Puissance       : %.4f W\n", puissance_w);

    // Envoi des données par HTTPS / HTTP
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(serverUrl);
        http.addHeader("Content-Type", "application/json");

        String payload = "{\"device_id\":\"SOLAR-MOKXI-001\",\"voltage_v\":" + 
                         String(tension_v, 3) + ",\"api_key\":\"" + apiKey + "\"}";

        int httpResponseCode = http.POST(payload);

        if (httpResponseCode > 0) {
            Serial.printf(">>> Transmission réussie (HTTP %d)\n", httpResponseCode);
        } else {
            Serial.printf(">>> Échec envoi : %s\n", http.errorToString(httpResponseCode).c_str());
        }
        http.end();
    }

    delay(1000); // Acquisition et transmission chaque seconde
}
