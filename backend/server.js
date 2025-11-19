const express = require('express');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Path to our local JSON database file
const dbPath = path.join(__dirname, 'db.json');

// Middleware
app.use(cors()); 
app.use(express.json()); 

// --- Helper Functions for Database ---

// Reads the database file and returns the object
const readDb = () => {
  try {
    // If the file doesn't exist, return an empty object
    if (!fs.existsSync(dbPath)) {
      return {}; 
    }
    const data = fs.readFileSync(dbPath, 'utf8');
    // If file is empty string, return empty object, otherwise parse JSON
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error reading database file:', error);
    return {};
  }
};

// Writes the data object to the database file
const writeDb = (data) => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing to database file:', error);
  }
};

// === API ROUTES ===

/**
 * [POST] /api/generate-quiz
 * Calls Google Gemini to generate a quiz on a specific topic.
 */
app.post('/api/generate-quiz', async (req, res) => {
  const { topic } = req.body;
  const apiKey = process.env.GEMINI_API_KEY; 
  
  // Basic API Key check
  if (!apiKey || apiKey.includes('paste_your')) {
    return res.status(500).json({ error: 'Server Error: API Key is missing or invalid in .env file.' });
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

  console.log(`Received quiz request for topic: ${topic}`);

  const systemPrompt = `You are a helpful quiz generation assistant.
  Your task is to generate a 10-question multiple-choice quiz on a given topic.
  You must return the response as a valid JSON object only, with no other text, markdown, or " \`\`\`json " tags.
  
  The JSON object must have a single key "questions", which is an array of 10 question objects.
  Each question object must have the following keys:
  - "question": A string (the question text)
  - "options": An array of 4 strings (the options)
  - "correctIndex": A number (0-3) representing the index of the correct option
  - "explanation": A string (a brief explanation of the correct answer)`;

  const userQuery = `Generate the 10-question quiz on the topic: "${topic}"`;

  try {
    const geminiResponse = await axios.post(apiUrl, 
      {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: "application/json" }
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const jsonString = geminiResponse.data.candidates[0].content.parts[0].text;
    const quizJson = JSON.parse(jsonString);
    res.json(quizJson);

  } catch (error) {
    console.error('Error calling Gemini API:', error.message);
    res.status(500).json({ error: 'Failed to generate quiz from AI.' });
  }
});

/**
 * [GET] /api/get-scores
 * Returns the list of scores for a specific username.
 * Usage: GET /api/get-scores?username=John
 */
app.get('/api/get-scores', (req, res) => {
  const { username } = req.query; 
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  const db = readDb();
  // Get scores for this user, or return empty array if user not found
  const userScores = db[username] || [];
  
  res.json(userScores);
});

/**
 * [POST] /api/save-score
 * Saves a score to the list belonging to the specific username.
 * Body: { username: "John", scoreData: { topic, score, total, timestamp } }
 */
app.post('/api/save-score', (req, res) => {
  // We extract username and the rest of the score data
  const { username, topic, score, total, timestamp } = req.body;
  
  // Use a simple object to ensure the data is complete before saving
  const scoreData = { topic, score, total, timestamp };

  if (!username || !scoreData.topic) {
    return res.status(400).json({ error: 'Username and score data are required.' });
  }

  const db = readDb();
  
  // If this user doesn't exist in DB yet, create an empty array for them
  if (!db[username]) {
    db[username] = [];
  }

  // Add the new score to that user's list
  db[username].push(scoreData);
  
  // Save back to file
  writeDb(db);
  
  res.status(201).json({ message: 'Score saved successfully.' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});