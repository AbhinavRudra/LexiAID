import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useState, useEffect } from "react";
import {
  useFonts,
  Lexend_400Regular,
  Lexend_700Bold,
} from "@expo-google-fonts/lexend";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { BASE_URL } from "../config";
import * as FileSystem from "expo-file-system/legacy";

export default function TextScreen() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [sound, setSound] = useState(null);
  const [inputHeight, setInputHeight] = useState(120);

  const [fontsLoaded] = useFonts({
    Lexend_400Regular,
    Lexend_700Bold,
  });

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  if (!fontsLoaded) return null;

  const handlePlay = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setAudioUrl(null);

    try {
      const response = await fetch(`${BASE_URL}/api/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      console.log("Backend response:", data);

      if (data.audio && data.audio.audio_base64) {
        const fileUri = FileSystem.cacheDirectory + "output.mp3";
        await FileSystem.writeAsStringAsync(fileUri, data.audio.audio_base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        setAudioUrl(fileUri);

        const { sound } = await Audio.Sound.createAsync(
          { uri: fileUri },
          { shouldPlay: true }
        );
        setSound(sound);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // unload sound when component unmounts

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LexiAid</Text>

      <TextInput
        style={[styles.textBox, { height: inputHeight }]}
        placeholder="Paste or type your text here and we’ll read it for you."
        placeholderTextColor="#333"
        multiline
        value={text}
        onChangeText={setText}
        onContentSizeChange={(event) => {
          setInputHeight(Math.max(120, event.nativeEvent.contentSize.height));
        }}
      />

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#E45750"
          style={{ marginBottom: 20 }}
        />
      ) : (
        <TouchableOpacity style={styles.playButton} onPress={handlePlay}>
          <Ionicons name="play" size={48} color="#fff" />
        </TouchableOpacity>
      )}
      <Text style={styles.playText}>{loading ? "Loading..." : "Play"}</Text>

      {audioUrl && (
        <Text style={{ marginTop: 20, fontFamily: "Lexend_400Regular" }}></Text>
      )}
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
    letterSpacing: 5,
    marginBottom: 40,
  },
  textBox: {
    borderWidth: 2,
    borderColor: "#E45750",
    borderRadius: 10,
    width: "100%",
    padding: 15,
    fontSize: 20,
    fontFamily: "Lexend_200Regular",
    color: "#333333",
    letterSpacing: 1,
    marginBottom: 40,
    textAlignVertical: "top",
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
    color: "#333333",
    letterSpacing: 5,
  },
});
