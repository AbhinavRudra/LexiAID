import express from "express";
import axios from "axios";
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });
    const aiResponse = await axios.post("http://AI_GUY_URL/text-to-speech", {
      text
    });

    res.json({ audioUrl: aiResponse.data.url }); 
  }  catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Backend error" });
  }
});

export default router;
