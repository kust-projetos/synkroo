/**
 * Synkroo Chat Widget - Embed Script
 *
 * Usage:
 * <script src="https://your-domain.com/widget.js" data-installation-id="PUBLIC_INSTALLATION_ID"></script>
 *
 * Optional attributes:
 * - data-clinic-name="Sua Clínica"
 * - data-primary-color="#4F46E5"
 * - data-position="bottom-right" (or "bottom-left")
 * - data-greeting="Olá! Como posso ajudar?"
 */

(function() {
  // Get script attributes
  const script = document.currentScript
  const installationId = script.getAttribute('data-installation-id')
  const clinicName = script.getAttribute('data-clinic-name') || 'Clínica'
  const primaryColor = script.getAttribute('data-primary-color') || '#4F46E5'
  const position = script.getAttribute('data-position') || 'bottom-right'
  const greeting = script.getAttribute('data-greeting') || 'Olá! Como posso ajudar?'

  if (!installationId) {
    console.error('Synkroo Widget: Missing data-installation-id attribute')
    return
  }

  // Get base URL from script src
  const baseUrl = script.src.replace('/widget.js', '')
  const endpoint = path => baseUrl + path + '?installationId=' + encodeURIComponent(installationId)
  let sessionToken = null

  async function getSession() {
    if (sessionToken) return sessionToken
    const response = await fetch(endpoint('/api/widget/session'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!response.ok) throw new Error('Widget session rejected')
    const payload = await response.json()
    sessionToken = payload.data && payload.data.token
    if (!sessionToken) throw new Error('Widget session missing token')
    return sessionToken
  }

  // Create container
  const container = document.createElement('div')
  container.id = 'synkroo-chat-widget'
  document.body.appendChild(container)

  // Load React and ReactDOM from CDN
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script')
      el.src = src
      el.onload = resolve
      el.onerror = reject
      document.head.appendChild(el)
    })
  }

  // Initialize widget
  async function init() {
    try {
      // Load dependencies
      await Promise.all([
        loadScript('https://unpkg.com/react@18/umd/react.production.min.js'),
        loadScript('https://unpkg.com/react-dom@18/umd/react-dom.production.min.js'),
      ])

      // Create widget using React
      const { useState, useEffect, useRef, useCallback } = React

      function ChatWidget() {
        const [isOpen, setIsOpen] = useState(false)
        const [messages, setMessages] = useState([])
        const [input, setInput] = useState('')
        const [isLoading, setIsLoading] = useState(false)
        const messagesEndRef = useRef(null)
        const inputRef = useRef(null)

        // Visitor ID
        const [visitorId] = useState(() => {
          let vid = localStorage.getItem('synkroo_visitor_id')
          if (!vid) {
            vid = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
            localStorage.setItem('synkroo_visitor_id', vid)
          }
          return vid
        })

        // Scroll to bottom
        useEffect(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
          }
        }, [messages])

        // Focus input
        useEffect(() => {
          if (isOpen && inputRef.current) {
            inputRef.current.focus()
          }
        }, [isOpen])

        // The v1 widget is ingress-only; history is intentionally unavailable.
        useEffect(() => {
          if (isOpen && messages.length === 0) {
            setMessages([{ id: 'greeting', content: greeting, direction: 'outbound' }])
          }
        }, [isOpen])

        const sendMessage = useCallback(async () => {
          if (!input.trim() || isLoading) return

          const text = input.trim()
          setInput('')
          setMessages(prev => [...prev, { id: Date.now(), content: text, direction: 'inbound' }])
          setIsLoading(true)

          try {
            const token = await getSession()
            const idempotencyKey = (crypto.randomUUID
              ? crypto.randomUUID()
              : 'widget_' + Date.now() + '_' + Math.random().toString(36).slice(2))
            const res = await fetch(endpoint('/api/widget/messages'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token,
                'Idempotency-Key': idempotencyKey,
              },
              body: JSON.stringify({
                message: text,
                visitorId: visitorId,
                idempotencyKey: idempotencyKey,
              }),
            })

            if (!res.ok) throw new Error('Widget message rejected')
          } catch (e) {
            console.error('Error sending message:', e)
          } finally {
            setIsLoading(false)
          }
        }, [input, isLoading])

        const positionClass = position === 'bottom-left' ? 'left-4' : 'right-4'

        // Styles
        const buttonStyle = {
          position: 'fixed',
          bottom: '1rem',
          left: position === 'bottom-left' ? '1rem' : 'auto',
          right: position === 'bottom-right' ? '1rem' : 'auto',
          zIndex: 9999,
          width: '3.5rem',
          height: '3.5rem',
          borderRadius: '9999px',
          backgroundColor: primaryColor,
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }

        const windowStyle = {
          position: 'fixed',
          bottom: '5rem',
          left: position === 'bottom-left' ? '1rem' : 'auto',
          right: position === 'bottom-right' ? '1rem' : 'auto',
          zIndex: 9999,
          width: '22rem',
          height: '28rem',
          backgroundColor: 'white',
          borderRadius: '1rem',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e5e7eb',
        }

        const headerStyle = {
          padding: '1rem',
          color: 'white',
          backgroundColor: primaryColor,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }

        const messagesStyle = {
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          backgroundColor: '#f9fafb',
        }

        const inputContainerStyle = {
          padding: '0.75rem',
          backgroundColor: 'white',
          borderTop: '1px solid #f3f4f6',
          display: 'flex',
          gap: '0.5rem',
        }

        const inputStyle = {
          flex: 1,
          padding: '0.5rem 1rem',
          borderRadius: '9999px',
          border: 'none',
          backgroundColor: '#f3f4f6',
          outline: 'none',
          fontSize: '0.875rem',
        }

        const sendButtonStyle = {
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '9999px',
          backgroundColor: primaryColor,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }

        return React.createElement('div', null,
          // Button
          React.createElement('button', {
            style: buttonStyle,
            onClick: () => setIsOpen(!isOpen),
          },
            isOpen
              ? React.createElement('svg', { width: 24, height: 24, fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M6 18L18 6M6 6l12 12' }))
              : React.createElement('svg', { width: 24, height: 24, fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' }))
          ),
          // Chat Window
          isOpen && React.createElement('div', { style: windowStyle },
            // Header
            React.createElement('div', { style: headerStyle },
              React.createElement('div', { style: { width: '2.5rem', height: '2.5rem', borderRadius: '9999px', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
                React.createElement('svg', { width: 20, height: 20, fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' }))
              ),
              React.createElement('div', null,
                React.createElement('div', { style: { fontWeight: 600 } }, clinicName),
                React.createElement('div', { style: { fontSize: '0.75rem', opacity: 0.8 } }, 'Online agora')
              )
            ),
            // Messages
            React.createElement('div', { style: messagesStyle },
              messages.map(msg =>
                React.createElement('div', {
                  key: msg.id,
                  style: {
                    display: 'flex',
                    justifyContent: msg.direction === 'inbound' ? 'flex-end' : 'flex-start',
                    marginBottom: '0.75rem',
                  }
                },
                  React.createElement('div', {
                    style: {
                      maxWidth: '80%',
                      padding: '0.5rem 1rem',
                      borderRadius: '1rem',
                      fontSize: '0.875rem',
                      backgroundColor: msg.direction === 'inbound' ? primaryColor : 'white',
                      color: msg.direction === 'inbound' ? 'white' : '#1f2937',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }
                  }, msg.content)
                )
              ),
              isLoading && React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-start' } },
                React.createElement('div', {
                  style: {
                    padding: '0.75rem 1rem',
                    borderRadius: '1rem',
                    backgroundColor: 'white',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }
                }, '...')
              ),
              React.createElement('div', { ref: messagesEndRef })
            ),
            // Input
            React.createElement('div', { style: inputContainerStyle },
              React.createElement('input', {
                ref: inputRef,
                style: inputStyle,
                type: 'text',
                value: input,
                onChange: e => setInput(e.target.value),
                onKeyPress: e => e.key === 'Enter' && sendMessage(),
                placeholder: 'Digite sua mensagem...',
                disabled: isLoading,
              }),
              React.createElement('button', {
                style: sendButtonStyle,
                onClick: sendMessage,
                disabled: !input.trim() || isLoading,
              },
                React.createElement('svg', { width: 20, height: 20, fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
                  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8' }))
              )
            )
          )
        )
      }

      // Render
      ReactDOM.render(React.createElement(ChatWidget), container)
    } catch (error) {
      console.error('Failed to initialize Synkroo Widget:', error)
    }
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
