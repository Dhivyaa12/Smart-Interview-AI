import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  db 
} from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  doc, 
  setDoc,
  getDoc,
  getDocs,
  Timestamp,
  getDocFromServer,
  limit
} from 'firebase/firestore';
import { getDocFromServer as getDocFromServerDirect } from 'firebase/firestore';
import { 
  analyzeResume, 
  generateQuestions, 
  evaluateAnswer,
  rewriteAnswer,
  evaluateCode
} from './lib/gemini';
import { 
  Mic, 
  MicOff, 
  Send, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  User as UserIcon,
  LogOut,
  ChevronRight,
  BarChart3,
  MessageSquare,
  Trophy,
  Code,
  LayoutDashboard,
  FileText,
  Target,
  Sparkles,
  Play,
  History as HistoryIcon,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from './lib/utils';
import Editor from "@monaco-editor/react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

// --- Types ---
interface Interview {
  id: string;
  userId: string;
  role: string;
  jobDescription: string;
  resumeText: string;
  status: 'pending' | 'in-progress' | 'completed';
  overallScore?: number;
  createdAt: any;
}

interface Question {
  id: string;
  text: string;
  type: 'technical' | 'hr' | 'behavioral';
  order: number;
}

interface Answer {
  id: string;
  questionId: string;
  answerText: string;
  score: number;
  feedback: string;
  improvedAnswer?: string;
  clarity: number;
  relevance: number;
  confidence: number;
}



// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Application Error</h2>
          <p className="text-slate-500 max-w-md mb-8">{errorMessage}</p>
          <Button onClick={() => window.location.reload()}>Reload Application</Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Components ---

const Button = ({ className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' }) => {
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100",
    secondary: "bg-slate-900 text-white hover:bg-slate-800",
    outline: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100"
  };
  
  return (
    <button 
      className={cn(
        "px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2",
        variants[variant],
        className
      )} 
      {...props} 
    />
  );
};

const Card = ({ children, className, onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn("bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden", className, onClick && "cursor-pointer")}
  >
    {children}
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'auth' | 'setup' | 'interview' | 'coding' | 'results' | 'dashboard'>('auth');
  
  // Setup State
  const [role, setRole] = useState('');
  const [jd, setJd] = useState('');
  const [resume, setResume] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Interview State
  const [currentInterviewId, setCurrentInterviewId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  
  // Coding State
  const [codingProblem, setCodingProblem] = useState<any>(null);
  const [code, setCode] = useState('// Write your solution here\nfunction solution() {\n  \n}');
  const [codingFeedback, setCodingFeedback] = useState<any>(null);
  const [isCodingEvaluating, setIsCodingEvaluating] = useState(false);

  // Dashboard State
  const [history, setHistory] = useState<any[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Speech Recognition
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServerDirect(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        setStep('setup');
        syncUser(u);
        fetchHistory(u.uid);
      } else {
        setStep('auth');
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      seedCodingProblems();
    }
  }, [user]);

  const seedCodingProblems = async () => {
    const q = query(collection(db, 'codingProblems'), limit(1));
    onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        const problems = [
          {
            title: "Two Sum",
            difficulty: "Easy",
            description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.",
            role: "Software Engineer"
          },
          {
            title: "Reverse Linked List",
            difficulty: "Easy",
            description: "Given the `head` of a singly linked list, reverse the list, and return the reversed list.",
            role: "Backend Developer"
          },
          {
            title: "Custom Hook: useDebounce",
            difficulty: "Medium",
            description: "Implement a custom React hook `useDebounce` that delays updating a value until a specified time has passed.",
            role: "Frontend Developer"
          }
        ];
        for (const p of problems) {
          await addDoc(collection(db, 'codingProblems'), p);
        }
      }
    });
  };

  const fetchCodingProblem = async () => {
    const q = query(collection(db, 'codingProblems'), limit(10));
    onSnapshot(q, (snapshot) => {
      const problems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Try to find a problem matching the role, otherwise pick random
      const matched = problems.find((p: any) => p.role?.toLowerCase().includes(role.toLowerCase()));
      setCodingProblem(matched || problems[Math.floor(Math.random() * problems.length)]);
    });
  };

  useEffect(() => {
    if (step === 'coding') {
      fetchCodingProblem();
    }
  }, [step]);

  const syncUser = async (u: FirebaseUser) => {
    const userRef = doc(db, 'users', u.uid);
    try {
      await setDoc(userRef, {
        uid: u.uid,
        displayName: u.displayName,
        email: u.email,
        createdAt: Timestamp.now()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${u.uid}`);
    }
  };

  const fetchHistory = (uid: string) => {
    // Remove orderBy to avoid requiring a composite index from Firebase Console. Sort on client instead.
    const q = query(collection(db, 'interviews'), where('userId', '==', uid), limit(50));
    onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort descending by createdAt
      data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setHistory(data.slice(0, 10)); // Keep only top 10 most recent
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'interviews');
    });
  };

  const loadHistoricalInterview = async (interviewId: string) => {
    setCurrentInterviewId(interviewId);
    setStep('results');
    setAnswers([]);
    setQuestions([]);
    
    try {
      // Fetch questions without complex queries to bypass composite index needs
      const qSnap = await getDocs(collection(db, `interviews/${interviewId}/questions`));
      const fetchedQs = qSnap.docs.map(d => ({ id: d.id, ...d.data() } as Question));
      fetchedQs.sort((a,b) => a.order - b.order);
      setQuestions(fetchedQs);
      
      // Fetch answers
      const ansSnap = await getDocs(collection(db, `interviews/${interviewId}/answers`));
      const fetchedAns = ansSnap.docs.map(d => ({ id: d.id, ...d.data() } as Answer));
      fetchedAns.sort((a,b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setAnswers(fetchedAns);
    } catch (err) {
      console.error("Failed to load historical interview", err);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/parse-pdf', { method: 'POST', body: formData });
        const data = await res.json();
        setResume(data.text);
      } catch (err) {
        console.error("PDF parsing failed", err);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => setResume(e.target?.result as string);
      reader.readAsText(file);
    }
  };

  const startInterview = async () => {
    setIsAnalyzing(true);
    try {
      const interviewRef = await addDoc(collection(db, 'interviews'), {
        userId: user?.uid,
        role,
        jobDescription: jd,
        resumeText: resume,
        status: 'in-progress',
        createdAt: Timestamp.now()
      });

      const generatedQs = await generateQuestions(resume, jd, role);
      const qPromises = generatedQs.map((q: any, index: number) => 
        addDoc(collection(db, `interviews/${interviewRef.id}/questions`), {
          ...q,
          order: index,
          interviewId: interviewRef.id
        })
      );
      
      const qDocs = await Promise.all(qPromises);
      setQuestions(generatedQs.map((q: any, i: number) => ({ ...q, id: qDocs[i].id })));
      setCurrentInterviewId(interviewRef.id);
      setStep('interview');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'interviews');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const submitAnswer = async () => {
    if (!userAnswer || isEvaluating) return;
    setIsEvaluating(true);
    try {
      const currentQ = questions[currentQuestionIndex];
      const evaluation = await evaluateAnswer(currentQ.text, userAnswer);
      const improvement = await rewriteAnswer(userAnswer);
      
      const answerData = {
        interviewId: currentInterviewId,
        questionId: currentQ.id,
        answerText: userAnswer,
        ...evaluation,
        improvedAnswer: improvement.improvedAnswer,
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, `interviews/${currentInterviewId}/answers`), answerData);
      setAnswers([...answers, answerData]);
      setUserAnswer('');

      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        setStep('coding');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `interviews/${currentInterviewId}/answers`);
    } finally {
      setIsEvaluating(false);
    }
  };

  const evaluateCodingChallenge = async () => {
    setIsCodingEvaluating(true);
    try {
      const feedback = await evaluateCode(codingProblem.description, code);
      setCodingFeedback(feedback);
      await completeInterview(feedback.score);
    } catch (err) {
      console.error("Coding evaluation failed", err);
    } finally {
      setIsCodingEvaluating(false);
    }
  };

  const completeInterview = async (codingScore?: number) => {
    if (!currentInterviewId) return;
    const interviewAvg = answers.reduce((acc, curr) => acc + curr.score, 0) / answers.length;
    const finalScore = codingScore ? (interviewAvg * 0.7 + codingScore * 0.3) : interviewAvg;
    
    try {
      await setDoc(doc(db, 'interviews', currentInterviewId), {
        status: 'completed',
        overallScore: finalScore
      }, { merge: true });

      // Store progress
      await addDoc(collection(db, 'userProgress'), {
        userId: user?.uid,
        interviewId: currentInterviewId,
        score: finalScore,
        date: Timestamp.now(),
        weakAreas: answers.filter(a => a.score < 70).map(a => a.feedback.substring(0, 50)),
        improvementTags: [role]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'userProgress');
    }

    setStep('results');
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join('');
        setUserAnswer(transcript);
      };
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setStep('setup')}>
          <img src="/logo.png" alt="Smart Interview AI Logo" className="w-10 h-10 object-contain rounded-full shadow-lg border-2 border-slate-100" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <h1 className="text-xl font-bold tracking-tight">Smart Interview AI</h1>
        </div>
        {user && (
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setStep('dashboard')} className="hidden sm:flex">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
              <UserIcon className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium">{user.displayName}</span>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {step === 'auth' && (
            <motion.div key="auth" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-20 text-center">
              <h2 className="text-5xl font-extrabold mb-6 tracking-tight">Master Your Next Interview</h2>
              <p className="text-slate-500 max-w-lg text-lg mb-10 leading-relaxed">
                The all-in-one AI platform for placement preparation. Analyze resumes, practice coding, and get expert feedback.
              </p>
              <Button onClick={handleLogin} className="px-10 py-5 text-xl">
                <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
                Sign in with Google
              </Button>
            </motion.div>
          )}

          {step === 'setup' && (
            <motion.div key="setup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold shadow-lg">1</div>
                  <h2 className="text-3xl font-bold">Interview Setup</h2>
                </div>

                <Card className="p-8 space-y-8">
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Target className="w-4 h-4" /> Target Job Role
                    </label>
                    <input type="text" placeholder="e.g. Full Stack Developer" className="w-full px-5 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-lg" value={role} onChange={(e) => setRole(e.target.value)} />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Job Description
                    </label>
                    <textarea placeholder="Paste the JD here..." className="w-full h-40 px-5 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none" value={jd} onChange={(e) => setJd(e.target.value)} />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Upload className="w-4 h-4" /> Resume (PDF or Text)
                    </label>
                    <div className="flex gap-4">
                      <textarea placeholder="Paste resume text..." className="flex-1 h-40 px-5 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none" value={resume} onChange={(e) => setResume(e.target.value)} />
                      <div className="w-32 flex flex-col gap-2">
                        <label className="w-full h-full border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                          <Upload className="w-6 h-6 text-slate-400" />
                          <span className="text-xs font-bold text-slate-400 mt-2">Upload PDF</span>
                          <input type="file" className="hidden" accept=".pdf,.txt" onChange={handleFileUpload} />
                        </label>
                      </div>
                    </div>
                  </div>

                  <Button onClick={startInterview} disabled={!role || !jd || !resume || isAnalyzing} className="w-full py-5 text-xl">
                    {isAnalyzing ? <><Loader2 className="w-6 h-6 animate-spin" /> Preparing Interview...</> : <><Sparkles className="w-6 h-6" /> Start Interview</>}
                  </Button>
                </Card>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-2"><HistoryIcon className="w-5 h-5 text-indigo-600" /> Recent Activity</h3>
                {history.map((item) => (
                  <Card key={item.id} className="p-4 hover:border-indigo-200 transition-all cursor-pointer" onClick={() => loadHistoricalInterview(item.id)}>
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-bold text-slate-800">{item.role}</p>
                      {item.status === 'completed' ? (
                          <span className="text-xs font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded uppercase tracking-tighter">{Math.round(item.overallScore || 0)}%</span>
                      ) : (
                          <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded uppercase tracking-tighter">In Prog</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}</p>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}



          {step === 'interview' && (
            <motion.div key="interview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl font-black shadow-lg">
                    {currentQuestionIndex + 1}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Question {currentQuestionIndex + 1} of {questions.length}</h2>
                    <p className="text-sm text-slate-400 font-medium uppercase tracking-widest">{questions[currentQuestionIndex]?.type} Round</p>
                  </div>
                </div>
                <div className="w-48 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }} />
                </div>
              </div>

              <Card className="p-12 text-center bg-indigo-50/50 border-indigo-100">
                <p className="text-3xl font-medium text-slate-800 leading-relaxed italic">
                  "{questions[currentQuestionIndex]?.text}"
                </p>
              </Card>

              <div className="space-y-4">
                <div className="relative group">
                  <textarea placeholder="Your answer..." className="w-full h-64 px-8 py-8 rounded-3xl border border-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-xl leading-relaxed shadow-inner" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} />
                  <div className="absolute bottom-6 right-6 flex gap-3">
                    <button onClick={toggleListening} className={cn("p-4 rounded-2xl transition-all shadow-lg", isListening ? "bg-red-500 text-white animate-pulse" : "bg-white text-slate-600 hover:bg-slate-50")}>
                      {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>
                  </div>
                </div>

                <Button onClick={submitAnswer} disabled={!userAnswer || isEvaluating} className="w-full py-6 text-xl">
                  {isEvaluating ? <><Loader2 className="w-6 h-6 animate-spin" /> Evaluating...</> : <><Send className="w-6 h-6" /> Submit Answer</>}
                </Button>
              </div>
            </motion.div>
          )}

          {step === 'coding' && codingProblem && (
            <motion.div key="coding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Code className="w-8 h-8 text-indigo-600" />
                  <h2 className="text-3xl font-bold">Coding Round</h2>
                </div>
                <Button variant="outline" onClick={() => completeInterview()}>Skip Coding</Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
                <Card className="p-8 space-y-6 overflow-y-auto bg-slate-900 text-slate-300 border-none">
                  <h3 className="text-xl font-bold text-white">{codingProblem.title}</h3>
                  <div className="prose prose-invert max-w-none">
                    <p className="text-indigo-400 font-bold uppercase tracking-widest text-xs">{codingProblem.difficulty}</p>
                    <Markdown>{codingProblem.description}</Markdown>
                  </div>
                  {codingFeedback && (
                    <div className="mt-8 p-6 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-indigo-400">AI Feedback</h4>
                        <span className="text-2xl font-black text-indigo-400">{codingFeedback.score}%</span>
                      </div>
                      <p className="text-sm text-indigo-200">Complexity: {codingFeedback.complexity}</p>
                      <ul className="text-xs space-y-2 text-indigo-300">
                        {codingFeedback.suggestions.map((s: string, i: number) => <li key={i}>• {s}</li>)}
                      </ul>
                    </div>
                  )}
                </Card>

                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-2xl">
                  <Editor height="100%" defaultLanguage="javascript" theme="vs-dark" value={code} onChange={(v) => setCode(v || '')} options={{ fontSize: 16, minimap: { enabled: false } }} />
                </div>
              </div>

              <Button onClick={evaluateCodingChallenge} disabled={isCodingEvaluating} className="w-full py-6 text-xl">
                {isCodingEvaluating ? <><Loader2 className="w-6 h-6 animate-spin" /> Evaluating Code...</> : <><Play className="w-6 h-6" /> Submit Code</>}
              </Button>
            </motion.div>
          )}

          {step === 'results' && (
            <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 bg-green-100 text-green-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-green-100 rotate-3">
                  <Trophy className="w-12 h-12" />
                </div>
                <h2 className="text-4xl font-black tracking-tight">Interview Report</h2>
                <p className="text-slate-500 text-lg">Detailed analysis of your performance across all rounds.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-8 text-center bg-indigo-600 text-white border-none shadow-2xl shadow-indigo-200">
                  <p className="text-indigo-100 text-xs font-black uppercase tracking-widest mb-2">Final Score</p>
                  <p className="text-7xl font-black">{Math.round(answers.reduce((a, c) => a + c.score, 0) / (answers.length || 1))}</p>
                  <p className="text-indigo-200 text-sm mt-4">Top 15% of candidates</p>
                </Card>
                <Card className="p-8 text-center flex flex-col justify-center">
                  <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Communication</p>
                  <p className="text-5xl font-black text-slate-800">{Math.round(answers.reduce((a, c) => a + c.clarity, 0) / (answers.length || 1))}/10</p>
                </Card>
                <Card className="p-8 text-center flex flex-col justify-center">
                  <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Technical Depth</p>
                  <p className="text-5xl font-black text-slate-800">{Math.round(answers.reduce((a, c) => a + c.relevance, 0) / (answers.length || 1))}/10</p>
                </Card>
              </div>

              <div className="space-y-8">
                <h3 className="text-2xl font-bold flex items-center gap-3"><MessageSquare className="w-6 h-6 text-indigo-600" /> Question Breakdown</h3>
                {answers.map((ans, i) => (
                  <div key={i} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="p-8 space-y-4 border-l-4 border-l-indigo-600">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Question {i + 1}</span>
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-black">{ans.score}%</span>
                      </div>
                      <p className="text-lg font-bold text-slate-800">"{questions[i]?.text}"</p>
                      <div className="p-5 bg-slate-50 rounded-2xl text-sm text-slate-600 leading-relaxed italic">
                        "{ans.answerText}"
                      </div>
                      <div className="pt-4 border-t border-slate-100">
                        <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">AI Feedback</h5>
                        <div className="text-sm text-slate-600 leading-relaxed">
                          <Markdown>{ans.feedback}</Markdown>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-8 bg-indigo-900 text-indigo-100 border-none shadow-xl relative group">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-indigo-400" />
                          <h4 className="font-bold text-white uppercase tracking-widest text-sm">AI Improved Answer</h4>
                        </div>
                        <button 
                          onClick={() => copyToClipboard(ans.improvedAnswer || '', i)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-indigo-300 hover:text-white"
                          title="Copy to clipboard"
                        >
                          {copiedIndex === i ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <Markdown>{ans.improvedAnswer || "Generating improvement..."}</Markdown>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setStep('setup')} className="flex-1 py-5">Try Another Role</Button>
                <Button onClick={() => setStep('dashboard')} className="flex-1 py-5">View Progress Dashboard</Button>
              </div>
            </motion.div>
          )}

          {step === 'dashboard' && (() => {
            const completedInterviews = history.filter(item => item.status === 'completed' && typeof item.overallScore === 'number');
            const chartData = completedInterviews.map(item => ({
              date: item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 'N/A',
              score: Math.round(item.overallScore || 0),
              role: item.role || 'Unknown'
            }));

            return (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold">Performance Analytics</h2>
                <Button variant="outline" onClick={() => setStep('setup')}>Back to Practice</Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="p-8 space-y-6">
                  <h3 className="font-bold text-slate-800">Score Trend</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData.slice().reverse()}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                        <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={12} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={4} dot={{ r: 6, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-8 space-y-6">
                  <h3 className="font-bold text-slate-800">Role Breakdown</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="role" stroke="#94a3b8" fontSize={10} />
                        <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={12} />
                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="score" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-bold">Interview History</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {history.map((item) => (
                    <Card key={item.id} className="p-6 hover:shadow-md transition-all cursor-pointer" onClick={() => loadHistoricalInterview(item.id)}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                          <FileText className="w-5 h-5 text-slate-500" />
                        </div>
                        {item.status === 'completed' ? (
                           <span className="text-lg font-black text-indigo-600">{Math.round(item.overallScore || 0)}%</span>
                        ) : (
                           <span className="text-sm font-bold text-slate-400">In Progress</span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-800">{item.role}</h4>
                      <p className="text-xs text-slate-400 mt-1">{item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleString() : 'Just now'}</p>
                    </Card>
                  ))}
                </div>
              </div>
            </motion.div>
            );
          })()}
        </AnimatePresence>
      </main>
    </div>
  );
}
