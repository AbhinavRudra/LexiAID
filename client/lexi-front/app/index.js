import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import {
  useFonts,
  Lexend_400Regular,
  Lexend_700Bold,
} from "@expo-google-fonts/lexend";

export default function HomeScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Lexend_400Regular,
    Lexend_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LexiAid</Text>

      <Image
        source={require("../assets/images/upload-file.png")}
        style={styles.icon}
      />

      <Text style={styles.subtitle}>
        Convert text into simplified{"\n"}easy-to-understand audio.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/user_text")}
      >
        <Text style={styles.buttonText}>Upload Text to Listen</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/user_img")}
      >
        <Text style={styles.buttonText}>Upload Image to Listen</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/user_pdf")}
      >
        <Text style={styles.buttonText}>Upload PDF to Listen</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FCEFE6",
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontFamily: "Lexend_700Bold",
    color: "#E45750",
    marginBottom: 20,
    letterSpacing: 5,
  },
  icon: {
    width: 100,
    height: 100,
    marginBottom: 20,
    resizeMode: "contain",
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Lexend_400Regular",
    color: "#333",
    marginBottom: 30,
    textAlign: "center",
    lineHeight: 22,
    letterSpacing: 5,
  },
  button: {
    backgroundColor: "#E45750",
    paddingVertical: 30,
    borderRadius: 15,
    marginVertical: 12,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Lexend_400Regular",
    letterSpacing: 3.5,
  },
});
