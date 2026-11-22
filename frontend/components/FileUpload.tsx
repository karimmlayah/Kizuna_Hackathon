import React, { useState } from "react";
import { View, Text, Platform, Linking } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { Image } from "expo-image";
import { Upload, FileText } from "lucide-react-native";
import { PremiumButton, Copy, colors, s } from "./ui";
export interface LocalFile {
  uri: string;
  name: string;
  image: boolean;
}
export function FileUpload({
  file,
  onFile,
  imageOnly = false,
}: {
  file: LocalFile | null;
  onFile: (f: LocalFile) => void;
  imageOnly?: boolean;
}) {
  const [error, setError] = useState("");
  async function pick(camera = false) {
    setError("");
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError(
            "Autorisez la caméra dans les réglages, ou importez une image.",
          );
          return;
        }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
        if (!result.canceled)
          onFile({
            uri: result.assets[0]!.uri,
            name: "Photo.jpg",
            image: true,
          });
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: imageOnly ? ["image/*"] : ["image/*", "application/pdf"],
          copyToCacheDirectory: true,
        });
        if (!result.canceled) {
          const a = result.assets[0]!;
          if (a.size && a.size > 20 * 1024 * 1024) {
            setError("Choisissez un fichier de moins de 20 Mo.");
            return;
          }
          onFile({
            uri: a.uri,
            name: a.name,
            image: a.mimeType?.startsWith("image/") ?? false,
          });
        }
      }
    } catch {
      setError(
        "Impossible d’ouvrir ce fichier. Réessayez avec une image ou un PDF.",
      );
    }
  }
  return (
    <View style={{ gap: 16 }}>
      <View
        style={{
          borderWidth: 2,
          borderStyle: "dashed",
          borderColor: "#FFE29A",
          borderRadius: 22,
          padding: 30,
          backgroundColor: "#FFFDF9",
          alignItems: "center",
          gap: 14,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            backgroundColor: "#FEF3C7",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Upload size={28} color="#D97706" strokeWidth={2.4} />
        </View>
        <Text style={{ fontSize: 19, fontWeight: "700", color: colors.midnight }}>
          {imageOnly
            ? "Votre image, votre projet"
            : "Commençons par votre facture"}
        </Text>
        <Copy>
          {imageOnly
            ? "JPG, PNG, WEBP · 20 Mo maximum"
            : "PDF, JPG ou PNG · 20 Mo maximum"}
        </Copy>
        <PremiumButton title="Choisir un fichier" onPress={() => void pick()} />
        {Platform.OS !== "web" && (
          <PremiumButton
            title="Prendre une photo"
            secondary
            onPress={() => void pick(true)}
          />
        )}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: "#A94436" }}>
          {error}
        </Text>
      ) : null}
      {file ? (
        <View style={{ gap: 12 }}>
          <View style={s.row}>
            <FileText size={18} color={colors.forest} />
            <Text style={{ flex: 1, color: colors.forest }}>{file.name}</Text>
          </View>
          {file.image ? (
            <Image
              source={{ uri: file.uri }}
              style={{
                height: 240,
                borderRadius: 16,
                backgroundColor: "#EEF2ED",
              }}
              contentFit="contain"
            />
          ) : Platform.OS === "web" ? (
            <iframe
              title="Aperçu de votre facture PDF"
              src={file.uri}
              style={{
                width: "100%",
                height: 350,
                border: 0,
                borderRadius: 16,
              }}
            />
          ) : (
            <View>
              <Copy>
                PDF sélectionné. Ouvrez-le dans votre lecteur pour vérifier les
                champs.
              </Copy>
              <PremiumButton
                title="Ouvrir le PDF"
                secondary
                onPress={() =>
                  void (Platform.OS==='android'
                    ? FileSystem.getContentUriAsync(file.uri).then(data=>IntentLauncher.startActivityAsync('android.intent.action.VIEW',{data,type:'application/pdf',flags:1}))
                    : Linking.openURL(file.uri)).catch(() =>
                    setError(
                      "Lecteur PDF indisponible. Utilisez une image pour un aperçu intégré.",
                    ),
                  )
                }
              />
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}
