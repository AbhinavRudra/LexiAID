import dotenv from "dotenv";
dotenv.config();
import express, { json } from "express";
import cors from "cors";
import morgan from "morgan";

const app= express();
app.use(cors());
app.use(json());
app.use(morgan("dev"));

import textRoutes from "./routes/text.js"; 
app.use("/api/text", textRoutes);   
import imageRoutes from "./routes/image.js";
app.use("/api/image", imageRoutes);
import pdfRoutes from "./routes/pdf.js";
app.use("/api/pdf", pdfRoutes);


const PORT= process.env.PORT ;

app.get("/", (req, res) => {
  res.send("Backend is running!");
});

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
  });
  