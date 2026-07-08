# AI-Powered Resume Roaster

AI-Powered Resume Roaster is an AI-based resume analyzer tool that enables recruiters and job seekers to evaluate resumes against target job descriptions. The platform analyzes resumes to identify key skills, missing keywords, accomplishments, and overall job fit, then generates structured AI-powered reports with actionable feedback.

---

## 🚀 Features

- AI-powered resume analysis
- ATS compatibility evaluation
- Resume roasting with detailed feedback
- Job description matching
- Skill gap identification
- Keyword coverage analysis
- Structured recruiter-style reports
- Authentication support
- Dockerized deployment

---

# 🏗️ Architecture

This project demonstrates an AI-powered application aligned with modern cloud-native architecture principles.

### 🤖 LLM Integration
Uses external LLM APIs (Groq / OpenAI) to generate intelligent resume feedback.

### 🔄 Workflow Coordination
Backend APIs orchestrate a Retrieval-Augmented Generation (RAG) pipeline:

Embedding → Retrieval → Generation

### 💻 User Interaction
Users upload resumes through the web interface and receive AI-generated analysis and recommendations.

### 🗄️ Memory & State Management
Uses PostgreSQL with pgvector for:

- Resume embeddings
- Vector similarity search
- Feedback history
- Application logs

---

# 🧠 My Contributions

- Built backend APIs using Hono for resume analysis workflows
- Implemented a Retrieval-Augmented Generation (RAG) pipeline using embeddings and vector similarity search
- Developed frontend features using Next.js and TypeScript
- Integrated authentication using NextAuth and middleware
- Worked with PostgreSQL and pgvector for structured and vector data storage
- Contributed to testing, debugging, and full-stack integration

---

# 🤖 AI Prompt Engineering

## Resume Roasting Prompt

### System Prompt

> You are an expert resume reviewer. Provide detailed, constructive, and honest feedback on resumes.

### User Prompt Template

```text
Resume content:
{resume_text}

Target job role:
{job_role}

Instructions:
Provide actionable feedback, highlight strengths, weaknesses, and suggest improvements.
```

---

## RAG Context Prompt

### System Prompt

> Use the provided context to generate more relevant and accurate feedback.

Context consists of similar resumes and historical feedback retrieved through vector similarity search.

---

## Feedback Generation Prompt

The AI generates structured feedback including:

- Strengths
- Weaknesses
- Improvements
- Final Score
- Additional Notes

Prompt templates were iteratively refined to:

- Improve response quality
- Reduce hallucinations
- Produce consistent structured outputs
- Generate actionable recommendations

---

# 🛠️ Development Environment

## Prerequisites

Install the following:

- Node.js (v18+ recommended)
- npm (v9+ recommended)
- Git

Verify installation:

```bash
node -v
npm -v
git --version
```

---

# 📦 Tech Stack

## Frontend

- React
- Vite
- TypeScript

## Backend

- Express
- TypeScript

## AI

- Groq API
- OpenAI API
- Retrieval-Augmented Generation (RAG)

## Database

- PostgreSQL
- pgvector

## Authentication

- NextAuth

## Optional

- Docker
- Docker Compose

---

# 📁 Project Structure

```text
project-root/
│
├── frontend/              # React + Vite + TypeScript UI
├── backend/               # Express + TypeScript API
├── scripts/               # Utility scripts
├── docker-compose.yml
└── README.md
```

---

# 🏛️ Architecture Overview

| Layer | Technology |
|---------|------------|
| Frontend | React + Vite + TypeScript |
| Backend | Express + TypeScript |
| Communication | REST APIs |
| AI Layer | RAG + LLM Integration |
| Database | PostgreSQL + pgvector |

---

# ⚙️ Environment Variables

## Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:4000
```

## Backend (`backend/.env`)

```env
PORT=4000
```

---

# 🚀 Local Development

## Install Dependencies

```bash
npm install
```

---

## Configure Environment Variables

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

---

## Start Full Application

```bash
npm run dev
```

---

# ▶️ Run Services Individually

## Frontend

```bash
cd frontend
npm run dev
```

## Backend

```bash
cd backend
npm run dev
```

---

# 🐳 Docker

## Start Containers

```bash
./scripts/start-dev.sh
```

or

```bash
docker compose up --build
```

---

## Stop Containers

```bash
docker compose down
```

---

## Rebuild Everything

```bash
docker compose down --volumes
docker compose up --build
```

---

# 🌐 Application URLs

| Service | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:4000 |
| Health Check | http://localhost:4000/api/health |

---

# 📡 API Reference

## Health Check

### GET `/api/health`

### Response

```json
{
  "status": "ok",
  "service": "resume-roaster-backend",
  "version": "0.1.0"
}
```

---

## Roast Resume

### POST `/api/roast`

### Request

```json
{
  "resumeText": "string",
  "targetRole": "string",
  "roastLevel": "string"
}
```

### Response

```json
{
  "roast": "string",
  "score": 85,
  "breakdown": [
    {
      "name": "Skills Match",
      "score": 90
    },
    {
      "name": "Keyword Coverage",
      "score": 80
    }
  ]
}
```

---

# 📌 Future Improvements

- Resume ranking using semantic similarity
- ATS score visualization
- Multi-document support
- Cover letter generation
- Interview question generation
- Resume version comparison
- Support for multiple LLM providers
- Analytics dashboard
- Cloud deployment on AWS/Azure
