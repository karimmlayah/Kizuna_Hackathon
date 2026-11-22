const int solarPin = 34;

void setup() {
    Serial.begin(115200);
    analogReadResolution(12);
    analogSetPinAttenuation(solarPin, ADC_11db);
}

void loop() {
    int raw = analogRead(solarPin);

    float adc = analogReadMilliVolts(solarPin) / 1000.0;
    float tension = adc * 3.0;

    Serial.println("===== SMART SOLAR IoT =====");

    Serial.print("ADC brut : ");
    Serial.println(raw);

    Serial.print("Tension ADC : ");
    Serial.print(adc, 3);
    Serial.println(" V");

    Serial.print("Tension solaire : ");
    Serial.print(tension, 3);
    Serial.println(" V");

    Serial.println("==========================");

    delay(1000);
}