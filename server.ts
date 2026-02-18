import path from "path";
import { fileURLToPath } from "url";
import express from 'express';
import cors from 'cors';
import axios from "axios";
import { marked } from 'marked';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json() as any);


// Job System Types
interface Job {
  id: string;
  status: 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  result?: Buffer;
  error?: string;
  lastUpdated: number;
}

// In-memory job store
const jobs = new Map<string, Job>();

// Types
interface ProjectRequest {
  topic: string;
  subject: string;
  grade: string;
  pageCount: number;
  pages: number;
  difficulty: number;
  hasPractical: boolean;
  hasHypothesis: boolean;
  sourceCount: number;
  sources: number;
  studentName: string;
  school: string;
  teacher: string;
  city: string;
  year: string;
}

// Helper to update job
function updateJob(id: string, updates: Partial<Job>) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, { ...updates, lastUpdated: Date.now() });
  console.log(`[Job ${id}] Status: ${updates.status || job.status}, Progress: ${updates.progress || job.progress}%`);
}

// 1. Initiate Generation
app.post('/api/generate', (req, res) => {
  try {
    const jobId = Math.random().toString(36).substring(7);
    
    jobs.set(jobId, {
      id: jobId,
      status: 'processing',
      progress: 0,
      message: 'Инициализация проекта...',
      lastUpdated: Date.now()
    });

    console.log(`[Job ${jobId}] Started`);

    // Start background process
    generateProjectBackground(jobId, req.body);

    res.json({ jobId });
  } catch (err: any) {
    console.error("Failed to start job:", err);
    res.status(500).json({ error: "Failed to start generation" });
  }
});

// 2. Status Polling Endpoint
app.get('/api/status/:id', (req, res) => {
  const { id } = req.params;
  const job = jobs.get(id);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json({
    status: job.status,
    progress: job.progress,
    message: job.message,
    error: job.error
  });
});

