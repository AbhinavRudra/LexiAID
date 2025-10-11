import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import {
  useFonts,
  Lexend_400Regular,
  Lexend_700Bold,
} from "@expo-google-fonts/lexend";
import * as DocumentPicker from "expo-document-picker";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { BASE_URL } from "../config";
import * as FileSystem from "expo-file-system/legacy"; // ✅ use legacy for writeAsStringAsync

export default function PdfScreen() {
  const [pdfFile, setPdfFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sound, setSound] = useState(null);
  const [playing, setPlaying] = useState(false);

  const [fontsLoaded] = useFonts({
    Lexend_400Regular,
    Lexend_700Bold,
  });

  if (!fontsLoaded) return null;

  const pickPdf = async () => {
    let result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
    });

    if (!result.canceled) {
      const file = result.assets[0];
      setPdfFile(file);
    }
  };

  const handlePlay = async () => {
    if (!pdfFile) return;
    setLoading(true);

    try {
      let formData = new FormData();
      formData.append("file", {
        uri: pdfFile.uri,
        type: "application/pdf",
        name: pdfFile.name || "upload.pdf",
      });

      const response = await fetch(`${BASE_URL}/api/pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      const data = await response.json();
      console.log("Backend response:", data);

      if (data.audio && data.audio.audio_base64) {
        // Save base64 audio to cache
        const fileUri = FileSystem.cacheDirectory + "output.mp3";
        await FileSystem.writeAsStringAsync(fileUri, data.audio.audio_base64, {
          encoding: "base64",
        });

        // Play audio
        const { sound } = await Audio.Sound.createAsync(
          { uri: fileUri },
          { shouldPlay: true }
        );
        setSound(sound);
        setPlaying(true);
      } else {
        console.error("No audio in response");
      }
    } catch (error) {
      console.error("Error uploading PDF:", error);
    } finally {
      setLoading(false);
    }
  };

  // cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LexiAid</Text>

      <TouchableOpacity style={styles.uploadBox} onPress={pickPdf}>
        {pdfFile ? (
          <View style={styles.fileRow}>
            <Image
              source={require("../assets/images/pdf.png")}
              style={styles.smallIcon}
            />
            <Text style={styles.pdfName} numberOfLines={1}>
              {pdfFile.name}
            </Text>
          </View>
        ) : (
          <>
            <Image
              source={require("../assets/images/pdf.png")}
              style={styles.icon}
            />
            <Text style={styles.subtitle}>
              Upload a PDF file, and we’ll scan and narrate it clearly.
            </Text>
          </>
        )}
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#E45750"
          style={{ marginBottom: 20 }}
        />
      ) : (
        <TouchableOpacity
          style={[styles.playButton, !pdfFile && { opacity: 0.5 }]}
          onPress={handlePlay}
          disabled={!pdfFile}
        >
          <Ionicons name="play" size={48} color="#fff" />
        </TouchableOpacity>
      )}
      <Text style={styles.playText}>
        {loading ? "Loading..." : playing ? "Playing..." : "Play"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    backgroundColor: "#FCEFE6",
    padding: 30,
  },
  title: {
    fontSize: 32,
    fontFamily: "Lexend_700Bold",
    color: "#E45750",
    marginTop: 40,
    marginBottom: 30,
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: "#E45750",
    borderRadius: 10,
    width: "100%",
    height: 400,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
    padding: 10,
  },
  icon: {
    width: 60,
    height: 60,
    marginBottom: 15,
    resizeMode: "contain",
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  smallIcon: {
    width: 30,
    height: 30,
    resizeMode: "contain",
    marginRight: 10,
  },
  pdfName: {
    fontSize: 12,
    fontFamily: "Lexend_400Regular",
    color: "#333",
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Lexend_400Regular",
    color: "#333",
    textAlign: "center",
    lineHeight: 20,
    letterSpacing: 3.5,
  },
  playButton: {
    width: 90,
    height: 90,
    backgroundColor: "#E45750",
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  playText: {
    fontSize: 16,
    fontFamily: "Lexend_700Bold",
    color: "#333",
    letterSpacing: 2,
  },
});
