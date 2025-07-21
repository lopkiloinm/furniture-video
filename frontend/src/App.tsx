import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import styles from './App.module.css'

interface FurnitureItem {
  name: string;
  price: number;
  properties: {
    type: string;
    style: string;
    material: string;
    color: string;
    dimensions: string;
  };
  description: string;
  original_index?: number;
}

interface Message {
  id: string;
  type: 'ai' | 'user';
  content: string;
  timestamp: Date;
}

interface ConversationState {
  spaceType: string;
  stylePreferences: string;
  budgetRange: string;
  additionalRequirements: string;
}

enum AIState {
  WELCOME = 'welcome',
  GATHERING_SPACE = 'gathering_space',
  GATHERING_STYLE = 'gathering_style', 
  GATHERING_BUDGET = 'gathering_budget',
  ANALYZING = 'analyzing',
  PRESENTING = 'presenting',
  GENERATING_VIDEO = 'generating_video',
  COMPLETE = 'complete'
}

function App() {
  const [currentState, setCurrentState] = useState<AIState>(AIState.WELCOME)
  const [messages, setMessages] = useState<Message[]>([])
  const [userInput, setUserInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationData, setConversationData] = useState<ConversationState>({
    spaceType: '',
    stylePreferences: '',
    budgetRange: '',
    additionalRequirements: ''
  })
  const [furnitureData, setFurnitureData] = useState<FurnitureItem[]>([])
  const [allFurniture, setAllFurniture] = useState<FurnitureItem[]>([])
  const [selectedFurnitureIds, setSelectedFurnitureIds] = useState<number[]>([])
  const [aiRecommendedIds, setAiRecommendedIds] = useState<number[]>([])
  const [currentStep, setCurrentStep] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false) // Mutex for requests
  const totalSteps = 8
  const welcomeMessageSent = useRef(false)

  // Initialize with AI welcome message and fetch all furniture
  useEffect(() => {
    if (!welcomeMessageSent.current) {
      welcomeMessageSent.current = true
      fetchAllFurniture()
      sendInitialWelcomeMessage()
    }
  }, [])

  const sendInitialWelcomeMessage = async () => {
    setIsProcessing(true)
    setIsTyping(true)

    try {
      const response = await fetch('http://localhost:8000/api/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_message: "SYSTEM_START:",
          conversation_history: [],
          current_step: 1,
          conversation_data: conversationData
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.status === 'success') {
          setIsTyping(false)
          addStreamingAIMessage(result.ai_response)
          // Welcome messages should not advance steps - mutex will be released in streaming completion
        } else {
          getAIErrorResponse("welcome failed")
        }
      } else {
        getAIErrorResponse("connection failed")
      }
    } catch (error) {
      console.error('Welcome error:', error)
      getAIErrorResponse("network error")
    }
  }

  const fetchAllFurniture = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/furniture')
      if (response.ok) {
        const furniture = await response.json()
        const furnitureWithIndex = furniture.map((item: FurnitureItem, index: number) => ({
          ...item,
          original_index: index
        }))
        setAllFurniture(furnitureWithIndex)
      }
    } catch (error) {
      console.error('Failed to fetch furniture:', error)
    }
  }

  const addMessage = (type: 'ai' | 'user', content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newMessage])
  }

  const addStreamingAIMessage = (content: string) => {
    // Ensure we have the full content before streaming
    const fullContent = content || ''
    
    setIsStreaming(true)
    setIsTyping(true)
    setStreamingMessage('')
    
    // Use refs to prevent state-related interruptions
    let displayedContent = ''
    let index = 0
    let completed = false
    
    const streamInterval = setInterval(() => {
      if (completed) return
      
      if (index < fullContent.length) {
        const char = fullContent[index]
        displayedContent += char
        setStreamingMessage(displayedContent)
        index++
              } else {
          // Double-check we've streamed everything before finishing
          if (index >= fullContent.length && displayedContent.length >= fullContent.length) {
            completed = true
            clearInterval(streamInterval)
            setIsStreaming(false)
            setIsTyping(false)
            
            // Always use the full original content
            const finalMessage: Message = {
              id: Date.now().toString(),
              type: 'ai',
              content: fullContent,
              timestamp: new Date()
            }
            setMessages(prev => [...prev, finalMessage])
            setStreamingMessage('')
            
            // Release mutex - streaming complete
            setIsProcessing(false)
          }
        }
    }, 20)
  }



  const handleUserInput = async () => {
    if (!userInput.trim() || isProcessing) return

    const input = userInput.trim()
    addMessage('user', input)
    setUserInput('')

    // Get AI response for current conversation
    await getAIResponse(input)
  }

  const getAIErrorResponse = (errorType: string) => {
    setIsTyping(false)
    setIsProcessing(false) // Release mutex on error
    addStreamingAIMessage("Sorry, I'm having technical difficulties. Please try again!")
  }

  const getAITransitionMessage = (transitionType: string) => {
    if (isProcessing) return // Respect mutex
    
    setIsProcessing(true)
    const messages: { [key: string]: string } = {
      'analysis_start': "Analyzing your requirements and curating furniture options...",
      'furniture_presentation': "Here are my curated recommendations! You can adjust your selection.",
      'video_generation': "Creating your personalized furniture visualization...",
      'video_complete': "Your custom furniture arrangement video is ready!"
    }
    const message = messages[transitionType] || "Moving to the next step..."
    addStreamingAIMessage(message)
    // Mutex will be released in streaming completion
  }

  const getAIResponse = async (userMessage: string) => {
    // Mutex - prevent concurrent requests
    if (isProcessing) {
      return
    }
    
    setIsProcessing(true)
    setIsTyping(true)
    
    // Capture current step at time of sending to avoid race conditions
    const stepAtTimeOfSending = currentStep
    
    try {
      const response = await fetch('http://localhost:8000/api/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_message: userMessage,
          conversation_history: messages,
          current_step: stepAtTimeOfSending,
          conversation_data: conversationData
        })
      })

      if (response.ok) {
        const result = await response.json()
        
        if (result.status === 'success') {
          // Add AI response with streaming
          addStreamingAIMessage(result.ai_response)
          // No automatic step advancement - user controls when to move on
        } else {
          getAIErrorResponse("API processing error")
        }
      } else {
        getAIErrorResponse("Server communication error")
      }
    } catch (error) {
      console.error('Error getting AI response:', error)
      getAIErrorResponse("Network connection error")
    }
  }

  const handleManualStepAdvancement = () => {
    if (isProcessing) return
    
    // Advance to next step manually
    const nextStep = currentStep + 1
    
    switch (currentStep) {
      case 1: // Welcome -> Space Details
        setCurrentState(AIState.GATHERING_SPACE)
        setCurrentStep(2)
        break

      case 2: // Space -> Style  
        setCurrentState(AIState.GATHERING_STYLE)
        setCurrentStep(3)
        break

      case 3: // Style -> Budget
        setCurrentState(AIState.GATHERING_BUDGET) 
        setCurrentStep(4)
        break

      case 4: // Budget -> Analysis
        setCurrentState(AIState.ANALYZING)
        setCurrentStep(5)
        
        // Start analysis process
        setTimeout(async () => {
          await getAITransitionMessage("analysis_start")
          setTimeout(() => processAISelection(), 2000)
        }, 300)
        break
    }
  }

  const handleStepAdvancement = (userMessage: string, fromStep: number) => {
    // Update conversation data based on the step we're advancing FROM
    switch (fromStep) {
      case 1: // Welcome -> Space Details
        setConversationData(prev => ({ ...prev, spaceType: userMessage }))
        setCurrentState(AIState.GATHERING_SPACE)
        setCurrentStep(2)
        break

      case 2: // Space -> Style  
        setConversationData(prev => ({ ...prev, stylePreferences: userMessage }))
        setCurrentState(AIState.GATHERING_STYLE)
        setCurrentStep(3)
        break

      case 3: // Style -> Budget
        setConversationData(prev => ({ ...prev, budgetRange: userMessage }))
        setCurrentState(AIState.GATHERING_BUDGET) 
        setCurrentStep(4)
        break

      case 4: // Budget -> Analysis
        setConversationData(prev => ({ ...prev, additionalRequirements: userMessage }))
        setCurrentState(AIState.ANALYZING)
        setCurrentStep(5)
        
        // Get AI analysis message and process furniture selection
        setTimeout(async () => {
          await getAITransitionMessage("analysis_start")
          setTimeout(() => processAISelection(), 2000)
        }, 300)
        break
    }
  }

  const toggleFurnitureSelection = (furnitureIndex: number) => {
    setSelectedFurnitureIds(prev => {
      if (prev.includes(furnitureIndex)) {
        return prev.filter(id => id !== furnitureIndex)
      } else {
        return [...prev, furnitureIndex]
      }
    })
  }

  const confirmFurnitureSelection = () => {
    const userMessage = `I've finalized my furniture selection (${selectedFurnitureIds.length} items chosen)`
    addMessage('user', userMessage)
    setCurrentState(AIState.GENERATING_VIDEO)
    setCurrentStep(7)
    
    // Get AI response for video generation step
    setTimeout(() => {
      getAITransitionMessage("video_generation")
      
      // Simulate video generation
      setTimeout(() => {
        setCurrentStep(8)
        getAITransitionMessage("video_complete")
        setCurrentState(AIState.COMPLETE)
      }, 3000)
    }, 500)
  }

  const processAISelection = async () => {
    try {
      const fullPrompt = `Space: ${conversationData.spaceType}. Room details: ${conversationData.stylePreferences}. Style: ${conversationData.budgetRange}. Additional requirements: ${conversationData.additionalRequirements}`
      
      const agentResponse = await fetch('http://localhost:8000/api/run-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ house_prompt: fullPrompt })
      })

      if (agentResponse.ok) {
        const agentResult = await agentResponse.json()
        
        if (agentResult.status === 'complete') {
          const aiSelected = agentResult.selected_indices
          setSelectedFurnitureIds(aiSelected)
          setAiRecommendedIds(aiSelected)
          setCurrentState(AIState.PRESENTING)
          setCurrentStep(6)
          
          // Get AI response for furniture presentation
          setTimeout(() => {
            getAITransitionMessage("furniture_presentation")
          }, 500)
        }
      }
    } catch (error) {
      console.error('Error:', error)
      // Get AI-generated error message
      getAIErrorResponse("API connection failed")
    }
  }

  const renderStepIndicator = () => (
    <div className={styles.stepIndicator}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`${styles.step} ${
            i + 1 === currentStep ? styles.active : 
            i + 1 < currentStep ? styles.completed : styles.pending
          }`}
        >
          <div className={styles.stepNumber}>{i + 1}</div>
          <div className={styles.stepLabel}>
            {['Welcome', 'Space', 'Style', 'Budget', 'Analysis', 'Selection', 'Video', 'Complete'][i]}
          </div>
        </div>
      ))}
    </div>
  )

  const renderChat = () => (
    <div className={styles.chatContainer}>
      <div className={styles.messagesContainer}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.message} ${
              message.type === 'ai' ? styles.aiMessage : styles.userMessage
            }`}
          >
            <div className={styles.messageContent}>
              <div className={styles.messageText}>
                {message.type === 'ai' ? (
                  <div className={styles.markdown}>
                    <ReactMarkdown>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  message.content
                )}
              </div>
              <div className={styles.messageTime}>
                {message.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          </div>
        ))}
        
        {isTyping && !isStreaming && (
          <div className={`${styles.message} ${styles.aiMessage}`}>
            <div className={styles.messageContent}>
              <div className={styles.typingIndicator}>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        {/* Show streaming message */}
        {isStreaming && streamingMessage && (
          <div className={`${styles.message} ${styles.aiMessage} ${styles.streamingMessage}`}>
            <div className={styles.messageContent}>
              <div className={styles.messageText}>
                <div className={styles.markdown}>
                  <ReactMarkdown>
                    {streamingMessage}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Show furniture selection after AI presents results */}
        {currentState === AIState.PRESENTING && allFurniture.length > 0 && (
          <div className={styles.message}>
            <div className={styles.furnitureSelectionContainer}>
              <div className={styles.furnitureGrid}>
                {allFurniture.map((item, index) => {
                  const isSelected = selectedFurnitureIds.includes(index)
                  const wasAIRecommended = aiRecommendedIds.includes(index)
                  
                  return (
                    <div
                      key={index}
                      className={`${styles.furnitureItem} ${
                        isSelected ? styles.selected : styles.unselected
                      }`}
                      onClick={() => toggleFurnitureSelection(index)}
                    >
                      <div className={styles.furnitureImageContainer}>
                        <img
                          src={`/furniture/furniture_${index}.png`}
                          alt={item.name}
                          className={styles.furnitureItemImage}
                        />
                        <div className={styles.checkboxOverlay}>
                          <div className={`${styles.checkbox} ${isSelected ? styles.checked : ''}`}>
                            {isSelected && <span className={styles.checkmark}>✓</span>}
                          </div>
                        </div>
                        {wasAIRecommended && (
                          <div className={styles.aiRecommendedBadge}>AI Pick</div>
                        )}
                      </div>
                      <div className={styles.furnitureItemInfo}>
                        <h4 className={styles.furnitureItemName}>{item.name}</h4>
                        <p className={styles.furnitureItemPrice}>${item.price}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className={styles.selectionActions}>
                <button
                  onClick={confirmFurnitureSelection}
                  className={styles.confirmButton}
                  disabled={selectedFurnitureIds.length === 0}
                >
                  Confirm Selection ({selectedFurnitureIds.length} items)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Show video placeholder */}
        {currentState === AIState.COMPLETE && (
          <div className={styles.message}>
            <div className={styles.videoContainer}>
              <div className={styles.videoPlaceholder}>
                <div className={styles.playIcon}>▶</div>
                <p className={styles.videoText}>Custom Furniture Arrangement Video</p>
                <p className={styles.videoSubtext}>Click to play your personalized visualization</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {currentState !== AIState.ANALYZING && 
       currentState !== AIState.PRESENTING && 
       currentState !== AIState.GENERATING_VIDEO && 
       currentState !== AIState.COMPLETE && (
                <div className={styles.inputArea}>
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleUserInput()}
            placeholder={isProcessing ? "Processing..." : getPlaceholderText()}
            className={styles.chatInput}
            disabled={isProcessing}
          />
          <button
            onClick={handleUserInput}
            disabled={!userInput.trim() || isProcessing}
            className={styles.sendButton}
          >
            Send
          </button>
          {currentStep <= 4 && (
            <button
              onClick={() => handleManualStepAdvancement()}
              disabled={isProcessing}
              className={styles.nextButton}
            >
              {currentStep === 1 ? 'Talk Space Details →' : 
               currentStep === 2 ? 'Discuss Style →' : 
               currentStep === 3 ? 'Set Budget →' : 
               'Start Analysis →'}
            </button>
          )}
        </div>
      )}
    </div>
  )

  const getPlaceholderText = () => {
    switch (currentState) {
      case AIState.WELCOME:
        return "Tell me about your project..."
      case AIState.GATHERING_SPACE:
        return "Share more details..."
      case AIState.GATHERING_STYLE:
        return "What are your preferences..."
      case AIState.GATHERING_BUDGET:
        return "Any additional requirements..."
      default:
        return "Type your response..."
    }
  }



  return (
    <div className={styles.appContainer}>
      <div className={styles.header}>
        <h1 className={styles.appTitle}>AI Furniture Curator</h1>
        <p className={styles.appSubtitle}>Your personal interior design assistant</p>
        {renderStepIndicator()}
      </div>

      <div className={styles.mainContent}>
        <div className={styles.chatSection}>
          {renderChat()}
        </div>
      </div>
    </div>
  )
}

export default App 