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

---

## 3. Codebase Integration Mapping

Understanding how the intelligence layer flows into the active application workspace.

### A. Environment Configuration (`.env` & `package.json`)
* The core API token (`GEMINI_API_KEY`) is injected client-side by Vite.
* `npm run dev` orchestrates the local deployment, launching the frontend alongside the backend API required to parse PDF blobs securely into plaintext context for the LLM.

### B. Core Intelligence Service (`src/lib/gemini.ts`)
* Acts as the single-source-of-truth service abstraction for all direct LLM interactions. 
* All generative functionality relies on the `@google/genai` module instantiated here via: 
  `const ai = new GoogleGenAI({ apiKey: ... })`.
* Maps input payload parameters (e.g., `resumeText`, `jobDescription`, `code`) directly into strict templated prompt sequences.

### C. Backend Pre-Processing (`server.ts`)
* **Role**: Extracts vital ML context. 
* Contains the `POST /api/parse-pdf` middleware endpoint parsing uploaded PDF resumes via `pdf-parse` into clean, LLM-digestible plaintext so that Gemini can act on the candidate's exact resume history.

### D. User Interface Integration (`src/App.tsx`)
* Contains the **State Lifecycle** tying user interactions to the `gemini.ts` LLM methods.
    1. Evaluates setup text via `/api/parse-pdf`.
    2. Invokes `generateQuestions()` on-load to build the dynamic interview queue in state.
    3. Handles real-time Web Speech API transcription, feeding `transcript` state into the `<textarea>` using the `recognition.onresult` ML integration block.
    4. Triggers `evaluateAnswer()` and `rewriteAnswer()` when the user submits their vocal response.
    5. Reads text from the embedded `<Editor>` and invokes `evaluateCode()` upon algorithmic script submission.
* Passes the final evaluated JSON data (which originally came from Gemini responses) directly to the Recharts library and Firebase Firestore for historical aggregation and tracking.
