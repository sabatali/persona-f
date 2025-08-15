import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [formData, setFormData] = useState({
    model: 'gpt-4.1-mini',
    persona_user: 'sabat',
    user_message: '',
    sessionId: ''
  })
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(false)
  const [availablePersonas, setAvailablePersonas] = useState([])
  const [sessionSummary, setSessionSummary] = useState({
    totalMessages: 0,
    totalTokens: 0
  })
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Audio reference for notifications
  const audioRef = useRef(null)

  // Initialize audio on component mount
  useEffect(() => {
    audioRef.current = new Audio('/new-notification-026-380249.mp3')
    audioRef.current.volume = 0.5 // Set volume to 50%

    // Load audio file
    audioRef.current.load()
  }, [])

  // Function to play notification sound
  const playNotificationSound = () => {
    if (soundEnabled && audioRef.current) {
      try {
        audioRef.current.currentTime = 0 // Reset to beginning
        audioRef.current.play()
      } catch (error) {
        console.log('Audio playback failed:', error)
      }
    }
  }

  // Load personas and session ID on component mount
  useEffect(() => {
    loadPersonas()
    const savedSessionId = localStorage.getItem('persona_session_id')
    if (savedSessionId) {
      setFormData(prev => ({ ...prev, sessionId: savedSessionId }))
      loadSessionSummary(savedSessionId)
      loadChatHistory(savedSessionId, 'sabat')
    }
  }, [])

  // Save session ID to localStorage whenever it changes
  useEffect(() => {
    if (formData.sessionId) {
      localStorage.setItem('persona_session_id', formData.sessionId)
    }
  }, [formData.sessionId])

  // Load chat history when persona or session changes
  useEffect(() => {
    if (formData.sessionId && formData.persona_user) {
      loadChatHistory(formData.sessionId, formData.persona_user)
    }
  }, [formData.persona_user])

  const loadPersonas = async () => {
    try {
      const res = await fetch('https://persona-b.onrender.com/api/persona/personas')
      const data = await res.json()

      if (data.success && data.personas) {
        // Ensure all personas have the required fields with defaults
        const personasWithDefaults = data.personas.map(persona => ({
          ...persona,
          totalMessages: persona.totalMessages || 0,
          totalTokens: persona.totalTokens || 0,
          lastActive: persona.lastActive || new Date().toISOString()
        }))

        setAvailablePersonas(personasWithDefaults)
        // Only set default persona if none is currently selected
        setFormData(prev => ({
          ...prev,
          persona_user: prev.persona_user || personasWithDefaults[0]?.personaUser || 'sabat'
        }))
      }
    } catch (error) {
      console.error('Error loading personas:', error)
    }
  }

  const loadSessionSummary = async (sessionId) => {
    try {
      const res = await fetch(`https://persona-b.onrender.com/api/persona/sessionSummary?sessionId=${sessionId}`)
      const data = await res.json()

      if (data.success) {
        setSessionSummary({
          totalMessages: data.totalMessages,
          totalTokens: data.totalTokens
        })
      }
    } catch (error) {
      console.error('Error loading session summary:', error)
    }
  }

  const loadChatHistory = async (sessionId, personaUser) => {
    try {
      const res = await fetch(`https://persona-b.onrender.com/api/persona/chatHistory?sessionId=${sessionId}&personaUser=${personaUser}`)
      const data = await res.json()

      if (data.success && data.messages) {
        const chatHistory = data.messages.map(msg => ({
          id: msg._id || Date.now() + Math.random(),
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp).toISOString(),
          persona: personaUser,
          model: msg.model || data.model || formData.model,
          tokens: msg.tokens || 0
        }))
        setConversations(chatHistory)

        // Play sound if there are AI messages in the history
        const aiMessages = chatHistory.filter(msg => msg.role === 'assistant')
        if (aiMessages.length > 0) {
          playNotificationSound()
        }
      } else {
        setConversations([])
      }
    } catch (error) {
      console.error('Error loading chat history:', error)
      setConversations([])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.user_message.trim()) return

    setLoading(true)

    // Add user message to conversation immediately
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: formData.user_message,
      timestamp: new Date().toISOString(),
      persona: formData.persona_user,
      model: formData.model,
      tokens: 0 // Will be updated when we get the response
    }

    setConversations(prev => [...prev, userMessage])

    setFormData(prev => ({ ...prev, user_message: '' }))

    try {
      const res = await fetch('https://persona-b.onrender.com/api/persona/genPersona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()

      // Add AI response to conversation
      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.persona_res,
        timestamp: new Date().toISOString(),
        persona: formData.persona_user,
        model: data.model || formData.model,
        tokens: data.tokenBreakdown?.aiTokens || 0
      }

      setConversations(prev => [...prev, aiMessage])

      // Play notification sound for AI message
      playNotificationSound()

      // Update sessionId for continuing conversation
      if (data.sessionId) {
        setFormData(prev => ({ ...prev, sessionId: data.sessionId }))
        // Reload session summary after new message
        loadSessionSummary(data.sessionId)
      }

      // Reload personas to get updated stats
      loadPersonas()
    } catch (error) {
      // Add error message to conversation
      let errorContent = 'Error: ' + error.message;

      // Handle rate limit errors specifically
      if (error.status === 429) {
        errorContent = '⚠️ Rate limit exceeded. Please wait a moment before sending another message.';
      }

      const errorMessage = {
        id: Date.now() + 1,
        role: 'error',
        content: errorContent,
        timestamp: new Date().toISOString(),
        persona: formData.persona_user,
        model: formData.model
      }
      setConversations(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handlePersonaClick = (persona) => {
    setFormData(prev => ({ ...prev, persona_user: persona.personaUser }))
    if (formData.sessionId) {
      loadChatHistory(formData.sessionId, persona.personaUser)
    }
  }

  const getPersonaDisplayName = (persona) => {
    const personaData = availablePersonas.find(p => p.personaUser === persona)
    return personaData?.displayName || persona
  }

  const getModelDisplayName = (model) => {
    if (!model) return 'Unknown Model'

    const names = {
      'gemini-2.0-flash-exp': 'Gemini 2.0',
      'gpt-5-mini': 'GPT-5 Mini',
      'gpt-4o': 'GPT-4o'
    }
    return names[model] || model
  }

  const getPersonaImage = (persona) => {
    const personaData = availablePersonas.find(p => p.personaUser === persona)
    return personaData?.imageUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
  }

  const formatTokens = (tokens) => {
    if (!tokens || tokens === 0) return '0'
    if (tokens >= 1000) {
      return (tokens / 1000).toFixed(1) + 'K'
    }
    return tokens.toString()
  }

  const formatTokenCost = (tokens, model) => {
    if (!tokens || tokens === 0) return '$0.00'

    const costs = {
      'gpt-4o': { input: 0.000005, output: 0.000015 },
      'gpt-5-mini': { input: 0.00000015, output: 0.0000006 },
      'gemini-2.0-flash-exp': { input: 0.000000075, output: 0.0000003 }
    };

    const modelCosts = costs[model] || costs['gpt-4o'];
    const estimatedCost = (tokens * modelCosts.input) + (tokens * modelCosts.output);

    if (estimatedCost < 0.001) {
      return `$${(estimatedCost * 1000).toFixed(3)}K` // Show in thousands
    } else if (estimatedCost < 0.01) {
      return `$${estimatedCost.toFixed(4)}`
    } else {
      return `$${estimatedCost.toFixed(3)}`
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now - date) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } else if (diffInHours < 48) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex h-screen">
        {/* Left Sidebar */}
        <div className="w-72 bg-gray-900 border-r border-gray-700 flex flex-col min-h-0">
          {/* Header Section */}
          <div className="p-3 border-b border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900 flex-shrink-0">
            <div className="text-center">
              <h1 className="text-md font-bold bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
                Persona AI Chat
              </h1>
              <p className="text-gray-400 text-xs mb-2">Select a persona to start chatting</p>
            </div>
          </div>

          {/* Session Info Section - Compact */}
          <div className="p-2 border-b border-gray-700 bg-gray-800/50">
            <h3 className="text-xs font-semibold text-gray-300 mb-2 flex items-center">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2 flex-shrink-0"></span>
              {formData.sessionId ? 'Active Session' : 'Ready to Chat'}
            </h3>

            {/* Compact Session Info */}
            <div className="space-y-2">
              {/* Session ID Row */}
              <div className="flex items-center justify-between bg-gray-700/50 rounded p-2">
                <span className="text-xs text-gray-400">Session ID</span>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-300 font-mono">
                    {formData.sessionId ? formData.sessionId.slice(0, 8) + '...' : 'Ready'}
                  </span>
                  {formData.sessionId && (
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  )}
                </div>
              </div>

              {/* Stats Row - Compact Horizontal */}
              <div className="flex items-center space-x-3 bg-gray-700/50 rounded p-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-blue-400">{sessionSummary.totalMessages}</span>
                  <span className="text-xs text-gray-400">Messages</span>
                </div>
                <div className="w-px h-4 bg-gray-600"></div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-amber-400">{formatTokens(sessionSummary.totalTokens)}</span>
                  <span className="text-xs text-gray-400">Tokens</span>
                </div>
                <div className="w-px h-px bg-gray-600"></div>
                <div className="text-xs text-gray-500">
                  {formatTokenCost(sessionSummary.totalTokens, formData.model)}
                </div>
              </div>
            </div>
          </div>

          {/* Persona Selection Section */}
          <div className="flex-1 p-3 overflow-y-auto min-h-0">
            <h3 className="text-xs font-semibold text-gray-300 mb-3 flex items-center">
              <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 flex-shrink-0"></span>
              Available Personas
            </h3>
            <div className="space-y-2">
              {availablePersonas.map((persona) => (
                <div
                  key={persona.personaUser}
                  className={`relative group cursor-pointer rounded-lg p-3 transition-all duration-200 ${formData.persona_user === persona.personaUser
                    ? 'bg-gradient-to-r from-orange-400/20 to-yellow-400/20 border border-orange-400/30 ring-2 ring-orange-400/20'
                    : 'bg-gray-700/50 hover:bg-gray-700/70 border border-transparent hover:border-gray-600'
                    }`}
                  onClick={() => handlePersonaClick(persona)}
                >
                  {/* Active Indicator */}
                  {formData.persona_user === persona.personaUser && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full border-2 border-gray-900 flex-shrink-0"></div>
                  )}

                  <div className="flex items-center space-x-3">
                    <img
                      src={persona.imageUrl}
                      alt={persona.displayName}
                      className="w-8 h-8 rounded-full border-2 border-gray-600 shadow-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-white truncate">
                          {persona.displayName}
                        </h4>
                        <span className="text-xs text-gray-400 bg-gray-600 px-2 py-1 rounded flex-shrink-0">
                          {getModelDisplayName(persona.model)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">
                          {persona.totalMessages || 0} messages
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTokens(persona.totalTokens || 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Last: {formatTime(persona.lastActive)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTokenCost(persona.totalTokens || 0, persona.model)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Section */}
          <div className="p-3 border-t border-gray-700 bg-gray-800/50 flex-shrink-0">
            <div className="text-center">
              <p className="text-xs text-gray-400">
                Click personas to switch • Sound notifications enabled
              </p>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="bg-gray-900 border-b border-gray-700 p-3 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `url(${getPersonaImage(formData.persona_user)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(20px)'
              }}
            />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">
                    Chatting with <span className="bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
                      {getPersonaDisplayName(formData.persona_user)}
                    </span>
                  </h2>
                  <p className="text-xs text-gray-400">
                    {formData.sessionId ? (
                      <span className="flex items-center space-x-2">
                        <span>Session: {formData.sessionId.slice(0, 8)}...</span>
                        <span className="text-green-400">• Context Available</span>
                      </span>
                    ) : (
                      'New conversation - no context available'
                    )}
                  </p>
                </div>

                {/* Settings and Credits Section */}
                <div className="flex items-center space-x-4">
                  {/* AI Model Settings */}
                  <div className="flex items-center space-x-2">
                    <label className="text-xs text-gray-400">Model:</label>
                    <select
                      value={formData.model}
                      onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                      className="bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-orange-400"
                    >

                      <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                      <option value="gpt-5-mini">GPT-5 Mini</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gemini-2.0-flash-exp">Gemini 2.0</option>
                    </select>
                  </div>

                  {/* Sound Toggle */}
                  <div className="flex items-center space-x-2">
                    <label className="text-xs text-gray-400">Sound:</label>
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={`w-8 h-4 rounded-full transition-colors ${soundEnabled ? 'bg-orange-400' : 'bg-gray-600'
                        }`}
                    >
                      <div className={`w-3 h-3 bg-white rounded-full transition-transform ${soundEnabled ? 'translate-x-4' : 'translate-x-0.5'
                        }`}></div>
                    </button>
                  </div>

                  {/* Built by Credit */}
                  <div className="text-xs text-gray-500 border-l border-gray-600 pl-4">
                    Built by <span className="text-orange-400 font-medium">Sabat Ali</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 relative bg-gray-900">
            {/* Minimal Background Elements */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-8 left-8 w-1 h-1 bg-orange-400/30 rounded-full"></div>
              <div className="absolute top-8 right-8 w-1 h-1 bg-amber-400/30 rounded-full"></div>
              <div className="absolute bottom-8 left-8 w-1 h-1 bg-yellow-400/30 rounded-full"></div>
              <div className="absolute bottom-8 right-8 w-1 h-1 bg-orange-400/30 rounded-full"></div>
            </div>

            {conversations.length === 0 ? (
              <div className="text-center text-gray-500 mt-20 relative z-10">
                <div className="mb-4">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-2xl">💬</span>
                  </div>
                </div>
                <p className="text-lg">Start a conversation with {getPersonaDisplayName(formData.persona_user)}</p>
                <p className="text-sm text-gray-400 mb-4">Type your message below to begin chatting!</p>

                {/* Helpful tips */}
                <div className="bg-gray-800/50 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-xs text-gray-500">Select a persona from the sidebar or start typing below!</p>
                </div>
              </div>
            ) : (
              conversations.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} items-end space-x-2 relative z-10`}
                >
                  {/* Persona Image (for AI messages) */}
                  {message.role !== 'user' && (
                    <div className="flex-shrink-0">
                      <img
                        src={getPersonaImage(message.persona)}
                        alt={getPersonaDisplayName(message.persona)}
                        className="w-8 h-8 rounded-full border-2 border-gray-600 shadow-lg"
                      />
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="max-w-xs lg:max-w-md">
                    {/* User Name and Model (for AI messages) */}
                    {message.role !== 'user' && message.role !== 'error' && (
                      <div className="flex items-center justify-between mb-1 ml-1">
                        <div className="text-xs text-gray-400 font-medium">
                          {getPersonaDisplayName(message.persona)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {getModelDisplayName(message.model)}
                        </div>
                      </div>
                    )}

                    {/* User Name only (for user messages) */}
                    {message.role === 'user' && (
                      <div className="text-xs text-gray-400 mb-1 ml-1 font-medium">
                        You
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`px-4 py-2 rounded-lg relative shadow-lg ${message.role === 'user'
                        ? 'bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-500 text-black'
                        : message.role === 'error'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-700 text-white border border-gray-600'
                        }`}
                    >
                      <div className="text-sm">{message.content}</div>

                      {/* Message Footer with Timestamp and Tokens */}
                      <div className="flex items-center justify-end mt-2 pt-2 border-t border-gray-600/30">
                        <div className="text-xs opacity-70">
                          {formatTime(message.timestamp)}
                          {message.tokens ? ` | ${message.tokens} tokens` : ''}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* User Image (for user messages) */}
                  {message.role === 'user' && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-500 flex items-center justify-center text-black font-bold text-sm shadow-lg">
                        U
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {loading && (
              <div className="flex justify-start items-end space-x-2 relative z-10">
                <div className="flex-shrink-0">
                  <img
                    src={getPersonaImage(formData.persona_user)}
                    alt={getPersonaDisplayName(formData.persona_user)}
                    className="w-8 h-8 rounded-full border-2 border-gray-600 shadow-lg"
                  />
                </div>
                <div className="max-w-xs lg:max-w-md">
                  <div className="flex items-center justify-between mb-1 ml-1">
                    <div className="text-xs text-gray-400 font-medium">
                      {getPersonaDisplayName(formData.persona_user)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {getModelDisplayName(formData.model)}
                    </div>
                  </div>
                  <div className="bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 shadow-lg">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span className="text-sm">{getPersonaDisplayName(formData.persona_user)} is typing...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Form */}
          <div className="bg-gray-900 border-t border-gray-700 p-4">
            <form onSubmit={handleSubmit} className="flex space-x-3">
              <input
                type="text"
                value={formData.user_message}
                onChange={(e) => setFormData(prev => ({ ...prev, user_message: e.target.value }))}
                placeholder="Type your message..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-orange-400"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !formData.user_message.trim()}
                className="bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-500 text-black font-bold py-2 px-6 rounded hover:opacity-90 disabled:opacity-50 transition-all"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
