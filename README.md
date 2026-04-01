<div align="center">
  <img src="/public/logo.png" alt="Logo" width="100" height="100" />
  <h1>🚀 Smart Interview AI</h1>
  <p>An intelligent, full-stack Mock Interview application powered by Google's Gemini 2.5 Flash API.</p>
</div>

---

## 📖 Overview

Smart Interview AI is a comprehensive platform designed to help candidates prepare for their dream jobs. By analyzing a user's resume against a target job description, the application dynamically generates highly relevant technical, behavioral, and coding questions. Users can practice their answers using voice-to-text, solve code challenges in a live editor, and receive instant, actionable feedback from an AI coach.

## 🛠 Tech Stack

### Frontend
- **React 19 & Vite**: Ultra-fast dev environment and modern component rendering.
- **Tailwind CSS v4**: Beautiful, utility-first styling with modern UI/UX design.
- **Framer Motion**: Fluid animations and UI transitions.
- **Recharts**: Dynamic, reactive charts for the Performance Analytics dashboard.
- **Monaco Editor**: VS Code-powered embedded code editor for the interactive coding challenges.

### Backend & AI
- **Google Gemini API**: Utilizing the `gemini-2.5-flash` model for hyper-fast intelligent question generation, answer evaluation, and robust code analysis.
- **Firebase Authentication**: Secure Google OAuth login.
- **Firebase Firestore**: Cloud NoSQL database to store user progress, interview history, and analytics.
- **Express.js & Node.js**: Custom backend API designed exclusively for secure, server-side PDF Resume parsing (using `pdf-parse` & `multer`).

---

## 🔄 Application Flow

1. **🔒 Authentication**
   - Users sign in securely using their Google Account via Firebase Auth.
2. **📝 Interview Setup & Resume Parsing**
   - The user provides their target **Job Role** and pastes the **Job Description**.
   - They upload their **Resume as a PDF**. The Express backend seamlessly extracts the text payload.
3. **🧠 AI Question Generation**
   - Gemini analyzes the Resume vs. the Job Description and generates 5 highly targeted questions (Technical, Behavioral, HR, and Coding).
4. **🎙️ Voice-Activated Interview Process**
   - Users navigate through the questions answering via their microphone (using the Web Speech API).
   - Gemini evaluates the transcribed response, provides a score out of 100, gives detailed feedback, and outputs a professional "Improved Answer".
5. **💻 Coding Challenge**
   - Users are presented with a role-specific algorithm challenge.
   - They write and submit a solution using the built-in Monaco Code Editor. The AI conducts Big-O analysis and syntax checking on their code.
6. **📊 Results & Analytics Dashboard**
   - A final report is generated comparing scores across all modules.
   - All data is synced to Firestore, populating the user's **Performance Dashboard** with historical trend charts and role-based performance metrics.

---

## 💻 Local Development

**Prerequisites:** Node.js (v18+)

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Configure Environment Variables:
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. Configure Firebase:
   Edit `firebase-applet-config.json` and `src/firebase.ts` with your active Firebase project credentials. Ensure Firestore and Authentication are enabled.

4. Start the Application:
   ```bash
   npm run dev
   ```
   *This single command will intelligently boot both the Vite Frontend and the Node/Express PDF Parsing Backend simultaneously.*
