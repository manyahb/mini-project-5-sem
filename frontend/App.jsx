import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = 'http://localhost:3001';

function App() {
  // --- User State (Persists across quizzes) ---
  const [usernameInput, setUsernameInput] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // --- Quiz State (Resets for each new quiz) ---
  const [topic, setTopic] = useState('');
  const [quizData, setQuizData] = useState(null);
  const [userAnswers, setUserAnswers] = useState(null);
  const [results, setResults] = useState(null);

  // --- UI State ---
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // --- Database State ---
  const [pastScores, setPastScores] = useState([]);
  const [loadingScores, setLoadingScores] = useState(false);

  // --- Effect: Load Scores when User Logs In ---
  useEffect(() => {
    if (currentUser) {
      fetchScores();
    }
  }, [currentUser]);

  const fetchScores = async () => {
    setLoadingScores(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/get-scores?username=${currentUser}`);
      // Sort newest first
      const sorted = response.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setPastScores(sorted);
    } catch (err) {
      console.error('Error fetching scores:', err);
    } finally {
      setLoadingScores(false);
    }
  };
  // --- Handlers ---

  const handleLogin = () => {
    if (usernameInput.trim()) {
      setCurrentUser(usernameInput.trim());
      setError('');
      setTopic('');
      setQuizData(null);
      setResults(null);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUsernameInput('');
    setPastScores([]);
    setTopic('');
    setQuizData(null);
    setResults(null);
  };

  /**
   * Resets the quiz state to allow generating a NEW quiz.
   * Keeps the currentUser logged in!
   */
  const handleTakeAnotherQuiz = () => {
    setTopic('');
    setQuizData(null);
    setUserAnswers(null);
    setResults(null);
    setError('');
    fetchScores();
  };

  const handleGenerateQuiz = async () => {
    if (!topic.trim()) return;

    setIsLoading(true);
    setError('');
    setQuizData(null);
    setResults(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/generate-quiz`, { topic });
      const questions = response.data.questions || response.data;

      if (questions && questions.length > 0) {
        setQuizData(questions);
        setUserAnswers(new Array(questions.length).fill(null));
      } else {
        setError('Failed to generate quiz.');
      }
    } catch (err) {
      setError('Error connecting to AI service.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (userAnswers.some(answer => answer === null)) {
      setError('Please answer all questions.');
      return;
    }

    setIsLoading(true);

    // 1. Score Locally
    let score = 0;
    const feedback = quizData.map((q, i) => {
      const isCorrect = q.correctIndex === userAnswers[i];
      if (isCorrect) score++;
      return { ...q, userAnswer: q.options[userAnswers[i]], isCorrect };
    });

    const finalResults = { score, total: quizData.length, feedback };
    setResults(finalResults);

    // 2. Save to Backend
    const newScoreData = {
      username: currentUser,
      topic: topic,
      score: score,
      total: quizData.length,
      timestamp: new Date().toISOString(),
    };

    try {
      await axios.post(`${API_BASE_URL}/api/save-score`, newScoreData);
      fetchScores();
    } catch (dbError) {
      console.error('Failed to save score:', dbError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (questionIndex, optionIndex) => {
    const newAnswers = [...userAnswers];
    newAnswers[questionIndex] = optionIndex;
    setUserAnswers(newAnswers);
  };
  // --- Render Functions ---

  const renderLoginScreen = () => (
    <div className="login-container">
      <h1>Welcome to Smart Quiz</h1>
      <p>Please enter your name to continue</p>
      <div className="login-box">
        <input
          type="text"
          placeholder="Your Name"
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />
        <button onClick={handleLogin} disabled={!usernameInput.trim()}>
          Start Quiz
        </button>
      </div>
    </div>
  );

  const renderMainApp = () => (
    <>
      <div className="user-header">
        <span>User: <strong>{currentUser}</strong></span>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </div>

      {!quizData && !results && (
        <div className="input-container">
          <h2>Create a New Quiz</h2>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter topic (e.g. Space)"
            disabled={isLoading}
          />
          <button onClick={handleGenerateQuiz} disabled={isLoading || !topic.trim()}>
            {isLoading ? 'Generating...' : 'Generate Quiz'}
          </button>
          {error && <p className="error-message">{error}</p>}
        </div>
      )}

      {quizData && !results && (
        <div className="quiz-container">
          <h2>Topic: {topic}</h2>
          {quizData.map((q, i) => (
            <div key={i} className="question-card">
              <h3>{i + 1}. {q.question}</h3>
              <div className="options-container">
                {q.options.map((opt, optIndex) => (
                  <label key={optIndex} className={`option-label ${userAnswers[i] === optIndex ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name={`q-${i}`}
                      checked={userAnswers[i] === optIndex}
                      onChange={() => handleAnswerSelect(i, optIndex)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button onClick={handleSubmitQuiz} disabled={isLoading}>Submit Quiz</button>
        </div>
      )}

      {results && (
        <div className="results-container">
          <h2>Quiz Results</h2>
          <h3 className="score">Score: {results.score} / {results.total}</h3>

          <div className="feedback-list">
            {results.feedback.map((f, i) => (
              <div key={i} className={`feedback-card ${f.isCorrect ? 'correct' : 'incorrect'}`}>
                <h4>{i+1}. {f.question}</h4>
                <p>Your Answer: {f.userAnswer}</p>
                {!f.isCorrect && <p className="correct-answer">Correct: {f.options[f.correctIndex]}</p>}
                <p className="explanation">{f.explanation}</p>
              </div>
            ))}
          </div>

          <button onClick={handleTakeAnotherQuiz} style={{marginTop: '2rem'}}>
            Generate Another Quiz
          </button>
        </div>
      )}

      {!quizData && !results && (
        <div className="past-scores-container">
          <h3>Your Past Scores</h3>
          {loadingScores ? <p>Loading...</p> : (
            <ul className="scores-list">
              {pastScores.length === 0 && <p>No quizzes taken yet.</p>}
              {pastScores.map((s, i) => (
                <li key={i} className="score-item">
                  <span className="score-topic">{s.topic}</span>
                  <span className="score-date">{new Date(s.timestamp).toLocaleDateString()}</span>
                  <span className="score-value">{s.score} / {s.total}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="App">
      <div className="app-container">
        {!currentUser ? renderLoginScreen() : renderMainApp()}
      </div>
    </div>
  );
}

export default App;