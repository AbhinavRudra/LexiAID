import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  useFonts,
  Lexend_400Regular,
  Lexend_700Bold,
} from "@expo-google-fonts/lexend";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useState, useEffect } from "react";
import { Audio } from "expo-av";
import { BASE_URL } from "../config";
import * as FileSystem from "expo-file-system/legacy";

export default function ImageScreen() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [sound, setSound] = useState(null);

  const [fontsLoaded] = useFonts({
    Lexend_400Regular,
    Lexend_700Bold,
  });

  useEffect(() => {
    (async () => {
      const { status: galleryStatus } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      const { status: cameraStatus } =
        await ImagePicker.requestCameraPermissionsAsync();

      if (galleryStatus !== "granted" || cameraStatus !== "granted") {
        Alert.alert(
          "Permissions needed",
          "We need camera and gallery permissions to continue."
        );
      }
    })();
  }, []);

  // cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  if (!fontsLoaded) return null;

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handlePlay = async () => {
    if (!image) return;
    setLoading(true);
    setAudioUrl(null);

    try {
      let formData = new FormData();
      formData.append("file", {
        uri: image,
        type: "image/jpeg", // or "image/png"
        name: "upload.jpg",
      });

      const response = await fetch(`${BASE_URL}/api/image`, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const data = await response.json();
      console.log("Backend response:", data);

      if (data.audio && data.audio.audio_base64) {
        const fileUri = FileSystem.cacheDirectory + "output.mp3";
        await FileSystem.writeAsStringAsync(fileUri, data.audio.audio_base64, {
          encoding: "base64", // ✅ fixed here
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: fileUri },
          { shouldPlay: true }
        );
        setSound(sound);
      } else {
        console.error("No audio in response");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
    } finally {
      setLoading(false);
    }
  };

  // cleanup audio on unmount

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LexiAid</Text>
      <View style={styles.uploadBox}>
        {image ? (
          <Image source={{ uri: image }} style={styles.preview} />
        ) : (
          <>
            <Image
              source={require("../assets/images/img.png")}
              style={styles.icon}
            />
            <Text style={styles.subtitle}>
              Take or upload a picture and we’ll read it aloud.
            </Text>
          </>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.smallButton} onPress={pickImage}>
          <Ionicons name="image" size={24} color="#fff" />
          <Text style={styles.buttonLabel}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.smallButton} onPress={takePhoto}>
          <Ionicons name="camera" size={24} color="#fff" />
          <Text style={styles.buttonLabel}>Camera</Text>
        </TouchableOpacity>
      </View>

      {/* Play button or loader */}
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
        <Text style={{ marginTop: 20, fontFamily: "Lexend_400Regular" }}>
          ✅ Playing audio from base64
        </Text>
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
    marginBottom: 30,
    letterSpacing: 5,
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: "#E45750",
    borderRadius: 10,
    width: "100%",
    height: 400,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    padding: 10,
  },
  icon: {
    width: 60,
    height: 60,
    marginBottom: 15,
    resizeMode: "contain",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Lexend_400Regular",
    color: "#333",
    textAlign: "center",
    lineHeight: 20,
    letterSpacing: 3.5,
  },
  preview: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    resizeMode: "contain",
    backgroundColor: "#fff",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 30,
  },
  smallButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E45750",
    paddingVertical: 12,
    marginHorizontal: 5,
    borderRadius: 10,
  },
  buttonLabel: {
    color: "#fff",
    marginLeft: 8,
    fontFamily: "Lexend_400Regular",
    letterSpacing: 3.5,
    fontSize: 14,
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
    letterSpacing: 5,
  },
});
