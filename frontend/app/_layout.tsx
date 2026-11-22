import React, { useState, useCallback } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { BrandSplash } from "../components/BrandSplash";
import { theme } from "../theme";

export default function Layout() {
  const [splash, setSplash] = useState(true);
  const done = useCallback(() => setSplash(false), []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
            contentStyle: { backgroundColor: theme.colors.bg },
          }}
        />
        {splash && <BrandSplash onDone={done} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
