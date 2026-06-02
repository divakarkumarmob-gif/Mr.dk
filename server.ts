import express from "express";
import { createServer as createViteServer } from "vite";
import * as path from "path";
import dotenv from "dotenv";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { openai } from "./src/lib/openrouter";


const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const logs: string[] = [];

dotenv.config();

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const PORT = 3000;
  
  app.use(express.json({ limit: '10mb' }));
  app.use(cors({ origin: "https://neetmaster.vercel.app" }));
  app.use("/api/", limiter);

  app.get("/api/logs", (req, res) => {
      res.json({ logs });
  });
  
  app.post("/api/ask", async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }
    try {
            const completion = await openai.chat.completions.create({
            model: "openai/gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
        });
        res.json({ text: completion.choices[0].message.content });
    } catch (error) {
        console.error("Ask API Error:", error);
        res.status(500).json({ error: "Failed to get AI response" });
    }
  });

  // API route for gemini
  app.post("/api/gemini", async (req, res) => {
      const { base64Audio, base64Image, prompt } = req.body;                
      if (!prompt) {
          return res.status(400).json({ error: "Missing prompt" });
      }

      
      try {
          const contents: any[] = [];
          if (base64Audio) {
              contents.push({ inlineData: { data: base64Audio, mimeType: "audio/webm" } });
          }
          if (base64Image) {
              contents.push({ inlineData: { data: base64Image.split(',')[1], mimeType: "image/jpeg" } });
          }
          contents.push({ text: prompt });

          const completion = await openai.chat.completions.create({
              model: "openai/gpt-3.5-turbo",
              messages: [{
                  role: "user",
                  content: prompt
              }]
          });
          
          res.json({ text: completion.choices[0].message.content });
      } catch (error) {
          console.error("OpenAI API Error:", error);
          res.status(500).json({ error: "Failed to get AI response: " + (error instanceof Error ? error.message : String(error)) });
      }
  });                


    // API route for analysis
    app.post("/api/analysis", async (req, res) => {
        const { questions, answers } = req.body;
        if (!questions || !answers) {
          return res.status(400).json({ error: "Missing data" });
        }
    
        const prompt = `
            Analyze the following student test results carefully:
            - Total Questions: ${questions.length}
            - Correct: ${Object.values(answers).filter((a: any, idx: number) => a === questions[idx].correct_option).length}
            - Incorrect: ${Object.values(answers).filter((a: any, idx: number) => a && a !== questions[idx].correct_option).length}
            - Unattempted: ${questions.length - Object.keys(answers).length}
            
            Based on this, provide:
            1. A comprehensive performance summary (in Hinglish).
            2. Breakdown of strong and weak areas.
            3. Strategic, personalized advice on how to improve scores.
            
            Student Answers and Questions for reference: ${JSON.stringify(questions)}, ${JSON.stringify(answers)}
        `;
        
        try {
            const completion = await openai.chat.completions.create({
              model: "openai/gpt-3.5-turbo",
              messages: [{ role: "user", content: prompt }]
            });
            res.json({ analysis: completion.choices[0].message.content });
        } catch (error) {
            console.error("Analysis API Error:", error);
            res.status(500).json({ error: "Failed to get analysis: " + (error instanceof Error ? error.message : String(error)) });
        }
    });

    // API route for tutor
    app.post("/api/tutor", async (req, res) => {
        const { messages } = req.body;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return res.status(400).json({ error: "Missing messages" });
        }
        
        const lastMessage = messages[messages.length - 1].content;
        
        try {
            // 1. Identify the chapter
            const chapterCompletion = await openai.chat.completions.create({
                model: "openai/gpt-3.5-turbo",
                messages: [
                    { role: "system", content: "You are a chapter classifier. Given a question, identify the most relevant chapter from a NEET biology/physics/chemistry syllabus. Answer ONLY the chapter name. If unsure, reply 'General'." },
                    { role: "user", content: lastMessage }
                ]
            });
            
            const chapter = chapterCompletion.choices[0].message.content || "General";
            console.log(`Detected chapter: ${chapter}`);

            // 2. Answer based on the chapter
            const completion = await openai.chat.completions.create({
              model: "openai/gpt-3.5-turbo",
              messages: [{ 
                  role: "system", 
                  content: `You are a NEET tutor.\n\nYou are answering a question related to: ${chapter}.\n\nRules:\n- Follow NCERT strictly (class 11th and 12th physics, chemistry, and biology).\n- Answer strictly according to NCERT lines for the detected chapter.\n- Avoid hallucinations.\n- Keep answers concise.\n- Explain simply.\n- If unsure, admit uncertainty.\n- Focus only on NEET syllabus.\n- Use numbered lists (1-, 2-, 3-) for any steps or structured information.\n- Wrap any important NEET-related information in <u></u> tags.` 
              }, ...messages.map(m => ({
                  role: m.role === 'assistant' ? 'assistant' : 'user',
                  content: m.content
              }))]
            });
            res.json({ reply: completion.choices[0].message.content });
        } catch (error) {
            console.error("OpenAI API Error:", error);
            res.status(500).json({ error: "Failed to get AI response: " + (error instanceof Error ? error.message : String(error)) });
        }
    });

  // API route for neural chat
  app.post("/api/neural-chat", async (req, res) => {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing messages" });
    }
    
    const lastMessage = messages[messages.length - 1].content;
    
    try {
        // 1. Identify the chapter
        const chapterCompletion = await openai.chat.completions.create({
            model: "openai/gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are a chapter classifier. Given a question, identify the most relevant chapter from a NEET biology/physics/chemistry syllabus. Answer ONLY the chapter name. If unsure, reply 'General'." },
                { role: "user", content: lastMessage }
            ]
        });
        
        const chapter = chapterCompletion.choices[0].message.content || "General";
        console.log(`Detected chapter for neural-chat: ${chapter}`);

        // 2. Answer based on the chapter
        const completion = await openai.chat.completions.create({
            model: "openai/gpt-3.5-turbo",
            messages: [
                { role: "system", content: `You are a friendly, approachable, and natural-sounding AI assistant. You talk like a close human friend, keeping conversations casual, engaging, and easy to relate to. Avoid stiff, overly formal, or robotic language. When asked academic or educational questions, ensure your answers are accurate and adhere to the NCERT curriculum. 
                
                You are currently helping the user with a question related to: ${chapter}.
                
                Rules:
                - Follow NCERT strictly.
                - Answer according to NCERT lines for the detected chapter.
                - Use numbered lists (1-, 2-, 3-) for any steps or structured information.
                - Wrap any important NEET-related information in <u></u> tags (these will be highlighted).` },
                ...messages.map(m => ({
                    role: m.role === 'assistant' ? 'assistant' : 'user',
                    content: m.content
                }))
            ]
        });
      
      res.json({ reply: completion.choices[0].message.content });
    } catch (error) {
      console.error("OpenAI API Error:", error);
      res.status(500).json({ error: "Failed to get AI response: " + (error instanceof Error ? error.message : String(error)) });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
