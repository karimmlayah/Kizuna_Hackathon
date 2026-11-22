import React, { useState } from "react";
import { View, Text } from "react-native";
import { ShieldCheck } from "lucide-react-native";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { FileUpload, type LocalFile } from "../components/FileUpload";
import {
  GlassPanel,
  Title,
  Copy,
  StatusIndicator,
  PremiumButton,
  EmptyState,
  s,
  colors,
} from "../components/ui";
import { useSolarStore } from "../store/useSolarStore";
export default function Maintenance() {
  const [file, setFile] = useState<LocalFile | null>(null);
  const [report, setReport] = useState(false);
  const { inspections, set } = useSolarStore();
  function add() {
    setReport(true);
    if (file)
      set({
        inspections: [
          {
            id: String(Date.now()),
            date: new Date().toLocaleDateString("fr-FR"),
            uri: file.uri,
            demo: true,
          },
          ...inspections,
        ],
      });
  }
  return (
    <ResponsiveLayout>
      <View style={{ gap: 10, marginBottom: 28 }}>
        <StatusIndicator label="Interface de démonstration · aucun diagnostic" />
        <Title>Gardez une longueur d’avance.</Title>
        <Copy>Un carnet visuel pour prendre soin de votre installation.</Copy>
      </View>
      <GlassPanel>
        <FileUpload
          imageOnly
          file={file}
          onFile={(f) => {
            setFile(f);
            setReport(false);
          }}
        />
        <View style={[s.row, { flexWrap: "wrap", marginTop: 16 }]}>
          <PremiumButton
            title="Enregistrer et voir le rapport type"
            disabled={!file}
            onPress={add}
          />
          <PremiumButton
            title="Découvrir un rapport démo"
            secondary
            onPress={() => setReport(true)}
          />
        </View>
      </GlassPanel>
      {report && (
        <GlassPanel style={{ marginTop: 20, gap: 14 }}>
          <StatusIndicator label="Rapport de démonstration" />
          <ShieldCheck size={32} color={colors.green} />
          <Title>Un exemple pour mieux anticiper.</Title>
          <Copy>
            Aucune analyse de votre photographie n’a été effectuée. Les
            informations suivantes illustrent la présentation d’un futur
            rapport.
          </Copy>
          {[
            "Panneaux · état non mesuré",
            "Onduleur · non connecté",
            "Batterie · non connectée",
          ].map((x) => (
            <Text key={x} style={{ fontSize: 16, color: colors.forest }}>
              {x}
            </Text>
          ))}
          <Text style={{ fontSize: 17, fontWeight: "600" }}>
            Conseils généraux
          </Text>
          <Copy>
            Conservez des photographies régulières. Faites contrôler les
            équipements selon les instructions du fabricant. Confiez les
            interventions en toiture et les vérifications électriques à un
            professionnel.
          </Copy>
        </GlassPanel>
      )}
      <GlassPanel style={{ marginTop: 20 }}>
        <Title>Votre carnet d’inspections</Title>
        {inspections.length ? (
          inspections.map((i) => (
            <View
              key={i.id}
              style={[
                s.row,
                { justifyContent: "space-between", paddingVertical: 12 },
              ]}
            >
              <View>
                <Text style={{ fontWeight: "500" }}>
                  Photographie enregistrée · {i.date}
                </Text>
                <Copy>Rapport type · Démonstration</Copy>
              </View>
              <PremiumButton
                title="Consulter"
                secondary
                onPress={() => {
                  setFile({ uri: i.uri, name: "Inspection.jpg", image: true });
                  setReport(true);
                }}
              />
            </View>
          ))
        ) : (
          <EmptyState
            title="Une histoire à commencer"
            description="Importez votre première photo pour créer une entrée locale."
          />
        )}
      </GlassPanel>
    </ResponsiveLayout>
  );
}