// 3. Download Endpoint
app.get('/api/download/:id', (req, res) => {
  const { id } = req.params;
  const job = jobs.get(id);

  if (!job || !job.result) {
    res.status(404).send('File not found or not ready');
    return;
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="project.pdf"`);
  res.send(job.result);

  // Clean up job after download
  setTimeout(() => jobs.delete(id), 60000); 
});

// Background Generation Logic
async function generateProjectBackground(jobId: string, data: ProjectRequest) {
  let browser;
  try {

    // Artificial small delay to ensure UI can pick up the "0%" state if needed
    await new Promise(r => setTimeout(r, 500));

    updateJob(jobId, { progress: 5, message: 'Формирование структуры запроса...' });

    // 1. Construct the prompt

let difficultyInstruction = "";

if (data.difficulty <= 2) {
  difficultyInstruction = `
Уровень сложности: ПРОСТОЙ.
- Пиши максимально простым языком.
- Используй короткие предложения.
- Объясняй термины простыми словами.
- Не используй сложные научные формулировки.
`;
} else if (data.difficulty === 3) {
  difficultyInstruction = `
Уровень сложности: СРЕДНИЙ.
- Пиши обычным школьным языком.
- Используй термины, но кратко объясняй их.
- Предложения средней длины.
`;
} else {
  difficultyInstruction = `
Уровень сложности: ВЫСОКИЙ.
- Используй академический стиль.
- Применяй научные формулировки.
- Допускаются сложные предложения.
`;
}

const prompt = `
Ты генерируешь итоговый индивидуальный проект строго по требованиям ФГОС и Положению об ИИП СОШ №16.

Это должен быть ГОТОВЫЙ текст проекта, а не инструкция.

Общие требования:
- Стиль строго академический
- Без разговорной речи
- Без обращений к читателю
- Без слов "в данной работе я"
- Без маркеров и списков, кроме нумерации задач
- Объем: ${data.pages} страниц
- Уровень сложности: ${data.difficulty}/5
- Предмет: ${data.subject}
- Класс: ${data.grade}

СТРУКТУРА:

1. ВВЕДЕНИЕ
Актуальность
Проблема
Объект исследования
Предмет исследования
Цель
Задачи (пронумерованные)
Гипотеза
Методы
Практическая значимость

2. ГЛАВА I. Теоретическая часть
Подпункты 1.1, 1.2, 1.3

3. ГЛАВА II. Практическая часть
Описание исследования
Анализ результатов

4. ЗАКЛЮЧЕНИЕ

5. СПИСОК ЛИТЕРАТУРЫ
Минимум ${data.sources} источников
Оформление по ГОСТ 7.1-2003
Алфавитный порядок
Нумерация

Тема проекта: ${data.topic}
`;



    updateJob(jobId, { progress: 10, message: 'Консультация с ИИ (написание текста)...' });

    // 2. Call OpenRouter API
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY is not defined");
}

const response = await axios.post(
  "https://openrouter.ai/api/v1/chat/completions",
  {
    model: "openai/gpt-4o-mini",
    messages: [
      { role: "user", content: prompt }
    ]
  },
  {
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    }
  }
);


const markdownContent = response.data.choices[0].message.content;

    updateJob(jobId, { progress: 45, message: 'Обработка ответа от нейросети...' });

    if (!markdownContent) throw new Error("Empty response from AI");
    
    updateJob(jobId, { progress: 55, message: 'Преобразование в академический формат...' });

    // 3. Convert Markdown to HTML
    let cleanMarkdown = markdownContent
  .replace(/\\rightarrow/g, '→')
  .replace(/C_3H_5/g, 'C3H5')
  .replace(/C_{12}H_{25}/g, 'C12H25')
  .replace(/_/g, '')
  .replace(/[{}]/g, '');

const bodyHtml = await marked.parse(cleanMarkdown);

    // 4. Construct Full HTML with Strict Academic Styling
    const titlePage = `
<div style="text-align:center; margin-top:120px; font-family: 'Times New Roman';">

<p>Муниципальное бюджетное общеобразовательное учреждение</p>
<p>${data.school || 'Средняя общеобразовательная школа'}</p>

<br><br><br>

<h1 style="font-size:20px; font-weight:bold;">${data.topic}</h1>

<br><br><br>

<p>Проект по предмету: ${data.subject}</p>

<br><br>

<p>Выполнил:</p>
<p>${data.studentName || 'ФИО ученика'}</p>
<p>Ученик ${data.grade} класса</p>

<br><br>

<p>Руководитель:</p>
<p>${data.teacher || 'ФИО руководителя'}</p>

<br><br><br><br>

<p>${data.city || ''}</p>
<p>${data.year || new Date().getFullYear()}</p>

</div>

<div style="page-break-after: always;"></div>
`;

const fullHtml = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
@page {
  size: A4;
  margin: 2cm;
}

body {
  font-family: "Times New Roman";
  font-size: 14px;
  line-height: 1.5;
}

h1 {
  text-align: center;
  font-size: 18px;
  margin-top: 30px;
  page-break-before: always;
}

h1:first-of-type {
  page-break-before: auto;
}



h2 {
  margin-top: 30px;
}

h3 {
  margin-top: 20px;
}

p {
  text-align: justify;
  text-indent: 1.25cm;
  margin: 10px 0;
}

</style>
</head>
<body>

${titlePage}

${bodyHtml}

</body>
</html>
`;

    updateJob(jobId, { progress: 70, message: 'Подготовка к печати PDF...' });

    // 5. Generate PDF
    browser = await puppeteer.launch({
            headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    updateJob(jobId, { progress: 80, message: 'Рендеринг документа...' });

    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    updateJob(jobId, { progress: 90, message: 'Финальная сборка файла...' });

    // Generate PDF with page numbers
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '2cm', bottom: '2cm', left: '2cm', right: '2cm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>', // No header
      footerTemplate: `
        <div style="font-size: 10pt; font-family: 'Times New Roman'; width: 100%; text-align: center; padding-bottom: 10px;">
          <span class="pageNumber"></span>
        </div>
      `,
      timeout: 30000
    });

    const buffer = Buffer.from(pdfBuffer);

    updateJob(jobId, { 
      progress: 100, 
      status: 'completed', 
      message: 'Готово!', 
      result: buffer 
    });
    
    console.log(`[Job ${jobId}] Completed successfully`);

  } catch (error) {
    console.error(`[Job ${jobId}] Failed:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    updateJob(jobId, { 
      status: 'error', 
      error: errorMessage || 'Server Error', 
      message: 'Произошла ошибка при генерации' 
    });
  } finally {
    if (browser) await browser.close();
  }
}
// ===== Serve React build in production =====
app.use(express.static(path.join(__dirname, "../dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});