# Persona AI Chat Frontend

A modern React frontend for the Persona-B backend API. Chat with different AI personas using various AI models.

## 🎨 Design Features

- **Black Background** - Modern dark theme
- **Gradient Text** - Orange to yellow gradient for headings and buttons
- **Responsive Design** - Works on all screen sizes
- **Clean UI** - Simple, intuitive interface

## 🚀 Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the frontend:**
   ```bash
   npm run dev
   ```

3. **Make sure backend is running:**
   ```bash
   # In Persona-B folder
   node index.js
   ```

## ✨ Features

- **AI Models:** Gemini 2.0, GPT-5 Mini, GPT-4o
- **Personas:** Sabat, Usman, Hitesh
- **Session Management:** Continue conversations or start new ones
- **Real-time Chat:** Instant AI responses
- **Session History:** View all chat sessions

## 🎯 Usage

1. Select AI model and persona
2. Type your message
3. Optionally add session ID to continue conversation
4. Click "Send Message"
5. View AI response and session details

## 🔗 Backend Integration

- **API Endpoint:** `http://localhost:3000/api/persona/genPersona`
- **CORS Enabled:** Frontend can communicate with backend
- **Session Tracking:** UUID-based session management
