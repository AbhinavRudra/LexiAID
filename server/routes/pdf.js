import { Router } from "express";
import multer from "multer";
import axios from "axios";
import fs from "fs";
import FormData from "form-data";

const router = Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const formData = new FormData();
    formData.append("file", fs.createReadStream(req.file.path));

    const aiResponse = await axios.post(
      "http://AI_GUY_URL/pdf-to-audio",
      formData,
      { headers: formData.getHeaders() } 
    );
    res.json({ audioUrl: aiResponse.data.url });

    fs.unlinkSync(req.file.path);

  } catch (err) {
    console.error("Error in /pdf:", err.message);
    res.status(500).json({ error: "Backend error" });
  }
});

export default router;
