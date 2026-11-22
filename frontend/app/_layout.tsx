import React, { useState, useCallback } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { BrandSplash } from "../components/BrandSplash";
import { useSolarStore } from "../store/useSolarStore";
import { theme } from "../theme";

export default function Layout() {
  const [initialSplash, setInitialSplash] = useState(true);
  const cinematicRequested = useSolarStore((s) => s.cinematicSplashRequested);
  const setStore = useSolarStore((s) => s.set);

  const done = useCallback(() => {
    setInitialSplash(false);
    setStore({ cinematicSplashRequested: false });
  }, [setStore]);

  const showSplash = initialSplash || cinematicRequested;

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
        {showSplash && (
          <BrandSplash onDone={done} forceFull={cinematicRequested} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
