# Accessify: The Accessible AI Research Assistant

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Accessify transforms inaccessible STEM documents into screen-reader friendly content while providing AI-powered research capabilities - making complex mathematical content accessible to everyone.**

## Overview

Accessify is an AI-powered research assistant that combines NotebookLM-style document interaction with advanced accessibility features. It automatically converts PDF documents into accessible HTML format using Mathpix and Gemini AI, while providing chat-based document interaction, citation tracking, and comprehensive accessibility compliance.

## Key Features

### 🔍 **AI Research Capabilities**
- **Document Chat**: Interactive conversation with uploaded documents
- **Verifiable Citations**: Direct source links with line-by-line references
- **Audio Generation**: AI-powered podcast summaries from document content
- **Multi-format Support**: PDF, text, websites, YouTube videos, and audio files

### ♿ **Accessibility Features**
- **Automatic PDF Conversion**: Mathpix integration converts PDFs to LaTeX-formatted HTML
- **AI-Generated Alt Text**: Gemini AI creates WCAG-compliant descriptions for images and figures
- **Screen Reader Optimization**: Mathematical equations rendered as accessible HTML
- **Accessibility Scoring**: Real-time accessibility compliance metrics
- **Semantic HTML**: Proper ARIA labels, headings, and document structure

### 🛠 **Technical Features**
- **Real-time Processing**: Live document processing with progress indicators
- **Vector Search**: RAG-powered document retrieval and context generation
- **Multi-source Notebooks**: Combine multiple document types in single research sessions
- **Download & Export**: Save accessible HTML versions of processed documents

## Technology Stack

### **Frontend**
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **React Query** for state management
- **Supabase Client** for real-time data

### **Backend**
- **Supabase** - Database, authentication, and file storage
- **Supabase Edge Functions** - Serverless compute (Deno runtime)
- **PostgreSQL** - Primary database with vector extensions
- **N8N Workflows** - AI processing and automation

### **AI & Processing**
- **Mathpix API** - PDF to LaTeX/HTML conversion
- **Google Gemini 2.5 Flash** - Alt text and accessibility enhancement
- **OpenAI GPT** - Chat responses and content generation
- **OpenAI Embeddings** - Vector search and RAG implementation
- **Whisper API** - Audio transcription

### **Infrastructure**
- **Supabase Storage** - File upload and management
- **Vector Database** - Document chunk storage and similarity search
- **Real-time Subscriptions** - Live updates and notifications

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Supabase       │    │   AI Services   │
│   (React/Vite)  │◄──►│   Edge Functions │◄──►│   (Mathpix/     │
│                 │    │   (Deno)         │    │    Gemini/GPT)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│   N8N Workflows │    │   PostgreSQL +   │
│   (Automation)  │    │   Vector Store   │
└─────────────────┘    └──────────────────┘
```

## Setup Instructions

### Prerequisites
- Node.js 18+
- Supabase account
- N8N instance (self-hosted or cloud)
- API keys for: OpenAI, Mathpix, Gemini

### 1. Database Setup
```bash
# Clone repository
git clone <repository-url>
cd Accessify

# Install dependencies
npm install

# Set up Supabase
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### 2. Environment Configuration
Create `.env.local`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Supabase Edge Functions
```bash
# Deploy all functions
npx supabase functions deploy preprocess-pdf-mathpix
npx supabase functions deploy enhance-accessibility
npx supabase functions deploy upsert-to-vector-store
npx supabase functions deploy send-chat-message
npx supabase functions deploy generate-notebook-content
npx supabase functions deploy process-document
```

### 4. Environment Variables (Supabase Dashboard)
Add to Supabase Edge Functions secrets:
```
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
MATHPIX_APP_ID=your_mathpix_app_id
MATHPIX_APP_KEY=your_mathpix_app_key
```

### 5. N8N Workflow Setup
Import the following workflows from `/n8n` directory:
- `InsightsLM___Chat.json`
- `InsightsLM___Extract_Text.json`
- `InsightsLM___Generate_Notebook_Details.json`
- `InsightsLM___Podcast_Generation.json`
- `InsightsLM___Process_Additional_Sources.json`
- `InsightsLM___Upsert_to_Vector_Store.json`

### 6. Start Development Server
```bash
npm run dev
```

## API Endpoints

### Document Processing
- `POST /functions/v1/preprocess-pdf-mathpix` - PDF accessibility conversion
- `POST /functions/v1/enhance-accessibility` - AI accessibility enhancement
- `POST /functions/v1/process-document` - General document processing

### AI Features
- `POST /functions/v1/send-chat-message` - Document chat interface
- `POST /functions/v1/generate-notebook-content` - Content generation
- `POST /functions/v1/upsert-to-vector-store` - Vector embeddings

## Database Schema

### Core Tables
- `notebooks` - Research session containers
- `sources` - Document metadata and content
- `documents` - Vector embeddings and chunks
- `messages` - Chat conversation history

### Key Features
- **Vector Search**: PostgreSQL with pgvector extension
- **Real-time Updates**: Supabase realtime subscriptions
- **File Storage**: Supabase Storage for document files
- **Accessibility Metadata**: WCAG compliance tracking

## Accessibility Compliance

### WCAG 2.1 AA Standards
- **Alt Text**: AI-generated descriptions for all images
- **Semantic HTML**: Proper heading hierarchy and landmarks
- **Screen Reader Support**: Mathematical content as readable text
- **Keyboard Navigation**: Full keyboard accessibility
- **Color Contrast**: WCAG AA compliant color schemes

### Technical Implementation
- **Mathpix Conversion**: PDF equations to accessible HTML
- **Gemini Enhancement**: AI-generated alt text and descriptions
- **Semantic Structure**: Proper ARIA labels and roles
- **Progressive Enhancement**: Works without JavaScript

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/accessibility-enhancement`)
3. Commit changes (`git commit -m 'Add accessibility feature'`)
4. Push to branch (`git push origin feature/accessibility-enhancement`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Mathpix** for PDF to LaTeX conversion capabilities
- **Google Gemini** for AI-powered accessibility enhancement
- **Supabase** for backend infrastructure
- **N8N** for workflow automation
- **OpenAI** for chat and content generation capabilities