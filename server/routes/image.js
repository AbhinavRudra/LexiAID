
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
        "http://127.0.0.1:5000",
        formData,
        { headers: formData.getHeaders() }
      );
      res.json({ audioUrl: aiResponse.data.url });
      
  } catch (err) {
    console.error("Error in /image:", err.message);
    res.status(500).json({ error: "Backend error" });
  }
});

export default router;
