const express = require('express');
const cors = require('cors');
const { saveAnswer, findAnswer } = require('./gcp_functions');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/answers', async (req, res) => {
  try {
    const result = await saveAnswer(req.body.question, req.body.answer);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/answers', async (req, res) => {
  try {
    const answer = await findAnswer(req.query.question);
    answer ? res.json({ answer }) : res.status(404).json({ error: 'Answer not found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));

module.exports = app;
