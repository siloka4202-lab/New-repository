# ScholarGen - AI School Project Generator

A full-stack application that generates professionally formatted school projects (PDF) using Google Gemini API.

## Prerequisites

1. Node.js (v18+)
2. A Google Gemini API Key

## Setup & Run

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_google_gemini_api_key_here
   ```

3. **Run the Application:**
   This command starts both the Express backend (port 3001) and React frontend (port 5173).
   ```bash
   npm start
   ```

4. **Access:**
   Open http://localhost:5173 in your browser.

## How it works

1. **Frontend (React):** Collects user inputs (Topic, Grade, etc.).
2. **Backend (Express):** 
   - Receives data.
   - Prompts Gemini API to write the essay in Markdown.
   - Converts Markdown to HTML.
   - Injects CSS for Academic styling (Times New Roman, 14pt, 1.5 spacing, 2cm margins).
   - Uses Puppeteer to render the HTML to a PDF buffer (A4 format).
3. **Result:** The browser downloads the generated PDF.