"use strict";

const express = require("express");
const cors = require("cors");
const { saveAnswer, findAnswer } = require("./gcp_functions");

const app = express();

app.use(cors());
app.use(express.json());

// Save an answer (string or structured object)
// body: { question: string, answer: string | object }

app.post("/answers", async (req, res) => {
  try {
    const { question, answer } = req.body;

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Invalid or missing question" });
    }

    if (!answer) {
      return res.status(400).json({ error: "Missing answer" });
    }

    const result = await saveAnswer(question, answer);

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


app.get("/answers", async (req, res) => {
  try {
    const { question } = req.query;

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Missing question query param" });
    }

    const answer = await findAnswer(question);

    if (!answer) {
      return res.status(404).json({ error: "Answer not found" });
    }

    return res.json({
      success: true,
      answer,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
  });
}

module.exports = app;
