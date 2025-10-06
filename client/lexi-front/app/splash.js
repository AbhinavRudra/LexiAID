import { View, Text, StyleSheet, Image } from "react-native";
import { useEffect } from "react";
import { useRouter } from "expo-router";
import {
  useFonts,
  Lexend_400Regular,
  Lexend_700Bold,
} from "@expo-google-fonts/lexend";

export default function SplashScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Lexend_400Regular,
    Lexend_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      const timer = setTimeout(() => {
        router.replace("/");
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/dyslexia.png")}
        style={styles.logo}
      />
      <Text style={styles.title}>LexiAid</Text>
      <Text style={styles.subtitle}>Your words, made simple.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FCEFE6",
  },
  logo: { width: 150, height: 150, marginBottom: 20 },
  title: {
    fontSize: 36,
    fontFamily: "Lexend_700Bold",
    color: "#E45750",
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: "Lexend_400Regular",
    marginTop: 10,
    color: "#333333",
    letterSpacing: 5,
  },
});
