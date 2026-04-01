# 🧠 LLM & Machine Learning Architecture

Smart Interview AI leverages cutting-edge Large Language Models (LLMs) and built-in browser Machine Learning APIs to create a responsive, historically aware, and highly accurate AI interviewing platform. 

This document outlines the technical design of the AI integrations used in this application.

---

## 1. Core LLM Engine: Google Gemini 2.5 Flash
The entire intelligence layer of the application is powered by Google's **Gemini 2.5 Flash** model via the `@google/genai` Node SDK. 

We chose the `gemini-2.5-flash` snapshot because it offers the optimal balance of ultra-low latency inference (crucial for real-time conversational interviews) and exceptionally large context windows (required for ingesting entire PDF resumes and lengthy job descriptions simultaneously).

### Prompt Engineering & API Modules
All LLM interactions are decoupled into dedicated asynchronous functions inside `src/lib/gemini.ts`. The AI enforces strict **JSON Schema responses** (`responseMimeType: "application/json"`) to ensure the React frontend receives strictly typed data structures instead of raw unstructured markdown.

The integration is broken down into five distinct AI pipelines:

#### A. Resume & System Analysis (`analyzeResume`)
* **Input**: The raw extracted string from the user's PDF resume (`pdf-parse`) and the target Job Description.
* **Mechanism**: The LLM acts as an Applicant Tracking System (ATS), parsing the dual texts to identify overlapping keywords, computing an experience match score (0-100), and isolating missing skill sets.

#### B. Dynamic Contextual Question Generation (`generateQuestions`)
* **Input**: Resume text, Job Description, and Candidate Role.
* **Mechanism**: The model hallucinates a realistic interview scenario, generating a 5-question array constrained by specific categorizations: Technical, Behavioral, and a specialized Algorithm/Coding problem specifically tuned to the user's experience level.

#### C. Real-Time Answer Evaluation (`evaluateAnswer`)
* **Input**: The specific question being asked and the user's transcribed vocal response.
* **Mechanism**: The LLM behaves as a hiring manager. It grades the response by calculating weighted numbers for `score`, `clarity`, `relevance`, and `confidence`, alongside detailed plaintext critical feedback.

#### D. Answer Refinement & Coaching (`rewriteAnswer`)
* **Input**: The user's original, potentially unorganized answer.
* **Mechanism**: Utilizing the **STAR Method (Situation, Task, Action, Result)** as a strictly enforced prompt directive, the LLM rewrites the user's answer into a highly professional, optimized response, accompanied by a list of actionable coaching tips.

#### E. Code Evaluation & Big-O Analysis (`evaluateCode`)
* **Input**: The generated algorithm problem description and the raw JavaScript string exported from the Monaco Editor.
* **Mechanism**: A Senior Software Engineer persona prompt analyzes the user's code constraint by constraint. It returns specific algorithms improvements, identifies unhandled edge-cases, and automatically calculates the Time & Space Complexity (Big-O Notation).

---

## 2. Machine Learning Integration: Speech-to-Text

To simulate the pressure and reality of live interviews, the platform integrates continuous real-time voice inference rather than relying solely on keyboard input.

### Web Speech API Inference (`App.tsx`)
Instead of proxying heavy audio blobs to an external server-side transcription service (like Whisper API), the application utilizes the native browser **Web Speech API** for ultra-low-latency Speech-to-Text inference.

* **Mechanism**: 
  The app initializes a continuous, interim-result capable `webkitSpeechRecognition` observer. As the user speaks, the local client-side ML engine transcribes the phonetic audio array into a string sequence.
* **Flow**: 
  ```javascript
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true; // Enables live-typing feedback
  recognition.onresult = (event) => {
    // Maps the ML confidence transcriptions directly into React State
    const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
    setUserAnswer(transcript);
  }
  ```
* **Advantage**: Zero API costs for audio-processing, zero-latency feedback for the user, and complete user-privacy since the raw audio stream never leaves the client device.
