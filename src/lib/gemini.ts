import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeResume(resumeText: string, jobDescription: string) {
  const model = "gemini-2.5-flash";
  const prompt = `
    Analyze the following resume against the job description.
    Resume: ${resumeText}
    Job Description: ${jobDescription}
    
    Extract:
    1. Key skills found in resume.
    2. Missing skills required for the job.
    3. Experience match level (0-100).
    4. Strengths and weaknesses.
    
    Return the result in JSON format.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          matchScore: { type: Type.NUMBER },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["skills", "missingSkills", "matchScore", "strengths", "weaknesses"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function generateQuestions(resumeText: string, jobDescription: string, role: string) {
  const model = "gemini-2.5-flash";
  const prompt = `
    Generate 5 interview questions for the role of ${role} based on the resume and job description.
    Resume: ${resumeText}
    Job Description: ${jobDescription}
    
    Include:
    - 2 Technical questions
    - 2 Behavioral/HR questions
    - 1 Coding/Problem-solving question
    
    Return the questions in JSON format as an array of objects with 'text' and 'type' (technical, hr, behavioral).
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["technical", "hr", "behavioral"] },
          },
          required: ["text", "type"],
        },
      },
    },
  });

  return JSON.parse(response.text || "[]");
}

export async function evaluateAnswer(question: string, answer: string) {
  const model = "gemini-2.5-flash";
  const prompt = `
    Evaluate the following interview answer for the given question.
    Question: ${question}
    Answer: ${answer}
    
    Provide:
    1. Score (0-100)
    2. Feedback (detailed)
    3. Clarity score (0-10)
    4. Relevance score (0-10)
    5. Confidence score (0-10)
    
    Return the result in JSON format.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          feedback: { type: Type.STRING },
          clarity: { type: Type.NUMBER },
          relevance: { type: Type.NUMBER },
          confidence: { type: Type.NUMBER },
        },
        required: ["score", "feedback", "clarity", "relevance", "confidence"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}



export async function rewriteAnswer(userAnswer: string) {
  const model = "gemini-2.5-flash";
  const prompt = `
    Act as a Professional Interview Coach.
    Improve the following interview answer to make it more professional, structured, and technically strong.
    
    Guidelines:
    - Use the STAR method (Situation, Task, Action, Result) if the answer is behavioral.
    - Enhance technical vocabulary and clarity.
    - Keep the tone confident and professional.
    - Ensure the answer is concise but comprehensive.
    
    Original Answer: ${userAnswer}
    
    Return:
    1. Improved answer (the full rewritten answer).
    2. List of key improvements/tips (why this version is better).
    
    Return the result in JSON format.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          improvedAnswer: { type: Type.STRING },
          tips: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["improvedAnswer", "tips"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function evaluateCode(problemDescription: string, userCode: string) {
  const model = "gemini-2.5-flash";
  const prompt = `
    Act as a Senior Software Engineer conducting a technical interview.
    Evaluate the following coding solution for the given problem.
    
    Problem: ${problemDescription}
    Code: ${userCode}
    
    Tasks:
    1. Analyze time and space complexity (Big O notation).
    2. Suggest specific improvements for readability, efficiency, and best practices.
    3. Provide a score (0-100) based on correctness, efficiency, and code quality.
    4. List potential edge cases the code might miss (e.g., empty input, large values, null checks).
    
    Return the result in JSON format.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          complexity: { type: Type.STRING },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          score: { type: Type.NUMBER },
          edgeCases: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["complexity", "suggestions", "score", "edgeCases"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

