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
  difficulty: number;
  hasPractical: boolean;
  hasHypothesis: boolean;
  sourceCount: number;
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
Напиши полноценный школьный исследовательский проект
по предмету "${data.subject}"
на тему "${data.topic}"
для ученика ${data.grade} класса.

${difficultyInstruction}

Это должен быть готовый проект.
Это НЕ инструкция.
Это НЕ пример оформления.
Это полноценный текст работы.

Строгая структура:

# ${data.topic}

## Введение

### 1. Актуальность
### 2. Проблема исследования
### 3. Цель работы
### 4. Задачи исследования
### 5. Гипотеза

## Глава 1. Теоретическая часть

### 1.1 Основные понятия
### 1.2 Научное объяснение
### 1.3 Анализ теории

## Глава 2. Практическая часть

### 2.1 Цель опыта
### 2.2 Оборудование
### 2.3 Ход работы
### 2.4 Результаты
### 2.5 Вывод

## Заключение

## Список литературы

Требования:
- Пиши связный текст.
- Не вставляй инструкции.
- Не объясняй как оформлять работу.
- Не пиши "пример".
- В списке литературы укажи ${data.sourceCount} реальных источников.
- Список литературы оформи нумерованным списком.
`;


    updateJob(jobId, { progress: 10, message: 'Консультация с ИИ (написание текста)...' });

    // 2. Call OpenRouter API
const response = await axios.post(
  "https://openrouter.ai/api/v1/chat/completions",
  {
    model: "mistralai/mistral-7b-instruct",
    messages: [
      { role: "user", content: prompt }
    ]
  },
  {
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
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
  font-family: "Times New Roman", serif;
  font-size: 14pt;
  line-height: 1.5;
  text-align: justify;
  margin: 0;
}

/* ===== Заголовки ===== */

h1 {
  text-align: center;
  font-size: 18pt;
  font-weight: bold;
  margin-bottom: 1.5em;
  page-break-before: always;
}

h1:first-of-type {
  page-break-before: auto;
}

h2 {
  text-align: center;
  font-size: 16pt;
  font-weight: bold;
  margin-top: 2em;
  margin-bottom: 1em;
  page-break-before: always;
}

h3 {
  text-align: left;
  font-size: 14pt;
  font-weight: bold;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

/* ===== Абзацы ===== */

p {
  text-indent: 1.25cm;
  margin-bottom: 0.5em;
}

/* ===== Списки ===== */

ul, ol {
  margin-left: 1.5cm;
}

/* ===== Титульный лист ===== */

.title-page {
  height: 25cm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: center;
  page-break-after: always;
}

.student-info {
  text-align: right;
  margin-right: 1cm;
}

.student-info p {
  text-indent: 0;
}

/* ===== Разрыв страницы для глав ===== */

h2 {
  page-break-before: always;
}

h3:first-of-type {
  page-break-before: auto;
}

/* ===== Список литературы аккуратнее ===== */

ol li {
  margin-bottom: 0.5em;
}
</style>
      </head>
      <body>
        <div class="title-page">
          <div>
            <strong>Департамент образования г. ${data.city}</strong><br>
            ${data.school}
          </div>
          
          <div style="margin-top: auto; margin-bottom: auto;">
            <h1 style="font-size: 24pt; margin-bottom: 20px;">${data.topic}</h1>
            <p style="text-align:center; text-indent:0;">Проект по предмету «${data.subject}»</p>
          </div>
          
          <div class="student-info">
            <p>
              <strong>Выполнил:</strong><br>
              Ученик ${data.grade} класса<br>
              ${data.studentName}<br><br>
              <strong>Руководитель:</strong><br>
              ${data.teacher}
            </p>
          </div>
          
          <div>${data.city} — ${data.year}</div>
        </div>
        
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