"use strict";

const express = require("express");
const cors = require("cors");
const { saveAnswer, findAnswer } = require("./gcp_functions");

const app = express();

app.use(cors());
app.use(express.json());

// POST /answers
// body: { question: string, answer: string | object }
app.post("/answers", async (req, res) => {
  try {
    const { question, answer } = req.body || {};

    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "Invalid or missing question" });
    }

    const isAnswerString = typeof answer === "string" && answer.trim();
    const isAnswerObject = typeof answer === "object" && answer !== null;

    if (!isAnswerString && !isAnswerObject) {
      return res.status(400).json({ error: "Invalid or missing answer" });
    }

    const result = await saveAnswer(question.trim(), answer);

    // Keep it simple + compatible with your current callers
    return res.status(201).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /answers?question=...
app.get("/answers", async (req, res) => {
  try {
    const question = req.query?.question;

    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "Missing question query param" });
    }

    const answer = await findAnswer(question.trim());

    // Keep your current API behavior: if found, respond { answer }
    if (answer) return res.json({ answer });

    return res.status(404).json({ error: "Answer not found" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Only start server in local/dev usage
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
}

module.exports = app;

